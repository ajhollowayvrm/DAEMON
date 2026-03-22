import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Square, Send, RotateCcw, Forward, Target, Link, CheckSquare, StickyNote, MessageSquare, GitMerge, LayoutList, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import { useChatStore } from "../../stores/chatStore";
import { usePersonaStore } from "../../stores/personaStore";
import { useFocusStore } from "../../stores/focusStore";
import type { FocusSource } from "../../stores/focusStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { getPersonaById, DEFAULT_PERSONAS } from "../../config/personas";
import { invoke } from "@tauri-apps/api/core";
import styles from "./AgentChat.module.css";

// ── Handoff Detection ──
// Scan agent messages for mentions of other agent names to suggest handoffs.

function detectHandoffs(messages: { role: string; content: string }[], currentPersonaId: string): string[] {
  const lastAgentMsg = [...messages].reverse().find((m) => m.role === "agent");
  if (!lastAgentMsg) return [];

  const mentioned = new Set<string>();
  for (const p of DEFAULT_PERSONAS) {
    if (p.id === currentPersonaId) continue;
    // Match the persona name as a whole word (case-insensitive)
    const regex = new RegExp(`\\b${p.name}\\b`, "i");
    if (regex.test(lastAgentMsg.content)) {
      mentioned.add(p.id);
    }
  }
  return [...mentioned];
}

// ── Animation Variants ──

const springTransition = { type: "spring" as const, stiffness: 300, damping: 25 };
const snappySpring = { type: "spring" as const, stiffness: 500, damping: 30 };

const containerVariants = {
  initial: { opacity: 0, y: 30, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...springTransition, staggerChildren: 0.06 },
  },
  exit: { opacity: 0, y: -15, scale: 0.98, transition: { duration: 0.15 } },
};

const headerChildVariants = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
};

const userMessageVariants = {
  initial: { opacity: 0, x: 30, scale: 0.95 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { ...snappySpring, delay: 0.02 },
  },
};

const agentMessageVariants = {
  initial: { opacity: 0, x: -20, scale: 0.97 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: springTransition,
  },
};

const thinkingVariants = {
  initial: { opacity: 0, scale: 0.8, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...springTransition, delay: 0.1 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -5,
    transition: { duration: 0.15 },
  },
};

const inputBarVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { ...springTransition, delay: 0.2 },
  },
};

const stopBtnVariants = {
  initial: { opacity: 0, scale: 0, width: 0, marginLeft: 0 },
  animate: {
    opacity: 1,
    scale: 1,
    width: "auto",
    marginLeft: "auto",
    transition: snappySpring,
  },
  exit: {
    opacity: 0,
    scale: 0,
    width: 0,
    marginLeft: 0,
    transition: { duration: 0.15 },
  },
};

// ── Focus Item Context Banner ──

const SOURCE_ICONS: Record<FocusSource, typeof MessageSquare> = {
  slack: MessageSquare,
  gitlab: GitMerge,
  linear: LayoutList,
  datadog: Activity,
  todos: CheckSquare,
};

function FocusItemBanner({ taskId }: { taskId: string }) {
  const focusItem = useFocusStore((s) => s.getItemByTaskId(taskId));
  const openItem = useFocusStore((s) => s.openItem);
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const [showPreview, setShowPreview] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [previewPos, setPreviewPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  if (!focusItem) return null;

  const doneCount = focusItem.tasks.filter((t) => t.done).length;

  const handleClick = () => {
    setActivePanel("hub");
    openItem(focusItem.id);
  };

  const handleMouseEnter = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPreviewPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setShowPreview(true);
  };

  return (
    <div
      className={styles.focusBanner}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowPreview(false)}
    >
      <button ref={btnRef} className={styles.focusBannerBtn} onClick={handleClick}>
        <Target size={10} className={styles.focusBannerIcon} />
        <span className={styles.focusBannerTitle}>{focusItem.title}</span>
      </button>

      {/* Hover preview — fixed position */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            className={styles.focusPreview}
            style={{ top: previewPos.top, right: previewPos.right }}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.focusPreviewTitle}>{focusItem.title}</div>

            {focusItem.links.length > 0 && (
              <div className={styles.focusPreviewSection}>
                <span className={styles.focusPreviewLabel}><Link size={8} /> Links</span>
                {focusItem.links.slice(0, 5).map((link) => {
                  const Icon = SOURCE_ICONS[link.source] ?? Link;
                  return (
                    <div key={link.id} className={styles.focusPreviewLink}>
                      <Icon size={9} className={styles[`focusPreviewIcon_${link.source}`]} />
                      <span>{link.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {focusItem.tasks.length > 0 && (
              <div className={styles.focusPreviewSection}>
                <span className={styles.focusPreviewLabel}><CheckSquare size={8} /> Tasks {doneCount}/{focusItem.tasks.length}</span>
                {focusItem.tasks.slice(0, 4).map((task) => (
                  <div key={task.id} className={`${styles.focusPreviewTask} ${task.done ? styles.focusPreviewTaskDone : ""}`}>
                    <span>{task.done ? "✓" : "○"}</span>
                    <span>{task.title}</span>
                  </div>
                ))}
              </div>
            )}

            {focusItem.notes.length > 0 && (
              <div className={styles.focusPreviewSection}>
                <span className={styles.focusPreviewLabel}><StickyNote size={8} /> Notes</span>
                {focusItem.notes.slice(0, 2).map((note) => (
                  <div key={note.id} className={styles.focusPreviewNote}>
                    {note.text.slice(0, 60)}{note.text.length > 60 ? "…" : ""}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Component ──

interface AgentChatProps {
  conversationId: string;
  onBack: () => void;
}

export function AgentChat({ conversationId, onBack }: AgentChatProps) {
  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const [inputReady, setInputReady] = useState(false);
  const prevStatus = useRef(conversation?.status);

  const persona = conversation ? getPersonaById(conversation.personaId) : null;

  // Flash the input bar when status transitions to "waiting"
  useEffect(() => {
    if (
      conversation?.status === "waiting" &&
      prevStatus.current === "streaming"
    ) {
      setInputReady(true);
      const timer = setTimeout(() => setInputReady(false), 600);
      return () => clearTimeout(timer);
    }
    prevStatus.current = conversation?.status;
  }, [conversation?.status]);

  // Auto-scroll to bottom on new content unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    userScrolledUp.current = !isNearBottom;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !conversation) return;
    if (
      conversation.status !== "waiting" &&
      conversation.status !== "completed"
    )
      return;
    addUserMessage(conversationId, trimmed);
    setInput("");
    userScrolledUp.current = false;
  }, [input, conversation, conversationId, addUserMessage]);

  const handleStop = useCallback(() => {
    // Kill the process but don't dismiss the view — let the done signal
    // mark it as failed so the retry button appears
    invoke("kill_agent_command", { taskId: conversationId }).catch(() => {});
    useChatStore.getState().markFailed(conversationId);
  }, [conversationId]);

  const handleRetry = useCallback(() => {
    if (!conversation || !persona) return;
    // Get the original prompt from the first user message
    const firstUserMsg = conversation.messages.find((m) => m.role === "user");
    if (!firstUserMsg) return;
    const prompt = firstUserMsg.content;

    // Clean up current conversation
    useChatStore.getState().removeConversation(conversationId);
    usePersonaStore.getState().dismissSingleRun();

    // Re-launch with the same persona and prompt
    setTimeout(() => {
      usePersonaStore.getState().startSingleAgent(prompt);
    }, 100);
  }, [conversation, persona, conversationId]);

  const [showAllAgents, setShowAllAgents] = useState(false);

  const handleHandoff = useCallback((targetPersonaId: string, additionalContext?: string) => {
    if (!conversation) return;
    // Build context from the conversation
    const summary = conversation.messages
      .map((m) => `[${m.role === "user" ? "User" : persona?.name ?? "Agent"}]: ${m.content}`)
      .join("\n\n");
    const handoffPrompt = additionalContext
      ? `${additionalContext}\n\n--- Previous conversation with ${persona?.name ?? "another agent"} ---\n\n${summary}`
      : `Continue from ${persona?.name ?? "another agent"}'s work:\n\n--- Previous conversation ---\n\n${summary}`;

    // Launch the target agent with the bundled context
    usePersonaStore.getState().launchAgent(targetPersonaId, handoffPrompt);
    setShowAllAgents(false);
  }, [conversation, persona]);

  if (!conversation || !persona) return null;

  const canSend =
    conversation.status === "waiting" || conversation.status === "completed";
  const isStreaming = conversation.status === "streaming";
  const isDone =
    conversation.status === "completed" || conversation.status === "failed";
  const hasStreamingMsg = conversation.messages.some(
    (m) => m.role === "agent" && m.isStreaming,
  );

  // Detect suggested handoffs from agent's last message
  const suggestedHandoffs = isDone || conversation.status === "waiting"
    ? detectHandoffs(conversation.messages, conversation.personaId)
    : [];

  return (
    <motion.div
      className={styles.chatContainer}
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ "--persona-color": persona.color } as React.CSSProperties}
    >
      {/* Neon accent line */}
      <div className={styles.accentLine} />

      {/* Header — combined with Focus Item context */}
      <motion.div className={styles.header} variants={headerChildVariants}>
        <motion.button
          className={styles.backBtn}
          onClick={onBack}
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.9 }}
          transition={snappySpring}
        >
          <ArrowLeft size={14} />
        </motion.button>

        {persona.avatar && (
          <motion.img
            src={persona.avatar}
            alt={persona.name}
            className={`${styles.avatar} ${isStreaming ? styles.avatarStreaming : ""}`}
            layoutId={`chat-avatar-${persona.id}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...snappySpring, delay: 0.05 }}
          />
        )}

        <motion.div
          className={styles.headerInfo}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springTransition, delay: 0.08 }}
        >
          <span
            className={styles.personaName}
            style={{ color: persona.color }}
          >
            {persona.name}
          </span>
          <span className={styles.personaRole}>{persona.role}</span>
        </motion.div>

        <motion.span
          className={`${styles.modelBadge} ${
            persona.model === "opus"
              ? styles.modelOpus
              : persona.model === "haiku"
                ? styles.modelHaiku
                : styles.modelSonnet
          }`}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...snappySpring, delay: 0.12 }}
        >
          {persona.model}
        </motion.span>

        <motion.span
          className={`${styles.statusDot} ${
            isStreaming
              ? styles.statusStreaming
              : conversation.status === "waiting"
                ? styles.statusWaiting
                : conversation.status === "completed"
                  ? styles.statusCompleted
                  : styles.statusFailed
          }`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...snappySpring, delay: 0.15 }}
          layout
        />

        <AnimatePresence>
          {!isDone && (
            <motion.button
              className={styles.stopBtn}
              onClick={handleStop}
              variants={stopBtnVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              whileHover={{ scale: 1.05, boxShadow: "0 0 12px rgba(255,23,68,0.3)" }}
              whileTap={{ scale: 0.92 }}
            >
              <Square size={10} />
              Stop
            </motion.button>
          )}
          {isDone && (
            <motion.button
              className={styles.retryBtn}
              onClick={handleRetry}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05, boxShadow: `0 0 12px ${persona.color}40` }}
              whileTap={{ scale: 0.92 }}
              transition={snappySpring}
            >
              <RotateCcw size={10} />
              Retry
            </motion.button>
          )}
        </AnimatePresence>

        {/* Focus Item — inline in header */}
        <FocusItemBanner taskId={conversationId} />
      </motion.div>

      {/* Messages */}
      <div
        className={styles.messages}
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        <div className={styles.messagesFadeTop} />

        <AnimatePresence initial={false}>
          {conversation.messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <motion.div
                key={msg.id}
                className={`${styles.message} ${
                  isUser ? styles.messageUser : styles.messageAgent
                } ${msg.isStreaming ? styles.messageStreaming : ""}`}
                variants={isUser ? userMessageVariants : agentMessageVariants}
                initial="initial"
                animate="animate"
                layout="position"
                transition={springTransition}
              >
                <motion.div
                  className={styles.messageLabel}
                  initial={{ opacity: 0, x: isUser ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                >
                  {isUser ? "YOU" : persona.name.toUpperCase()}
                  {msg.isStreaming && (
                    <span className={styles.streamingBadge}>LIVE</span>
                  )}
                </motion.div>
                <motion.div
                  className={styles.messageContent}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.08, duration: 0.25 }}
                >
                  {msg.role === "agent" ? (
                    <Markdown>{msg.content}</Markdown>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  {msg.isStreaming && (
                    <span className={styles.streamingCursor} />
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Thinking indicator — shown when streaming but no agent content yet */}
        <AnimatePresence>
          {isStreaming && !hasStreamingMsg && (
            <motion.div
              className={styles.thinking}
              variants={thinkingVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className={styles.thinkingDots}>
                <motion.span
                  animate={{ scale: [0.6, 1, 0.6], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.span
                  animate={{ scale: [0.6, 1, 0.6], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                />
                <motion.span
                  animate={{ scale: [0.6, 1, 0.6], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />
              </div>
              <motion.span
                className={styles.thinkingText}
                animate={{ opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {persona.name} is thinking...
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* "Waiting for your input" nudge */}
        <AnimatePresence>
          {conversation.status === "waiting" && (
            <motion.div
              className={styles.waitingNudge}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={springTransition}
            >
              <span className={styles.waitingNudgeDot} />
              <span>Waiting for your response</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />

        <div className={styles.messagesFadeBottom} />
      </div>

      {/* Input */}
      <motion.div
        className={`${styles.inputBar} ${inputReady ? styles.inputBarReady : ""}`}
        variants={inputBarVariants}
        initial="initial"
        animate="animate"
      >
        <motion.textarea
          className={styles.inputArea}
          placeholder={
            canSend
              ? `Ask ${persona.name} a follow-up...`
              : isStreaming
                ? `${persona.name} is responding...`
                : "Conversation ended"
          }
          value={input}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={!canSend}
          rows={1}
          animate={
            inputReady
              ? {
                  borderColor: [
                    "rgba(176,38,255,0.2)",
                    persona.color,
                    "rgba(176,38,255,0.2)",
                  ],
                  boxShadow: [
                    "0 0 0px transparent",
                    `0 0 15px ${persona.color}40`,
                    "0 0 0px transparent",
                  ],
                }
              : {}
          }
          transition={{ duration: 0.6 }}
        />
        <motion.button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!canSend || !input.trim()}
          whileHover={
            canSend && input.trim()
              ? {
                  scale: 1.1,
                  boxShadow: `0 0 16px ${persona.color}50`,
                  rotate: -15,
                }
              : {}
          }
          whileTap={canSend && input.trim() ? { scale: 0.85, rotate: 0 } : {}}
          transition={snappySpring}
        >
          <Send size={14} />
        </motion.button>
      </motion.div>

      {/* Handoff bar — suggested agents + send to any */}
      <AnimatePresence>
        {(suggestedHandoffs.length > 0 || isDone || conversation.status === "waiting") && (
          <motion.div
            className={styles.handoffBar}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={springTransition}
          >
            {/* Suggested handoffs from agent mentions */}
            {suggestedHandoffs.map((pId) => {
              const target = getPersonaById(pId);
              if (!target) return null;
              return (
                <motion.button
                  key={pId}
                  className={styles.handoffBtn}
                  style={{ "--agent-color": target.color } as React.CSSProperties}
                  onClick={() => handleHandoff(pId, input.trim() || undefined)}
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.92 }}
                  transition={snappySpring}
                  title={`Send to ${target.name} (${target.role})`}
                >
                  {target.avatar && (
                    <img
                      src={target.avatar}
                      alt={target.name}
                      className={styles.handoffAvatar}
                    />
                  )}
                  <span className={styles.handoffName}>{target.name}</span>
                  <Forward size={10} />
                </motion.button>
              );
            })}

            {/* "Send to..." expander for all agents */}
            <motion.button
              className={styles.handoffMore}
              onClick={() => setShowAllAgents((v) => !v)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={snappySpring}
            >
              {showAllAgents ? "Less" : "Send to..."}
            </motion.button>

            {/* Expanded all-agents list */}
            <AnimatePresence>
              {showAllAgents && (
                <motion.div
                  className={styles.handoffAll}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {DEFAULT_PERSONAS.filter((p) => p.id !== conversation.personaId && !suggestedHandoffs.includes(p.id)).map((p) => (
                    <motion.button
                      key={p.id}
                      className={styles.handoffBtn}
                      style={{ "--agent-color": p.color } as React.CSSProperties}
                      onClick={() => handleHandoff(p.id, input.trim() || undefined)}
                      whileHover={{ scale: 1.08, y: -2 }}
                      whileTap={{ scale: 0.92 }}
                      transition={snappySpring}
                      title={`Send to ${p.name} (${p.role})`}
                    >
                      {p.avatar && (
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className={styles.handoffAvatar}
                        />
                      )}
                      <span className={styles.handoffName}>{p.name}</span>
                      <span className={styles.handoffRole}>{p.role}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
