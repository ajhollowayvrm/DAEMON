import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAgentStore } from "../../stores/agentStore";
import { usePersonaStore } from "../../stores/personaStore";
import { type AIAction, getActionsForSource, type ActionSource } from "../../config/aiActions";
import { getPersonaById } from "../../config/personas";
import styles from "./ActionMenu.module.css";

// ── Framer Motion variants ─────────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const dropdownVariants = {
  hidden: {
    opacity: 0,
    scale: 0.82,
    y: -8,
    filter: "blur(6px)",
    transformOrigin: "top right",
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transformOrigin: "top right",
    transition: {
      type: "spring" as const,
      stiffness: 520,
      damping: 28,
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.82,
    y: -8,
    filter: "blur(6px)",
    transformOrigin: "top right",
    transition: { duration: 0.18, ease: "easeIn" as const },
  },
} satisfies Record<string, object>;

const menuItemVariants = {
  hidden: { opacity: 0, x: 12, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.22, ease: EASE_OUT },
  },
} satisfies Record<string, object>;

let actionTaskCounter = 0;

interface ActionMenuProps {
  source: ActionSource;
  context: Record<string, unknown>;
  /** Render a smaller trigger button (22px instead of 26px) */
  compact?: boolean;
}

export function ActionMenu({ source, context, compact }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addTask = useAgentStore((s) => s.addTask);

  const actions = getActionsForSource(source);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(!open);
  };

  const handleAction = (action: AIAction) => {
    setOpen(false);
    const args = action.buildArgs(context);

    if (action.command === "__copy__") {
      navigator.clipboard.writeText(args).catch(() => {});
      return;
    }

    // If action has a persona, launch it as a background agent run
    if (action.persona) {
      const prompt = action.command
        ? `${action.command} ${args}`
        : args;
      usePersonaStore.getState().launchAgent(action.persona, prompt);
      return;
    }

    // Fallback: run as generic command
    const id = `ai-${++actionTaskCounter}`;
    addTask({
      id,
      command: action.command,
      args,
      contextSource: source,
      contextData: context,
      output: [`Running ${action.label}...`, ""],
      status: "running",
    });

    invoke("run_agent_command", {
      taskId: id,
      command: action.command,
      args,
    }).catch((err) => {
      useAgentStore.getState().updateTaskOutput(id, `Error: ${err}`);
      useAgentStore.getState().completeTask(id, "failed");
    });
  };

  return (
    <div className={styles.wrapper} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <motion.button
        ref={triggerRef}
        className={`${styles.trigger} ${compact ? styles.triggerCompact : ""}`}
        onClick={handleToggle}
        title="AI Actions"
        whileHover={{
          scale: 1.1,
          boxShadow: "0 0 10px rgba(0,255,245,0.25)",
          borderColor: "rgba(0,255,245,0.5)",
          transition: { duration: 0.15 },
        }}
        whileTap={{ scale: 0.88 }}
      >
        <MoreHorizontal size={14} />
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              className={styles.dropdown}
              style={{ top: dropdownPos.top, right: dropdownPos.right }}
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {actions.map((action) => (
                <motion.button
                  key={action.id}
                  className={styles.menuItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(action);
                  }}
                  variants={menuItemVariants}
                  whileHover={{
                    x: 4,
                    backgroundColor: "rgba(0,255,245,0.08)",
                    color: "var(--neon-cyan)",
                    transition: { duration: 0.12 },
                  }}
                  whileTap={{ scale: 0.96 }}
                >
                  {action.persona && (() => {
                    const p = getPersonaById(action.persona);
                    return p?.avatar ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className={styles.menuItemAvatar}
                      />
                    ) : null;
                  })()}
                  {action.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
