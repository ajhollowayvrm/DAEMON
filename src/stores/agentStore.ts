import { create } from "zustand";

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export interface RunningTask {
  id: string;
  command: string;
  args: string;
  contextSource?: "slack" | "gitlab" | "linear" | "datadog";
  contextData?: Record<string, unknown>;
  output: string[];
  status: TaskStatus;
  ptyId?: string;
}

interface AgentState {
  tasks: RunningTask[];
  activeTaskId: string | null;
  terminalDrawerOpen: boolean;
  addTask: (task: RunningTask, opts?: { suppressDrawer?: boolean }) => void;
  updateTaskOutput: (taskId: string, line: string) => void;
  completeTask: (taskId: string, status?: TaskStatus) => void;
  setActiveTask: (taskId: string | null) => void;
  toggleTerminalDrawer: () => void;
  openTerminalDrawer: () => void;
  closeTerminalDrawer: () => void;
}

const MAX_TASKS = 20;

export const useAgentStore = create<AgentState>((set) => ({
  tasks: [],
  activeTaskId: null,
  terminalDrawerOpen: false,

  addTask: (task, opts) =>
    set((s) => ({
      tasks: [task, ...s.tasks].slice(0, MAX_TASKS),
      activeTaskId: task.id,
      terminalDrawerOpen: opts?.suppressDrawer ? s.terminalDrawerOpen : true,
    })),

  updateTaskOutput: (taskId, line) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, output: [...t.output, line] } : t,
      ),
    })),

  completeTask: (taskId, status = "completed") =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status } : t,
      ),
    })),

  setActiveTask: (taskId) => set({ activeTaskId: taskId }),

  toggleTerminalDrawer: () =>
    set((s) => ({ terminalDrawerOpen: !s.terminalDrawerOpen })),

  openTerminalDrawer: () => set({ terminalDrawerOpen: true }),

  closeTerminalDrawer: () => set({ terminalDrawerOpen: false }),
}));
