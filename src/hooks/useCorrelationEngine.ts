import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCorrelationStore,
  type CorrelationEntity,
} from "../stores/correlationStore";
import { useFocusStore } from "../stores/focusStore";
import type {
  DatadogMonitor,
  EnrichedMergeRequest,
  SlackSection,
  LinearIssue,
} from "../types/models";

// ── Regex patterns for signal extraction ──

/** Matches ticket IDs like SUR-940, ENG-512, PRD-123 (case-insensitive) */
const TICKET_ID_RE = /\b([A-Z]{2,6}-\d{1,6})\b/gi;

/** Matches MR references like !142, !4521 */
const MR_REF_RE = /!(\d+)\b/g;

// ── Signal pair helper ──

interface Signal {
  a: string;
  b: string;
}

/** Extract all ticket IDs from text, normalized to uppercase */
function extractTicketIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(TICKET_ID_RE)) {
    ids.add(m[1].toUpperCase());
  }
  return [...ids];
}

/** Extract all MR IID references from text */
function extractMRRefs(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(MR_REF_RE)) {
    ids.add(m[1]);
  }
  return [...ids];
}

// ── GitLab signal extraction ──

function extractGitLabSignals(mrs: EnrichedMergeRequest[]) {
  const entities: CorrelationEntity[] = [];
  const signals: Signal[] = [];

  for (const mr of mrs) {
    const entityId = `gitlab:${mr.iid}`;
    entities.push({
      source: "gitlab",
      id: entityId,
      label: `!${mr.iid}: ${mr.title}`,
      subtitle: `${mr.author} · ${mr.target_branch} ← ${mr.source_branch}`,
      nav: { type: "gitlab", projectId: mr.project_id, iid: mr.iid },
    });

    // Extract ticket IDs from branch name (case-insensitive)
    const branchMatch = mr.source_branch.match(/^([A-Za-z]+-\d+)/);
    if (branchMatch) {
      signals.push({ a: entityId, b: `linear:${branchMatch[1].toUpperCase()}` });
    }

    // Extract ticket IDs from title and description
    const titleTickets = extractTicketIds(mr.title);
    for (const ticketId of titleTickets) {
      signals.push({ a: entityId, b: `linear:${ticketId}` });
    }

    // MR descriptions often reference tickets
    // (description is only on MRDetail, not EnrichedMergeRequest — but title covers most cases)
  }

  return { entities, signals };
}

// ── Linear signal extraction ──

function extractLinearSignals(issues: LinearIssue[]) {
  const entities: CorrelationEntity[] = [];
  // Linear items are primarily targets — signals come from other sources.
  // We register them as entities so they show up when looked up.

  for (const issue of issues) {
    entities.push({
      source: "linear",
      id: `linear:${issue.identifier}`,
      label: `${issue.identifier}: ${issue.title}`,
      subtitle: `${issue.status} · ${issue.team_key}`,
      nav: { type: "linear", identifier: issue.identifier },
    });
  }

  return { entities, signals: [] as Signal[] };
}

// ── Slack signal extraction ──

function extractSlackSignals(sections: SlackSection[]) {
  const entities: CorrelationEntity[] = [];
  const signals: Signal[] = [];

  for (const section of sections) {
    for (const msg of section.messages) {
      const ticketIds = extractTicketIds(msg.message);
      const mrRefs = extractMRRefs(msg.message);

      if (ticketIds.length === 0 && mrRefs.length === 0) continue;

      const entityId = `slack:${msg.channel_id}:${msg.raw_ts}`;
      entities.push({
        source: "slack",
        id: entityId,
        label: `${msg.sender} in #${msg.channel}`,
        subtitle: msg.message.slice(0, 80),
        nav: { type: "slack", channelId: msg.channel_id, threadTs: msg.raw_ts },
      });

      for (const ticketId of ticketIds) {
        signals.push({ a: entityId, b: `linear:${ticketId}` });
      }
      for (const mrIid of mrRefs) {
        signals.push({ a: entityId, b: `gitlab:${mrIid}` });
      }
    }
  }

  return { entities, signals };
}

// ── Datadog signal extraction ──

/** Extract service name from a "service:foo" tag */
const SERVICE_TAG_RE = /^service:(.+)$/;

function extractDatadogSignals(monitors: DatadogMonitor[]) {
  const entities: CorrelationEntity[] = [];
  const signals: Signal[] = [];

  // Build a map of service names → GitLab MR entity IDs for cross-referencing
  // (MR branches often contain service names like "comms-mailer-fix-retry")

  for (const monitor of monitors) {
    const entityId = `datadog:${monitor.id}`;
    entities.push({
      source: "datadog",
      id: entityId,
      label: monitor.name,
      subtitle: `${monitor.status} · ${monitor.monitor_type}`,
      nav: { type: "datadog", monitorId: monitor.id },
    });

    // Extract ticket IDs from monitor name
    const ticketIds = extractTicketIds(monitor.name);
    for (const ticketId of ticketIds) {
      signals.push({ a: entityId, b: `linear:${ticketId}` });
    }

    // Extract service tags — these create signals to any entity
    // that references the same service name in the correlation index
    for (const tag of monitor.tags) {
      const serviceMatch = tag.match(SERVICE_TAG_RE);
      if (serviceMatch) {
        // Register a synthetic "service entity" so monitors for the same
        // service are transitively correlated with MRs/tickets touching it
        const serviceEntityId = `service:${serviceMatch[1]}`;
        signals.push({ a: entityId, b: serviceEntityId });
      }
    }
  }

  return { entities, signals };
}

// ── Focus Item signal extraction ──

function extractFocusSignals() {
  const items = useFocusStore.getState().items.filter((i) => !i.archived);
  const entities: CorrelationEntity[] = [];
  const signals: Signal[] = [];

  for (const item of items) {
    const focusId = `focus:${item.id}`;
    entities.push({
      source: "focus",
      id: focusId,
      label: item.title,
      nav: { type: "focus", focusId: item.id },
    });

    // Each explicit link on a Focus Item is a high-confidence signal
    for (const link of item.links) {
      let targetId: string | null = null;

      if (link.source === "gitlab" && link.sourceId) {
        targetId = `gitlab:${link.sourceId}`;
      } else if (link.source === "linear" && link.sourceId) {
        targetId = `linear:${link.sourceId}`;
      } else if (link.source === "slack" && link.slackRef) {
        targetId = `slack:${link.slackRef.channelId}:${link.slackRef.threadTs}`;
      }

      if (targetId) {
        signals.push({ a: focusId, b: targetId });
      }
    }

    // Also extract ticket IDs and MR refs from Focus Item title and notes
    const titleTickets = extractTicketIds(item.title);
    for (const ticketId of titleTickets) {
      signals.push({ a: focusId, b: `linear:${ticketId}` });
    }
    const titleMRs = extractMRRefs(item.title);
    for (const mrIid of titleMRs) {
      signals.push({ a: focusId, b: `gitlab:${mrIid}` });
    }
    for (const note of item.notes) {
      for (const ticketId of extractTicketIds(note.text)) {
        signals.push({ a: focusId, b: `linear:${ticketId}` });
      }
      for (const mrIid of extractMRRefs(note.text)) {
        signals.push({ a: focusId, b: `gitlab:${mrIid}` });
      }
    }
  }

  return { entities, signals };
}

// ── Main Hook ──

/**
 * Mount once at app root (inside QueryClientProvider).
 * Subscribes to React Query cache updates AND FocusStore item changes.
 * Rebuilds only the source that changed — skips entirely if data is identical.
 */
export function useCorrelationEngine() {
  const queryClient = useQueryClient();
  const rebuildSource = useCorrelationStore.getState().rebuildSource;

  // Subscribe to React Query cache changes
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || !event.query.state.data) return;

      const key = event.query.queryKey;

      if (key[0] === "gitlab" && key[1] === "mergeRequests") {
        const { entities, signals } = extractGitLabSignals(
          event.query.state.data as EnrichedMergeRequest[],
        );
        rebuildSource("gitlab", entities, signals);
      }

      if (key[0] === "linear" && key[1] === "issues") {
        const { entities, signals } = extractLinearSignals(
          event.query.state.data as LinearIssue[],
        );
        rebuildSource("linear", entities, signals);
      }

      if (key[0] === "slack" && key[1] === "sections") {
        const { entities, signals } = extractSlackSignals(
          event.query.state.data as SlackSection[],
        );
        rebuildSource("slack", entities, signals);
      }

      if (key[0] === "datadog" && key[1] === "monitors") {
        const { entities, signals } = extractDatadogSignals(
          event.query.state.data as DatadogMonitor[],
        );
        rebuildSource("datadog", entities, signals);
      }
    });

    return () => unsubscribe();
  }, [queryClient, rebuildSource]);

  // Subscribe to FocusStore — only rebuild when items array changes (not navigation state)
  useEffect(() => {
    let lastItemCount = useFocusStore.getState().items.length;
    let lastItemIds = useFocusStore.getState().items.map((i) => i.id).join(",");

    const unsubscribe = useFocusStore.subscribe((state) => {
      // Only rebuild if items actually changed (not activeItemId navigation)
      const currentCount = state.items.length;
      const currentIds = state.items.map((i) => i.id).join(",");
      if (currentCount === lastItemCount && currentIds === lastItemIds) {
        // Item count and IDs same — check if links/notes changed
        // The fingerprint in rebuildSource will catch identical data, so just rebuild
      }
      lastItemCount = currentCount;
      lastItemIds = currentIds;

      const { entities, signals } = extractFocusSignals();
      rebuildSource("focus", entities, signals);
    });

    // Initial build
    const { entities, signals } = extractFocusSignals();
    rebuildSource("focus", entities, signals);

    return () => unsubscribe();
  }, [rebuildSource]);
}
