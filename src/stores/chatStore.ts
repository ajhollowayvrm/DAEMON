import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// ── Types ──

export type ChatMessageRole = "user" | "agent" | "system";
export type ConversationStatus = "streaming" | "waiting" | "completed" | "failed";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  isStreaming: boolean;
}

export interface Conversation {
  id: string;
  personaId: string;
  messages: ChatMessage[];
  status: ConversationStatus;
}

// ── Helpers ──

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Store Interface ──

interface ChatState {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;

  startConversation: (taskId: string, personaId: string, prompt: string) => void;
  appendAgentChunk: (taskId: string, chunk: string) => void;
  finalizeAgentTurn: (taskId: string) => void;
  addUserMessage: (taskId: string, content: string) => void;
  markCompleted: (taskId: string) => void;
  markFailed: (taskId: string) => void;
  setActiveConversation: (id: string | null) => void;
  removeConversation: (id: string) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: {},
  activeConversationId: null,

  startConversation: (taskId, personaId, prompt) => {
    const conversation: Conversation = {
      id: taskId,
      personaId,
      messages: [
        {
          id: genId("msg"),
          role: "user",
          content: prompt,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        },
      ],
      status: "streaming",
    };
    set((s) => ({
      conversations: { ...s.conversations, [taskId]: conversation },
    }));
  },

  appendAgentChunk: (taskId, chunk) => {
    set((s) => {
      const conv = s.conversations[taskId];
      if (!conv) return s;

      const messages = [...conv.messages];
      const lastMsg = messages[messages.length - 1];

      // If the last message is a streaming agent message, append to it
      if (lastMsg && lastMsg.role === "agent" && lastMsg.isStreaming) {
        messages[messages.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + chunk,
        };
      } else {
        // Create a new streaming agent message
        messages.push({
          id: genId("msg"),
          role: "agent",
          content: chunk,
          timestamp: new Date().toISOString(),
          isStreaming: true,
        });
      }

      return {
        conversations: {
          ...s.conversations,
          [taskId]: { ...conv, messages },
        },
      };
    });
  },

  finalizeAgentTurn: (taskId) => {
    set((s) => {
      const conv = s.conversations[taskId];
      if (!conv) return s;

      const messages = conv.messages.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg,
      );

      return {
        conversations: {
          ...s.conversations,
          [taskId]: { ...conv, messages, status: "waiting" },
        },
      };
    });
  },

  addUserMessage: (taskId, content) => {
    const state = get();
    const conv = state.conversations[taskId];
    if (!conv) return;

    const userMsg: ChatMessage = {
      id: genId("msg"),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      isStreaming: false,
    };

    set((s) => ({
      conversations: {
        ...s.conversations,
        [taskId]: {
          ...conv,
          messages: [...conv.messages, userMsg],
          status: "streaming",
        },
      },
    }));

    // Set up a listener for the --resume response, then invoke.
    // The listener handles both streaming chunks and the done signal.
    // respond_to_agent blocks until the process completes, so both
    // the done event and the invoke resolution signal completion —
    // we use whichever fires first via a cleanup guard.
    let cleaned = false;
    let unlistenFn: (() => void) | null = null;

    const cleanup = (failed: boolean) => {
      if (cleaned) return;
      cleaned = true;
      unlistenFn?.();
      if (failed) {
        useChatStore.getState().markFailed(taskId);
      } else {
        useChatStore.getState().finalizeAgentTurn(taskId);
      }
    };

    listen<{ task_id: string; line: string; done: boolean }>(
      "agent-output",
      (event) => {
        if (event.payload.task_id !== taskId) return;
        if (event.payload.done) {
          cleanup(false);
          return;
        }
        useChatStore.getState().appendAgentChunk(taskId, event.payload.line);
      },
    ).then((unlisten) => {
      unlistenFn = unlisten;
      invoke("respond_to_agent", {
        taskId,
        questionId: null,
        response: content,
      })
        .then(() => cleanup(false))
        .catch((err) => {
          console.error("respond_to_agent failed:", err);
          cleanup(true);
        });
    }).catch((err) => {
      console.error("Failed to set up agent-output listener:", err);
      useChatStore.getState().markFailed(taskId);
    });
  },

  markCompleted: (taskId) => {
    set((s) => {
      const conv = s.conversations[taskId];
      if (!conv) return s;

      const messages = conv.messages.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg,
      );

      return {
        conversations: {
          ...s.conversations,
          [taskId]: { ...conv, messages, status: "completed" },
        },
      };
    });
  },

  markFailed: (taskId) => {
    set((s) => {
      const conv = s.conversations[taskId];
      if (!conv) return s;

      const messages = conv.messages.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg,
      );

      return {
        conversations: {
          ...s.conversations,
          [taskId]: { ...conv, messages, status: "failed" },
        },
      };
    });
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  removeConversation: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.conversations;
      return {
        conversations: rest,
        activeConversationId:
          s.activeConversationId === id ? null : s.activeConversationId,
      };
    }),
}));
