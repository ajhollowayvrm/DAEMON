import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AgentQuestion,
  MissionTask,
  PersonaRunStatus,
  SingleAgentRun,
  TimelineEntry,
} from "../config/personaTypes";
import { getPersonaById } from "../config/personas";
import { useAgentStore } from "./agentStore";
import { useChatStore } from "./chatStore";

interface AgentOutput {
  task_id: string;
  line: string;
  done: boolean;
}

// ── Constants ──

const QA_PERSONA_IDS = new Set(["mugen", "alucard"]);
const CODER_PERSONA_IDS = new Set(["spike", "pikachu"]);
const MAX_RETRIES = 2;
const MAX_HISTORY = 50;

// ── ID Generation (survives reload without collisions) ──

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Verdict Parser ──

function parseQAVerdict(output: string): "pass" | "fail" | "warn" | "unknown" {
  const verdictMatch = output.match(
    /###?\s*Verdict[\s\S]*?(FAIL|COMPROMISED|PASS|ALL\s*CLEAR|WARN)/i,
  );
  if (!verdictMatch) return "unknown"; // no verdict section found in QA output
  const verdict = verdictMatch[1].toUpperCase();
  if (verdict === "FAIL" || verdict === "COMPROMISED") return "fail";
  if (verdict === "WARN") return "warn";
  return "pass";
}

function findLastCoderIndex(personas: string[], beforeIndex: number): number {
  for (let j = beforeIndex - 1; j >= 0; j--) {
    if (CODER_PERSONA_IDS.has(personas[j])) return j;
  }
  return -1;
}

// ── Store Interface ──

interface PersonaState {
  squad: string[];
  activeMission: MissionTask | null;
  missionHistory: MissionTask[];
  activeSingleRun: SingleAgentRun | null;
  backgroundRuns: SingleAgentRun[];
  singleRunHistory: SingleAgentRun[];
  unseenCompletions: number;
  completedUnseen: SingleAgentRun[];
  pendingQuestions: AgentQuestion[];
  viewingMission: MissionTask | null;
  lastCompletedMission: MissionTask | null;

  // Squad management
  addToSquad: (personaId: string) => void;
  removeFromSquad: (personaId: string) => void;
  reorderSquad: (fromIndex: number, toIndex: number) => void;
  setSquad: (personaIds: string[]) => void;
  clearSquad: () => void;

  // Mission
  startMission: (description: string) => void;
  cancelMission: () => void;

  // Single agent (focused view)
  startSingleAgent: (prompt: string) => void;
  cancelSingleAgent: () => void;
  dismissSingleRun: () => void;

  // Background agent (runs without blocking the picker)
  launchAgent: (personaId: string, prompt: string) => string | undefined;
  cancelBackgroundAgent: (taskId: string) => void;

  // Notifications
  clearUnseenCompletions: () => void;
  dismissCompletedRun: (id: string) => void;

  // Questions
  answerQuestion: (questionId: string, response: string) => void;
  dismissQuestion: (questionId: string) => void;

  // Viewing completed mission timeline
  setViewingMission: (mission: MissionTask | null) => void;
  dismissLastCompletedMission: () => void;

  // History
  clearHistory: () => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set, get) => ({
      squad: [],
      activeMission: null,
      missionHistory: [],
      activeSingleRun: null,
      backgroundRuns: [],
      unseenCompletions: 0,
      completedUnseen: [],
      singleRunHistory: [],
      pendingQuestions: [],
      viewingMission: null,
      lastCompletedMission: null,

      addToSquad: (personaId) =>
        set((s) => {
          if (s.squad.includes(personaId)) return s;
          return { squad: [...s.squad, personaId] };
        }),

      removeFromSquad: (personaId) =>
        set((s) => {
          if (s.activeMission || s.activeSingleRun) return s; // guard during active runs
          return { squad: s.squad.filter((id) => id !== personaId) };
        }),

      reorderSquad: (fromIndex, toIndex) =>
        set((s) => {
          if (s.activeMission || s.activeSingleRun) return s; // guard during active runs
          const next = [...s.squad];
          const [item] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, item);
          return { squad: next };
        }),

      setSquad: (personaIds) =>
        set((s) => {
          if (s.activeMission || s.activeSingleRun) return s;
          // Deduplicate while preserving order
          const seen = new Set<string>();
          const deduped = personaIds.filter((id) => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          return { squad: deduped };
        }),

      clearSquad: () =>
        set((s) => {
          if (s.activeMission || s.activeSingleRun) return s;
          return { squad: [] };
        }),

      startMission: (description) => {
        const state = get();
        if (state.squad.length === 0 || state.activeMission || state.activeSingleRun) return;

        const missionId = genId("mission");
        const personaStatuses: Record<string, PersonaRunStatus> = {};
        const outputs: Record<string, string> = {};
        const timelineEntries: TimelineEntry[] = [];

        for (const pid of state.squad) {
          personaStatuses[pid] = "waiting";
          outputs[pid] = "";
          timelineEntries.push({
            id: pid,
            personaId: pid,
            status: "waiting",
            output: "",
            isRetry: false,
          });
        }

        const mission: MissionTask = {
          id: missionId,
          description,
          squad: { personas: [...state.squad] },
          status: "running",
          personaStatuses,
          outputs,
          timelineEntries,
          retries: {},
          startedAt: new Date().toISOString(),
        };

        set({ activeMission: mission });
        runPersonaChain(mission, description);
      },

      startSingleAgent: (prompt) => {
        const state = get();
        const runInProgress = state.activeSingleRun?.status === "running";
        if (state.squad.length !== 1 || state.activeMission || runInProgress) return;

        const personaId = state.squad[0];
        const run: SingleAgentRun = {
          id: genId("single"),
          personaId,
          prompt,
          status: "running",
          output: "",
          startedAt: new Date().toISOString(),
        };

        set({ activeSingleRun: run });
        runSingleAgent(run);
      },

      cancelMission: () => {
        const state = get();
        if (!state.activeMission) return;
        // Kill any running agent processes for this mission
        const activeEntry = state.activeMission.timelineEntries.find(
          (e) => e.status === "active",
        );
        if (activeEntry) {
          // Find matching agentStore tasks and kill them
          const agentTasks = useAgentStore.getState().tasks;
          for (const task of agentTasks) {
            if (task.status === "running" && task.id.startsWith(state.activeMission.id)) {
              invoke("kill_agent_command", { taskId: task.id }).catch(() => {});
              useAgentStore.getState().completeTask(task.id, "failed");
            }
          }
        }
        set((s) => {
          if (!s.activeMission) return s;
          const cancelled = {
            ...s.activeMission,
            status: "failed" as const,
            verdict: "fail" as const,
            completedAt: new Date().toISOString(),
          };
          return {
            activeMission: null,
            missionHistory: [cancelled, ...s.missionHistory].slice(0, MAX_HISTORY),
          };
        });
      },

      cancelSingleAgent: () => {
        const state = get();
        if (!state.activeSingleRun) return;
        // Kill the running interactive agent process
        invoke("kill_agent_command", { taskId: state.activeSingleRun.id }).catch(() => {});
        useChatStore.getState().markFailed(state.activeSingleRun.id);
        useAgentStore.getState().completeTask(state.activeSingleRun.id, "failed");
        set((s) => {
          if (!s.activeSingleRun) return s;
          const cancelled: SingleAgentRun = {
            ...s.activeSingleRun,
            status: "failed",
            completedAt: new Date().toISOString(),
          };
          return {
            activeSingleRun: null,
            singleRunHistory: [cancelled, ...s.singleRunHistory].slice(0, MAX_HISTORY),
          };
        });
      },

      dismissSingleRun: () => set({ activeSingleRun: null }),

      clearUnseenCompletions: () => set({ unseenCompletions: 0, completedUnseen: [] }),

      dismissCompletedRun: (id: string) =>
        set((s) => ({
          completedUnseen: s.completedUnseen.filter((r) => r.id !== id),
          unseenCompletions: Math.max(0, s.unseenCompletions - 1),
        })),

      answerQuestion: (questionId: string, response: string) => {
        const state = get();
        const question = state.pendingQuestions.find((q) => q.id === questionId);
        if (!question) return;
        invoke("respond_to_agent", {
          taskId: question.taskId,
          questionId,
          response,
        }).catch(() => {});
        set((s) => ({
          pendingQuestions: s.pendingQuestions.map((q) =>
            q.id === questionId ? { ...q, answered: true } : q,
          ),
        }));
      },

      dismissQuestion: (questionId: string) =>
        set((s) => ({
          pendingQuestions: s.pendingQuestions.filter((q) => q.id !== questionId),
        })),

      launchAgent: (personaId: string, prompt: string): string | undefined => {
        const persona = getPersonaById(personaId);
        if (!persona) return undefined;

        const run: SingleAgentRun = {
          id: genId("bg"),
          personaId,
          prompt,
          status: "running",
          output: "",
          startedAt: new Date().toISOString(),
        };

        set((s) => ({ backgroundRuns: [...s.backgroundRuns, run] }));
        runBackgroundAgent(run);
        return run.id;
      },

      cancelBackgroundAgent: (taskId: string) => {
        invoke("kill_agent_command", { taskId }).catch(() => {});
        useChatStore.getState().markFailed(taskId);
        useAgentStore.getState().completeTask(taskId, "failed");
        set((s) => {
          const run = s.backgroundRuns.find((r) => r.id === taskId);
          if (!run) return s;
          const cancelled: SingleAgentRun = {
            ...run,
            status: "failed",
            completedAt: new Date().toISOString(),
          };
          return {
            backgroundRuns: s.backgroundRuns.filter((r) => r.id !== taskId),
            singleRunHistory: [cancelled, ...s.singleRunHistory].slice(0, MAX_HISTORY),
          };
        });
      },

      setViewingMission: (mission) => set({ viewingMission: mission }),
      dismissLastCompletedMission: () => set({ lastCompletedMission: null }),

      clearHistory: () => set({ missionHistory: [], singleRunHistory: [] }),
    }),
    {
      name: "daemon-missions",
      partialize: (state) => ({
        missionHistory: state.missionHistory.slice(0, MAX_HISTORY),
        singleRunHistory: state.singleRunHistory.slice(0, MAX_HISTORY),
      }),
    },
  ),
);

// ── Agent Question Listener ──
// Wire up a persistent listener for agent-question events emitted by the Rust
// backend. When received, find the persona associated with the task and add a
// pending question to the store.

interface AgentQuestionPayload {
  task_id: string;
  question: string;
}

listen<AgentQuestionPayload>("agent-question", (event) => {
  const { task_id, question } = event.payload;
  const state = usePersonaStore.getState();

  // Resolve persona from whichever run owns this task_id
  let personaId: string | undefined;

  // Check background runs
  const bgRun = state.backgroundRuns.find((r) => r.id === task_id);
  if (bgRun) personaId = bgRun.personaId;

  // Check focused single run
  if (!personaId && state.activeSingleRun?.id === task_id) {
    personaId = state.activeSingleRun.personaId;
  }

  // Check active mission timeline entries
  // Mission task IDs are formatted as `${mission.id}-${personaId}-${Date.now()}`
  // so matching by mission ID prefix is sufficient to find the active persona.
  if (!personaId && state.activeMission) {
    const missionId = state.activeMission.id;
    if (task_id.startsWith(missionId)) {
      const activeEntry = state.activeMission.timelineEntries.find(
        (e) => e.status === "active",
      );
      if (activeEntry) personaId = activeEntry.personaId;
    }
  }

  if (!personaId) return;

  const newQuestion: AgentQuestion = {
    id: genId("q"),
    taskId: task_id,
    personaId,
    question,
    timestamp: new Date().toISOString(),
    answered: false,
  };

  usePersonaStore.setState((s) => ({
    pendingQuestions: [...s.pendingQuestions, newQuestion],
  }));
}).catch(() => {});

// ── Cancellation Check ──

function isMissionCancelled(): boolean {
  return usePersonaStore.getState().activeMission === null;
}

// ── Turn Complete Listener ──

interface AgentTurnCompletePayload {
  task_id: string;
}

listen<AgentTurnCompletePayload>("agent-turn-complete", (event) => {
  useChatStore.getState().finalizeAgentTurn(event.payload.task_id);
}).catch(() => {});

// ── Single Agent Runner ──

async function runSingleAgent(run: SingleAgentRun) {
  const persona = getPersonaById(run.personaId);
  if (!persona) return;

  let output = "";

  // Initialize chat conversation
  useChatStore.getState().startConversation(run.id, run.personaId, run.prompt);

  // Register in agentStore so TerminalDrawer can show the live stream
  useAgentStore.getState().addTask({
    id: run.id,
    command: `[${persona.name}]`,
    args: run.prompt.slice(0, 80),
    output: [],
    status: "running",
  }, { suppressDrawer: true });

  // Await listener registration before invoking to avoid missing early events
  const unlisten = await listen<AgentOutput>("agent-output", (event) => {
    if (event.payload.task_id === run.id) {
      if (event.payload.done) return;
      output += event.payload.line;
      usePersonaStore.setState((s) => ({
        activeSingleRun: s.activeSingleRun
          ? { ...s.activeSingleRun, output }
          : null,
      }));
      // Feed into chat store
      useChatStore.getState().appendAgentChunk(run.id, event.payload.line);
    }
  });

  let status: "completed" | "failed" = "completed";
  let error: string | undefined;
  try {
    // run_interactive_agent now blocks until process completes (same as run_agent_command)
    await invoke("run_interactive_agent", {
      taskId: run.id,
      command: "",
      args: run.prompt,
      options: {
        model: persona.model ?? "sonnet",
        systemPrompt: persona.systemPrompt,
        allowedTools: persona.allowedTools ?? null,
        deniedTools: persona.deniedTools ?? null,
        maxBudgetUsd: persona.maxBudgetUsd ?? (persona.model === "opus" ? 2.0 : persona.model === "haiku" ? 0.5 : 1.0),
        disableSlashCommands: !persona.skills || persona.skills.length === 0,
      },
    });
  } catch (e) {
    error = String(e);
    status = "failed";
  }

  unlisten();
  useAgentStore.getState().completeTask(run.id, status === "failed" ? "failed" : "completed");

  if (status === "failed") {
    useChatStore.getState().markFailed(run.id);
  } else {
    // Use finalizeAgentTurn so the conversation stays in "waiting" state,
    // allowing follow-up messages via --resume
    useChatStore.getState().finalizeAgentTurn(run.id);
  }

  const completedRun: SingleAgentRun = {
    ...run,
    output,
    error,
    status,
    completedAt: new Date().toISOString(),
  };

  // Keep the completed run visible — user dismisses it manually
  usePersonaStore.setState((s) => ({
    activeSingleRun: completedRun,
    singleRunHistory: [completedRun, ...s.singleRunHistory].slice(0, MAX_HISTORY),
  }));
}

// ── Background Agent Runner (non-blocking, parallel) ──

async function runBackgroundAgent(run: SingleAgentRun) {
  const persona = getPersonaById(run.personaId);
  if (!persona) return;

  let output = "";
  let error: string | undefined;

  // Initialize chat conversation
  useChatStore.getState().startConversation(run.id, run.personaId, run.prompt);

  useAgentStore.getState().addTask({
    id: run.id,
    command: `[${persona.name}]`,
    args: run.prompt.slice(0, 80),
    output: [],
    status: "running",
  }, { suppressDrawer: true });

  const unlisten = await listen<AgentOutput>("agent-output", (event) => {
    if (event.payload.task_id === run.id) {
      if (event.payload.done) return;
      output += event.payload.line;
      usePersonaStore.setState((s) => ({
        backgroundRuns: s.backgroundRuns.map((r) =>
          r.id === run.id ? { ...r, output } : r,
        ),
      }));
      useChatStore.getState().appendAgentChunk(run.id, event.payload.line);
    }
  });

  let status: "completed" | "failed" = "completed";
  try {
    await invoke("run_interactive_agent", {
      taskId: run.id,
      command: "",
      args: run.prompt,
      options: {
        model: persona.model ?? "sonnet",
        systemPrompt: persona.systemPrompt,
        allowedTools: persona.allowedTools ?? null,
        deniedTools: persona.deniedTools ?? null,
        maxBudgetUsd: persona.maxBudgetUsd ?? (persona.model === "opus" ? 2.0 : persona.model === "haiku" ? 0.5 : 1.0),
        disableSlashCommands: !persona.skills || persona.skills.length === 0,
      },
    });
  } catch (e) {
    error = String(e);
    status = "failed";
  }

  unlisten();
  useAgentStore.getState().completeTask(run.id, status === "failed" ? "failed" : "completed");

  if (status === "failed") {
    useChatStore.getState().markFailed(run.id);
  } else {
    useChatStore.getState().finalizeAgentTurn(run.id);
  }

  const completedRun: SingleAgentRun = {
    ...run,
    output,
    error,
    status,
    completedAt: new Date().toISOString(),
  };

  usePersonaStore.setState((s) => ({
    backgroundRuns: s.backgroundRuns.filter((r) => r.id !== run.id),
    singleRunHistory: [completedRun, ...s.singleRunHistory].slice(0, MAX_HISTORY),
    unseenCompletions: s.unseenCompletions + 1,
    completedUnseen: [...s.completedUnseen, completedRun],
  }));
}

// ── Mission Chain Runner (with conditional retry) ──

async function runPersonaChain(mission: MissionTask, description: string) {
  const personas = mission.squad.personas;
  let previousOutput = "";

  for (let i = 0; i < personas.length; i++) {
    // Check if mission was cancelled
    if (isMissionCancelled()) return;

    const personaId = personas[i];
    const persona = getPersonaById(personaId);
    if (!persona) continue;

    const entryId = personaId;

    // Mark persona as active
    updateMissionState(personaId, entryId, "active", "");

    // Build user prompt
    const taskId = `${mission.id}-${personaId}-${Date.now()}`;
    let prompt = `## Task\n${description}`;
    if (previousOutput) {
      // Truncate to last 8000 chars to avoid blowing context/budget for downstream agents
      const truncated = previousOutput.length > 8000
        ? `...(truncated)\n${previousOutput.slice(-8000)}`
        : previousOutput;
      prompt += `\n\n## Previous Agent Output\n${truncated}`;
    }

    // Run the agent and collect output
    const output = await runPersonaAgent(taskId, persona, prompt, entryId);
    if (isMissionCancelled()) return;

    previousOutput = output;

    // Mark persona as done
    updateMissionState(personaId, entryId, "done", output);

    // ── Conditional Routing: QA Failure → Retry (inner loop) ──
    if (QA_PERSONA_IDS.has(personaId)) {
      const coderIndex = findLastCoderIndex(personas, i);
      if (coderIndex >= 0) {
        const coderId = personas[coderIndex];
        const coderPersona = getPersonaById(coderId);

        if (coderPersona) {
          let qaOutput = output;
          let retryCount = 0;

          while (
            retryCount < MAX_RETRIES &&
            parseQAVerdict(qaOutput) === "fail"
          ) {
            if (isMissionCancelled()) return;
            retryCount++;

            // Update retry count in store
            const retryKey = `${personaId}-retry`;
            usePersonaStore.setState((s) => ({
              activeMission: s.activeMission
                ? {
                    ...s.activeMission,
                    retries: { ...s.activeMission.retries, [retryKey]: retryCount },
                  }
                : null,
            }));

            // ── Re-run Coder with QA feedback ──
            const coderRetryId = `${coderId}-retry-${retryCount}`;
            const coderRetryTaskId = `${mission.id}-${coderRetryId}-${Date.now()}`;

            addTimelineEntry({
              id: coderRetryId,
              personaId: coderId,
              status: "active",
              output: "",
              isRetry: true,
              retryNumber: retryCount,
              triggeredBy: personaId,
            });

            const coderPrompt =
              `## Task\n${description}\n\n## QA Failure Feedback\nThe QA agent found issues. Fix them:\n\n${qaOutput}`;
            const coderOutput = await runPersonaAgent(
              coderRetryTaskId,
              coderPersona,
              coderPrompt,
              coderRetryId,
            );
            if (isMissionCancelled()) return;

            updateTimelineEntry(coderRetryId, "done", coderOutput);

            // ── Re-run QA agent ──
            const qaRetryId = `${personaId}-retry-${retryCount}`;
            const qaRetryTaskId = `${mission.id}-${qaRetryId}-${Date.now()}`;

            addTimelineEntry({
              id: qaRetryId,
              personaId,
              status: "active",
              output: "",
              isRetry: true,
              retryNumber: retryCount,
              triggeredBy: personaId,
            });

            const qaRetryPrompt =
              `## Task\n${description}\n\n## Previous Agent Output\n${coderOutput}`;
            qaOutput = await runPersonaAgent(
              qaRetryTaskId,
              persona,
              qaRetryPrompt,
              qaRetryId,
            );
            if (isMissionCancelled()) return;

            updateTimelineEntry(qaRetryId, "done", qaOutput);
          }

          // Update previousOutput with final QA result
          previousOutput = qaOutput;
        }
      }
    }
  }

  // ── Mission Complete — determine verdict ──
  const finalMission = usePersonaStore.getState().activeMission;
  if (!finalMission) return; // was cancelled

  const lastQAEntry = finalMission.timelineEntries
    .filter((e) => QA_PERSONA_IDS.has(e.personaId) && e.output)
    .pop();
  const verdict = lastQAEntry ? parseQAVerdict(lastQAEntry.output) : "pass";

  // ── Commit & Push (only if verdict is not "fail") ──
  const hasCoder = personas.some((id) => CODER_PERSONA_IDS.has(id));
  if (hasCoder && verdict !== "fail" && !isMissionCancelled()) {
    const commitEntryId = "_commit";
    addTimelineEntry({
      id: commitEntryId,
      personaId: "_commit",
      status: "active",
      output: "",
      isRetry: false,
    });

    const commitTaskId = `${mission.id}-commit-${Date.now()}`;
    const commitResult = await runCommitStep(commitTaskId, description, previousOutput, commitEntryId);
    if (!isMissionCancelled()) {
      updateTimelineEntry(commitEntryId, commitResult.failed ? "failed" : "done", commitResult.output);
    }
  }

  // ── Finalize ──
  usePersonaStore.setState((s) => {
    const completed = s.activeMission
      ? {
          ...s.activeMission,
          status: "completed" as const,
          verdict,
          completedAt: new Date().toISOString(),
        }
      : null;
    return {
      activeMission: null,
      lastCompletedMission: completed,
      missionHistory: completed
        ? [completed, ...s.missionHistory].slice(0, MAX_HISTORY)
        : s.missionHistory,
    };
  });
}

// ── Helpers ──

async function runPersonaAgent(
  taskId: string,
  persona: NonNullable<ReturnType<typeof getPersonaById>>,
  prompt: string,
  entryId: string,
): Promise<string> {
  let output = "";
  let failed = false;

  // Register in agentStore so TerminalDrawer can show the live stream
  useAgentStore.getState().addTask({
    id: taskId,
    command: `[${persona.name}]`,
    args: persona.role,
    output: [],
    status: "running",
  }, { suppressDrawer: true });

  // Await listener registration before invoking to avoid missing early events
  console.log(`[mission] runPersonaAgent listener registered for taskId=${taskId}, entryId=${entryId}`);
  const unlisten = await listen<AgentOutput>("agent-output", (event) => {
    if (event.payload.task_id !== taskId) return;
    if (event.payload.done) return;
    output += event.payload.line + "\n";
    updateTimelineEntry(entryId, "active", output);
  });

  try {
    console.log(`[mission] invoking run_agent_command for ${persona.name}`);
    await invoke("run_agent_command", {
      taskId,
      command: "",
      args: prompt,
      options: {
        model: persona.model ?? "sonnet",
        systemPrompt: persona.systemPrompt,
        allowedTools: persona.allowedTools ?? null,
        deniedTools: persona.deniedTools ?? null,
        maxBudgetUsd: persona.maxBudgetUsd ?? (persona.model === "opus" ? 2.0 : persona.model === "haiku" ? 0.5 : 1.0),
        disableSlashCommands: !persona.skills || persona.skills.length === 0,
      },
    });
  } catch (e) {
    output += `\nError: ${e}`;
    failed = true;
  }

  unlisten();
  console.log(`[mission] ${persona.name} done. output length=${output.length}, failed=${failed}`);
  useAgentStore.getState().completeTask(taskId, failed ? "failed" : "completed");
  return output;
}

function updateMissionState(
  personaId: string,
  entryId: string,
  status: PersonaRunStatus,
  output: string,
) {
  usePersonaStore.setState((s) => {
    if (!s.activeMission) return {};
    return {
      activeMission: {
        ...s.activeMission,
        personaStatuses: { ...s.activeMission.personaStatuses, [personaId]: status },
        outputs: { ...s.activeMission.outputs, [personaId]: output },
        timelineEntries: s.activeMission.timelineEntries.map((e) =>
          e.id === entryId ? { ...e, status, output } : e,
        ),
      },
    };
  });
}

function updateTimelineEntry(entryId: string, status: PersonaRunStatus, output: string) {
  usePersonaStore.setState((s) => {
    if (!s.activeMission) return {};
    return {
      activeMission: {
        ...s.activeMission,
        timelineEntries: s.activeMission.timelineEntries.map((e) =>
          e.id === entryId ? { ...e, status, output } : e,
        ),
      },
    };
  });
}

function addTimelineEntry(entry: TimelineEntry) {
  usePersonaStore.setState((s) => {
    if (!s.activeMission) return {};
    return {
      activeMission: {
        ...s.activeMission,
        timelineEntries: [...s.activeMission.timelineEntries, entry],
      },
    };
  });
}

const COMMIT_SYSTEM_PROMPT = `You are a commit-and-push automation agent. Your only job is to commit changed files and push them to the remote branch.

## Rules
- Run \`git status\` first to see what changed.
- If there are no changes to commit, say "No changes to commit" and stop.
- Stage ONLY files relevant to the task. Never stage .env, credentials, or unrelated files.
- Write a conventional commit message: \`type(scope): description\` based on the task description and changes.
- End the commit message body with: Co-Authored-By: Daemon Mission <noreply@daemon.app>
- Push to the current branch (never force-push, never push to main/master).
- If the push fails, report the error. Do NOT retry.
- Output a brief summary of what was committed and pushed.`;

async function runCommitStep(
  taskId: string,
  description: string,
  previousOutput: string,
  entryId: string,
): Promise<{ output: string; failed: boolean }> {
  let output = "";
  let failed = false;

  useAgentStore.getState().addTask({
    id: taskId,
    command: "[Commit & Push]",
    args: "Committing mission changes",
    output: [],
    status: "running",
  }, { suppressDrawer: true });

  const unlisten = await listen<AgentOutput>("agent-output", (event) => {
    if (event.payload.task_id !== taskId) return;
    if (event.payload.done) return;
    output += event.payload.line + "\n";
    updateTimelineEntry(entryId, "active", output);
  });

  const prompt = `## Task\nCommit and push the code changes from this mission.\n\n## Mission Description\n${description}\n\n## What Was Done\n${previousOutput.slice(-3000)}`;

  try {
    await invoke("run_agent_command", {
      taskId,
      command: "",
      args: prompt,
      options: {
        model: "haiku",
        systemPrompt: COMMIT_SYSTEM_PROMPT,
        allowedTools: ["Bash", "Read", "Glob", "Grep"],
        deniedTools: ["Edit", "Write", "NotebookEdit"],
        maxBudgetUsd: 0.25,
        disableSlashCommands: true,
      },
    });
  } catch (e) {
    output += `\nError: ${e}`;
    failed = true;
  }

  unlisten();
  useAgentStore.getState().completeTask(taskId, failed ? "failed" : "completed");
  return { output, failed };
}
