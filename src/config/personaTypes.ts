export type AgentModel = "opus" | "sonnet" | "haiku";

export interface PersonaConfig {
  id: string;
  name: string;
  character: string;
  franchise: string;
  role: string;
  color: string;
  icon: string;
  avatar?: string;
  model: AgentModel;
  skills?: string[];
  systemPrompt: string;
  allowedTools?: string[];
  deniedTools?: string[];
  maxBudgetUsd?: number;
  acceptQuips?: string[];
}

// ── Squad Presets ──

export interface SquadPreset {
  id: string;
  label: string;
  description: string;
  personas: string[];
}

// ── Missions ──

export interface Squad {
  personas: string[]; // persona IDs in execution order
}

export type PersonaRunStatus = "waiting" | "active" | "done" | "failed";

export interface TimelineEntry {
  id: string;
  personaId: string;
  status: PersonaRunStatus;
  output: string;
  isRetry: boolean;
  retryNumber?: number;
  triggeredBy?: string;
}

export interface MissionTask {
  id: string;
  description: string;
  squad: Squad;
  status: "idle" | "running" | "completed" | "failed";
  personaStatuses: Record<string, PersonaRunStatus>;
  outputs: Record<string, string>;
  timelineEntries: TimelineEntry[];
  retries: Record<string, number>;
  verdict?: "pass" | "fail" | "warn" | "unknown";
  startedAt?: string;
  completedAt?: string;
}

// ── Single Agent ──

export interface SingleAgentRun {
  id: string;
  personaId: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  output: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ── Agent Questions ──

export interface AgentQuestion {
  id: string;
  taskId: string;
  personaId: string;
  question: string;
  timestamp: string;
  answered: boolean;
}
