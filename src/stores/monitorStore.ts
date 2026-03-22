import { create } from "zustand";
import { persist } from "zustand/middleware";
import { usePersonaStore } from "./personaStore";
import { useFocusStore } from "./focusStore";
import type { FocusSource } from "./focusStore";

// ── Types ──

export type MonitorSource = "gitlab" | "slack" | "linear" | "datadog";

export type MonitorEventType =
  // GitLab
  | "pipeline_failed"
  | "mr_approved"
  | "mr_merged"
  | "mr_new_comment"
  | "mr_conflict"
  // Slack
  | "direct_mention"
  | "urgent_keyword"
  | "unread_dm_threshold"
  // Linear
  | "ticket_blocked"
  | "ticket_status_changed"
  | "ticket_approaching_due"
  | "ticket_new_comment"
  // Datadog
  | "monitor_alert"
  | "monitor_warn"
  | "monitor_recovered";

export type DispatchMode = "auto" | "toast" | "off";

export interface MonitorRule {
  id: string;
  enabled: boolean;
  source: MonitorSource;
  eventType: MonitorEventType;
  dispatchMode: DispatchMode;
  personaId: string;
  promptTemplate: string;
  /** In-character toast message template (shorter, personality-driven) */
  toastTemplate: string;
  cooldownMinutes: number;
}

export interface MonitorEvent {
  id: string;
  ruleId: string;
  source: MonitorSource;
  eventType: MonitorEventType;
  title: string;
  /** Template variables for prompt hydration */
  context: Record<string, string>;
  detectedAt: string;
  status: "pending" | "dispatched" | "dismissed" | "auto_dispatched";
  personaId: string;
  taskId?: string;
}

// ── Helpers ──

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function hydrateTemplate(
  template: string,
  context: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? `{{${key}}}`);
}

// ── Default Rules ──

const DEFAULT_RULES: MonitorRule[] = [
  {
    id: "rule-pipeline-failed",
    enabled: true,
    source: "gitlab",
    eventType: "pipeline_failed",
    dispatchMode: "toast",
    personaId: "jet",
    promptTemplate:
      "Investigate the pipeline failure on MR !{{iid}} ({{title}}) in project {{projectId}}. Check the failed jobs, trace the error, and report your findings.",
    toastTemplate:
      "Noticed MR !{{iid}} has a pipeline failure. Want me to take a look, boss?",
    cooldownMinutes: 10,
  },
  {
    id: "rule-mr-approved",
    enabled: true,
    source: "gitlab",
    eventType: "mr_approved",
    dispatchMode: "toast",
    personaId: "sain",
    promptTemplate:
      "An approval rule you were on for MR !{{iid}} ({{title}}) has been satisfied. Check if the MR is now fully approved, and if so, review the description and update it with a polished summary.",
    toastTemplate:
      "Your approval rule on MR !{{iid}} has been satisfied. Shall I check its status and compose a summary, my liege?",
    cooldownMinutes: 30,
  },
  {
    id: "rule-mr-new-comment",
    enabled: true,
    source: "gitlab",
    eventType: "mr_new_comment",
    dispatchMode: "toast",
    personaId: "rei",
    promptTemplate:
      "New comments have appeared on MR !{{iid}} ({{title}}). Summarize the reviewer feedback and identify any action items.",
    toastTemplate:
      "New feedback on MR !{{iid}}. I can summarize their comments.",
    cooldownMinutes: 15,
  },
  {
    id: "rule-mr-conflict",
    enabled: true,
    source: "gitlab",
    eventType: "mr_conflict",
    dispatchMode: "toast",
    personaId: "jet",
    promptTemplate:
      "MR !{{iid}} ({{title}}) has merge conflicts. Investigate the conflicting files and report what needs to be resolved.",
    toastTemplate:
      "MR !{{iid}} just picked up a merge conflict. Want me to check what's clashing?",
    cooldownMinutes: 30,
  },
  {
    id: "rule-ticket-blocked",
    enabled: true,
    source: "linear",
    eventType: "ticket_blocked",
    dispatchMode: "toast",
    personaId: "geno",
    promptTemplate:
      "Ticket {{identifier}} ({{title}}) is blocked. Analyze the blocker and draft options for unblocking.",
    toastTemplate:
      "{{identifier}} just got blocked. Want me to draw up some plays to get it moving again?",
    cooldownMinutes: 30,
  },
  {
    id: "rule-ticket-status-changed",
    enabled: true,
    source: "linear",
    eventType: "ticket_status_changed",
    dispatchMode: "off",
    personaId: "zexion",
    promptTemplate:
      "Ticket {{identifier}} ({{title}}) changed status from {{prevStatus}} to {{newStatus}}. Provide context on what this means for the workflow.",
    toastTemplate:
      "{{identifier}} moved to {{newStatus}}. Shall I assess the implications?",
    cooldownMinutes: 15,
  },
  // ── Datadog ──
  {
    id: "rule-monitor-alert",
    enabled: true,
    source: "datadog",
    eventType: "monitor_alert",
    dispatchMode: "toast",
    personaId: "jet",
    promptTemplate:
      "Datadog monitor \"{{monitorName}}\" (ID {{monitorId}}) is in Alert state. Query: {{query}}. Tags: {{tags}}. Investigate the alert — check recent logs, traces, and metrics to identify root cause.",
    toastTemplate:
      "Monitor \"{{monitorName}}\" just went critical. Want me to dig into it, boss?",
    cooldownMinutes: 15,
  },
  {
    id: "rule-monitor-warn",
    enabled: true,
    source: "datadog",
    eventType: "monitor_warn",
    dispatchMode: "toast",
    personaId: "zexion",
    promptTemplate:
      "Datadog monitor \"{{monitorName}}\" (ID {{monitorId}}) is in Warn state. Query: {{query}}. Tags: {{tags}}. Research the warning — check if this is trending toward an alert and what might be causing degradation.",
    toastTemplate:
      "Monitor \"{{monitorName}}\" is in warning state. Shall I look into what's degrading?",
    cooldownMinutes: 30,
  },
];

const MAX_EVENTS = 100;

// ── Cooldown tracking (in-memory only, resets on reload) ──

const cooldownMap = new Map<string, number>();

function isCoolingDown(ruleId: string, cooldownMinutes: number): boolean {
  const lastFired = cooldownMap.get(ruleId);
  if (!lastFired) return false;
  return Date.now() - lastFired < cooldownMinutes * 60_000;
}

function markFired(ruleId: string) {
  cooldownMap.set(ruleId, Date.now());
}

// ── Source → FocusSource mapping ──

const SOURCE_TO_FOCUS: Record<MonitorSource, FocusSource> = {
  gitlab: "gitlab",
  slack: "slack",
  linear: "linear",
  datadog: "datadog",
};

// ── Shared dispatch helper (used by both auto and toast-accept paths) ──

function doDispatch(
  event: MonitorEvent,
  rule: MonitorRule,
  set: (fn: (s: { events: MonitorEvent[] }) => { events: MonitorEvent[] }) => void,
  newStatus: "dispatched" | "auto_dispatched",
) {
  const prompt = hydrateTemplate(rule.promptTemplate, event.context);
  const taskId = usePersonaStore.getState().launchAgent(rule.personaId, prompt);

  if (taskId) {
    const focusId = useFocusStore.getState().pinFromFeed(
      {
        source: SOURCE_TO_FOCUS[event.source],
        label: event.title,
        subtitle: `${newStatus === "auto_dispatched" ? "Auto-dispatched" : "Dispatched"} to ${rule.personaId}`,
      },
      event.title,
    );
    useFocusStore.getState().addDispatch(focusId, rule.personaId, taskId);
  }

  set((s) => ({
    events: s.events.map((e) =>
      e.id === event.id
        ? { ...e, status: newStatus, taskId: taskId ?? undefined }
        : e,
    ),
  }));
}

// ── Store ──

interface MonitorState {
  rules: MonitorRule[];
  events: MonitorEvent[];

  // Rule CRUD
  addRule: (rule: Omit<MonitorRule, "id">) => void;
  updateRule: (id: string, updates: Partial<Omit<MonitorRule, "id">>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  setDispatchMode: (id: string, mode: DispatchMode) => void;

  // Events
  addEvent: (event: { source: MonitorSource; eventType: MonitorEventType; title: string; context: Record<string, string> }) => void;
  dispatchEvent: (eventId: string) => void;
  dismissEvent: (eventId: string) => void;
  clearEvents: () => void;

  // Queries
  getActiveToasts: () => MonitorEvent[];
  getAutoDispatched: () => MonitorEvent[];
  getRuleForEvent: (eventType: MonitorEventType, source: MonitorSource) => MonitorRule | undefined;
}

export const useMonitorStore = create<MonitorState>()(
  persist(
    (set, get) => ({
      rules: DEFAULT_RULES,
      events: [],

      // ── Rule CRUD ──

      addRule: (rule) =>
        set((s) => ({
          rules: [...s.rules, { ...rule, id: genId("rule") }],
        })),

      updateRule: (id, updates) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),

      deleteRule: (id) =>
        set((s) => ({
          rules: s.rules.filter((r) => r.id !== id),
        })),

      toggleRule: (id) =>
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled } : r,
          ),
        })),

      setDispatchMode: (id, mode) =>
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id ? { ...r, dispatchMode: mode } : r,
          ),
        })),

      // ── Events ──

      addEvent: (eventData) => {
        const { rules } = get();

        // Find ALL matching enabled rules (supports multiple rules per event type)
        const matchingRules = rules.filter(
          (r) =>
            r.eventType === eventData.eventType &&
            r.source === eventData.source &&
            r.enabled &&
            r.dispatchMode !== "off",
        );

        for (const rule of matchingRules) {
          if (isCoolingDown(rule.id, rule.cooldownMinutes)) continue;

          markFired(rule.id);

          const isAuto = rule.dispatchMode === "auto";

          const event: MonitorEvent = {
            ...eventData,
            id: genId("evt"),
            ruleId: rule.id,
            personaId: rule.personaId,
            detectedAt: new Date().toISOString(),
            status: isAuto ? "auto_dispatched" : "pending",
          };

          set((s) => ({
            events: [event, ...s.events].slice(0, MAX_EVENTS),
          }));

          // Auto-dispatch: launch agent immediately
          if (isAuto) {
            doDispatch(event, rule, set, "auto_dispatched");
          }
        }
      },

      dispatchEvent: (eventId) => {
        const state = get();
        const event = state.events.find((e) => e.id === eventId);
        if (!event || event.status !== "pending") return;

        const rule = state.rules.find((r) => r.id === event.ruleId);
        if (!rule) return;

        doDispatch(event, rule, set, "dispatched");
      },

      dismissEvent: (eventId) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === eventId && e.status === "pending"
              ? { ...e, status: "dismissed" as const }
              : e,
          ),
        })),

      clearEvents: () => set({ events: [] }),

      // ── Queries ──

      getActiveToasts: () =>
        get().events.filter((e) => e.status === "pending"),

      getAutoDispatched: () =>
        get().events.filter((e) => e.status === "auto_dispatched"),

      getRuleForEvent: (eventType, source) =>
        get().rules.find(
          (r) => r.eventType === eventType && r.source === source && r.enabled,
        ),
    }),
    {
      name: "daemon-monitor-v1",
      partialize: (state) => ({
        rules: state.rules,
        // Don't persist events — they're ephemeral per session
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<{ rules: MonitorRule[] }> | undefined;
        const persistedRules = p?.rules ?? [];

        if (persistedRules.length === 0) {
          return { ...current, rules: DEFAULT_RULES };
        }

        // Merge in any default rules whose IDs are missing from persisted set
        // so existing users get new rules (e.g., Datadog) without clearing storage
        const existingIds = new Set(persistedRules.map((r) => r.id));
        const missingDefaults = DEFAULT_RULES.filter((r) => !existingIds.has(r.id));
        return {
          ...current,
          rules: [...persistedRules, ...missingDefaults],
        };
      },
    },
  ),
);

// ── Export for detectors ──

export { hydrateTemplate };
