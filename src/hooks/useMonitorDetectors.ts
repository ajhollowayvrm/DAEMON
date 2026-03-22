import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMonitorStore } from "../stores/monitorStore";
import type { MonitorSource, MonitorEventType } from "../stores/monitorStore";
import type {
  DatadogMonitor,
  EnrichedMergeRequest,
  SlackSection,
  LinearIssue,
} from "../types/models";

// ── Snapshot types for prev/next comparison ──

interface Snapshots {
  mrs?: EnrichedMergeRequest[];
  slack?: SlackSection[];
  linear?: LinearIssue[];
  datadog?: DatadogMonitor[];
}

// ── Helper to fire a monitor event ──
// Detectors only provide source/eventType/title/context.
// The store's addEvent matches rules and handles dispatch.

function fireEvent(
  source: MonitorSource,
  eventType: MonitorEventType,
  title: string,
  context: Record<string, string>,
) {
  useMonitorStore.getState().addEvent({ source, eventType, title, context });
}

// ── GitLab Detectors ──

function detectGitLabEvents(
  prev: EnrichedMergeRequest[] | undefined,
  next: EnrichedMergeRequest[],
) {
  if (!prev) return;

  const prevMap = new Map(prev.map((mr) => [mr.id, mr]));

  for (const mr of next) {
    const old = prevMap.get(mr.id);
    if (!old) continue;

    const ctx = {
      iid: String(mr.iid),
      title: mr.title,
      projectId: String(mr.project_id),
      author: mr.author,
      sourceBranch: mr.source_branch,
    };

    // Pipeline failed (was not failed → now failed)
    if (
      mr.pipeline_status === "failed" &&
      old.pipeline_status !== "failed"
    ) {
      fireEvent(
        "gitlab",
        "pipeline_failed",
        `Pipeline failed on !${mr.iid}: ${mr.title}`,
        ctx,
      );
    }

    // MR has conflicts (didn't before)
    if (mr.has_conflicts && !old.has_conflicts) {
      fireEvent(
        "gitlab",
        "mr_conflict",
        `Merge conflict on !${mr.iid}: ${mr.title}`,
        ctx,
      );
    }

    // New comments (notes count increased)
    if (mr.notes_count > old.notes_count) {
      fireEvent(
        "gitlab",
        "mr_new_comment",
        `New comments on !${mr.iid}: ${mr.title}`,
        { ...ctx, newComments: String(mr.notes_count - old.notes_count) },
      );
    }

    // MR no longer needs your approval (approval rule you were on was satisfied)
    if (old.needs_your_approval && !mr.needs_your_approval) {
      fireEvent(
        "gitlab",
        "mr_approved",
        `Approval satisfied on !${mr.iid}: ${mr.title}`,
        ctx,
      );
    }
  }
}

// ── Linear Detectors ──

function detectLinearEvents(
  prev: LinearIssue[] | undefined,
  next: LinearIssue[],
) {
  if (!prev) return;

  const prevMap = new Map(prev.map((i) => [i.id, i]));

  for (const issue of next) {
    const old = prevMap.get(issue.id);
    if (!old) continue;

    const ctx = {
      identifier: issue.identifier,
      title: issue.title,
      status: issue.status,
      prevStatus: old.status,
      newStatus: issue.status,
      team: issue.team_name,
    };

    // Status changed
    if (issue.status !== old.status) {
      // Specifically detect blocked
      if (
        issue.status_type === "backlog" &&
        issue.status.toLowerCase().includes("block")
      ) {
        fireEvent(
          "linear",
          "ticket_blocked",
          `${issue.identifier} blocked: ${issue.title}`,
          ctx,
        );
      } else {
        fireEvent(
          "linear",
          "ticket_status_changed",
          `${issue.identifier} → ${issue.status}: ${issue.title}`,
          ctx,
        );
      }
    }
  }
}

// ── Slack Detectors ──

function detectSlackEvents(
  prev: SlackSection[] | undefined,
  next: SlackSection[],
) {
  if (!prev) return;

  // Detect new direct mentions by comparing unread counts in the mentions section
  const prevMentions = prev.find((s) => s.section_type === "mentions");
  const nextMentions = next.find((s) => s.section_type === "mentions");

  if (prevMentions && nextMentions) {
    if (nextMentions.unread_count > prevMentions.unread_count) {
      const newMessages = nextMentions.messages.filter(
        (m) =>
          m.is_unread &&
          !prevMentions.messages.some((pm) => pm.id === m.id),
      );

      for (const msg of newMessages.slice(0, 3)) {
        fireEvent(
          "slack",
          "direct_mention",
          `${msg.sender} mentioned you in #${msg.channel}`,
          {
            sender: msg.sender,
            channel: msg.channel,
            channelId: msg.channel_id,
            message: msg.message.slice(0, 200),
            threadTs: msg.raw_ts,
          },
        );
      }
    }
  }
}

// ── Datadog Detectors ──

function detectDatadogEvents(
  prev: DatadogMonitor[] | undefined,
  next: DatadogMonitor[],
) {
  if (!prev) return;

  const prevMap = new Map(prev.map((m) => [m.id, m]));

  for (const monitor of next) {
    const old = prevMap.get(monitor.id);
    if (!old) continue;

    const ctx = {
      monitorId: String(monitor.id),
      monitorName: monitor.name,
      query: monitor.query,
      tags: monitor.tags.join(", "),
      monitorType: monitor.monitor_type,
    };

    // Transitioned to Alert (was not Alert before)
    if (monitor.status === "Alert" && old.status !== "Alert") {
      fireEvent(
        "datadog",
        "monitor_alert",
        `Monitor alert: ${monitor.name}`,
        ctx,
      );
    }

    // Transitioned to Warn (was OK or No Data before — not from Alert)
    if (
      monitor.status === "Warn" &&
      old.status !== "Warn" &&
      old.status !== "Alert"
    ) {
      fireEvent(
        "datadog",
        "monitor_warn",
        `Monitor warning: ${monitor.name}`,
        ctx,
      );
    }
  }
}

// ── Main Hook ──

/**
 * Mount this hook once at the app root (inside QueryClientProvider).
 * It subscribes to React Query cache updates and runs detectors
 * to fire monitor events.
 */
export function useMonitorDetectors() {
  const queryClient = useQueryClient();
  const snapshotsRef = useRef<Snapshots>({});

  useEffect(() => {
    // Subscribe to query cache changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || !event.query.state.data) return;

      const key = event.query.queryKey;

      // GitLab MRs
      if (key[0] === "gitlab" && key[1] === "mergeRequests") {
        const next = event.query.state.data as EnrichedMergeRequest[];
        detectGitLabEvents(snapshotsRef.current.mrs, next);
        snapshotsRef.current.mrs = next;
      }

      // Slack sections
      if (key[0] === "slack" && key[1] === "sections") {
        const next = event.query.state.data as SlackSection[];
        detectSlackEvents(snapshotsRef.current.slack, next);
        snapshotsRef.current.slack = next;
      }

      // Linear issues
      if (key[0] === "linear" && key[1] === "issues") {
        const next = event.query.state.data as LinearIssue[];
        detectLinearEvents(snapshotsRef.current.linear, next);
        snapshotsRef.current.linear = next;
      }

      // Datadog monitors
      if (key[0] === "datadog" && key[1] === "monitors") {
        const next = event.query.state.data as DatadogMonitor[];
        detectDatadogEvents(snapshotsRef.current.datadog, next);
        snapshotsRef.current.datadog = next;
      }
    });

    return () => unsubscribe();
  }, [queryClient]);
}
