export type ActionSource = "slack" | "gitlab" | "linear" | "datadog";

export interface AIAction {
  id: string;
  label: string;
  command: string;
  /** Persona ID to run this action as (uses their model, system prompt, tools) */
  persona?: string;
  /** Build the args string from the context data */
  buildArgs: (context: Record<string, unknown>) => string;
}

export const SLACK_ACTIONS: AIAction[] = [
  {
    id: "investigate",
    label: "Investigate This",
    command: "",
    persona: "zexion",
    buildArgs: (ctx) =>
      `Investigate this Slack message and find relevant code/context:\n\nChannel: ${ctx.channel ?? ""}\nFrom: ${ctx.sender ?? ""}\nMessage: ${ctx.message ?? ""}`,
  },
  {
    id: "summarize-thread",
    label: "Summarize Thread",
    command: "",
    persona: "zexion",
    buildArgs: (ctx) =>
      `Summarize this Slack thread concisely:\n\nChannel: ${ctx.channel ?? ""}\nMessage: ${ctx.message ?? ""}`,
  },
  {
    id: "create-ticket",
    label: "Create Ticket from This",
    command: "/linear-create-ticket",
    persona: "geno",
    buildArgs: (ctx) =>
      `Create a Linear ticket from this Slack message:\n\nFrom ${ctx.sender ?? ""}: ${ctx.message ?? ""}`,
  },
  {
    id: "draft-reply",
    label: "Draft Reply",
    command: "",
    persona: "sain",
    buildArgs: (ctx) =>
      `Draft a professional reply to this Slack message:\n\nFrom ${ctx.sender ?? ""} in ${ctx.channel ?? ""}:\n${ctx.message ?? ""}`,
  },
];

export const GITLAB_ACTIONS: AIAction[] = [
  {
    id: "copy-link",
    label: "Copy Link",
    command: "__copy__",
    buildArgs: (ctx) => String(ctx.webUrl ?? ""),
  },
  {
    id: "review-mr",
    label: "Review This MR",
    command: "/gitlab-review-mr",
    persona: "rei",
    buildArgs: (ctx) => `!${ctx.iid ?? ""}`,
  },
  {
    id: "fix-pipeline",
    label: "Fix Pipeline",
    command: "/gitlab-manage-mr-ci-pipeline",
    persona: "jet",
    buildArgs: (ctx) => `!${ctx.iid ?? ""}`,
  },
  {
    id: "resolve-conflicts",
    label: "Resolve Conflicts",
    command: "",
    persona: "spike",
    buildArgs: (ctx) =>
      `MR !${ctx.iid ?? ""} (${ctx.title ?? ""}) has merge conflicts. Investigate the conflicts between the source branch and target branch, understand what both sides changed, and resolve the conflicts. Prefer keeping both changes when possible.`,
  },
  {
    id: "summarize-changes",
    label: "Summarize Changes",
    command: "",
    persona: "zexion",
    buildArgs: (ctx) =>
      `Research and summarize the changes in GitLab MR !${ctx.iid ?? ""}: ${ctx.title ?? ""}. Read the diff and explain what changed and why.`,
  },
  {
    id: "write-description",
    label: "Write MR Description",
    command: "/gitlab-create-mr",
    persona: "sain",
    buildArgs: (ctx) => `!${ctx.iid ?? ""}`,
  },
];

export const LINEAR_ACTIONS: AIAction[] = [
  {
    id: "enrich-ticket",
    label: "Enrich Ticket",
    command: "/linear-enrich-ticket",
    persona: "zexion",
    buildArgs: (ctx) => String(ctx.identifier ?? ""),
  },
  {
    id: "work-on-ticket",
    label: "Work on This",
    command: "/linear-work-on-ticket",
    persona: "spike",
    buildArgs: (ctx) => String(ctx.identifier ?? ""),
  },
  {
    id: "create-tech-design",
    label: "Create Tech Design",
    command: "/linear-create-tech-design-from-project",
    persona: "geno",
    buildArgs: (ctx) => String(ctx.identifier ?? ""),
  },
  {
    id: "debug-issue",
    label: "Debug This Issue",
    command: "",
    persona: "jet",
    buildArgs: (ctx) =>
      `Investigate this Linear issue: ${ctx.identifier ?? ""} — ${ctx.title ?? ""}. Check the codebase for related code, recent changes, and potential root causes.`,
  },
  {
    id: "breakdown-ticket",
    label: "Break Down Ticket",
    command: "/linear-breakdown-tech-design",
    persona: "geno",
    buildArgs: (ctx) => String(ctx.identifier ?? ""),
  },
];

export const DATADOG_ACTIONS: AIAction[] = [
  {
    id: "investigate-alert",
    label: "Investigate Alert",
    command: "",
    persona: "ritsuko",
    buildArgs: (ctx) =>
      `Investigate Datadog monitor alert:\n\nMonitor: ${ctx.monitorName ?? ""}\nID: ${ctx.monitorId ?? ""}\nStatus: ${ctx.status ?? ""}\nQuery: ${ctx.query ?? ""}\nTags: ${ctx.tags ?? ""}\n\nPull recent logs, traces, and metrics to identify the root cause. Provide a clear summary of what's happening and recommend next steps.`,
  },
  {
    id: "audit-monitor",
    label: "Audit Monitor",
    command: "",
    persona: "ritsuko",
    buildArgs: (ctx) =>
      `Audit this Datadog monitor and recommend improvements:\n\nMonitor: ${ctx.monitorName ?? ""}\nID: ${ctx.monitorId ?? ""}\nQuery: ${ctx.query ?? ""}\nTags: ${ctx.tags ?? ""}\n\nCheck if thresholds are appropriate, if tags are correct, and if notification channels include #comms_alerts where relevant.`,
  },
  {
    id: "design-monitors",
    label: "Design Related Monitors",
    command: "",
    persona: "ritsuko",
    buildArgs: (ctx) =>
      `Based on this existing monitor, identify monitoring gaps for the same service and design additional monitors:\n\nMonitor: ${ctx.monitorName ?? ""}\nQuery: ${ctx.query ?? ""}\nTags: ${ctx.tags ?? ""}\n\nPropose monitors for error rates, latency, throughput, and deliverability as appropriate.`,
  },
];

export function getActionsForSource(source: ActionSource): AIAction[] {
  switch (source) {
    case "slack":
      return SLACK_ACTIONS;
    case "gitlab":
      return GITLAB_ACTIONS;
    case "linear":
      return LINEAR_ACTIONS;
    case "datadog":
      return DATADOG_ACTIONS;
  }
}
