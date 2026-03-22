import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentStore } from "../../stores/agentStore";
import styles from "./TerminalDrawer.module.css";

interface AgentOutputEvent {
  task_id: string;
  line: string;
  done: boolean;
}

function DrawerContent() {
  const { tasks, activeTaskId, closeTerminalDrawer } = useAgentStore();
  const outputRef = useRef<HTMLDivElement>(null);

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // Auto-scroll on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeTask?.output.length]);

  if (!activeTask) return null;

  const isRunning =
    activeTask.status === "running" || activeTask.status === "queued";

  return (
    <motion.div
      className={styles.drawer}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "105%" }}
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.9 }}
    >
      {/* Header bar */}
      <div className={styles.header}>
        {/* Left: running indicator + command label — slide in from left */}
        <motion.div
          className={styles.headerInfo}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        >
          {isRunning && <span className={styles.runningDot} />}
          <span
            className={styles.commandLabel}
          >
            {activeTask.command || "Research"} {activeTask.args.slice(0, 60)}
            {activeTask.args.length > 60 ? "..." : ""}
          </span>
        </motion.div>

        <div className={styles.headerActions}>
          {/* Task switcher dots — staggered spring pop-in */}
          {tasks.slice(0, 5).map((task, i) => (
            <motion.button
              key={task.id}
              className={`${styles.taskDot} ${
                task.id === activeTaskId ? styles.taskDotActive : ""
              } ${task.status === "running" ? styles.taskDotRunning : ""}`}
              onClick={() => useAgentStore.getState().setActiveTask(task.id)}
              title={`${task.command || "Research"} ${task.args.slice(0, 30)}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 600,
                damping: 22,
                delay: 0.12 + i * 0.06,
              }}
              whileHover={{
                scale: 1.6,
                transition: { type: "spring", stiffness: 700, damping: 20 },
              }}
              whileTap={{ scale: 0.85 }}
            />
          ))}

          {/* Close button */}
          <motion.button
            className={styles.closeBtn}
            onClick={closeTerminalDrawer}
            title="Close terminal"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40, delay: 0.28 }}
            whileHover={{
              scale: 1.15,
              rotate: 90,
              transition: { type: "spring", stiffness: 600, damping: 18 },
            }}
            whileTap={{ scale: 0.82, rotate: 45 }}
          >
            <X size={14} />
          </motion.button>
        </div>
      </div>

      {/* Output area — fades in after header */}
      <motion.div
        className={styles.output}
        ref={outputRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.22 }}
      >
        <div className={styles.markdown}>
          <Markdown>{activeTask.output.join("\n")}</Markdown>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function TerminalDrawer() {
  const { tasks, activeTaskId, terminalDrawerOpen } = useAgentStore();

  // Listen for agent output events from all sources (ActionMenu, AgentsPanel, etc.)
  useEffect(() => {
    const unlisten = listen<AgentOutputEvent>("agent-output", (event) => {
      const { task_id, line, done } = event.payload;
      const store = useAgentStore.getState();
      if (store.tasks.some((t) => t.id === task_id)) {
        store.updateTaskOutput(task_id, line);
        if (done) store.completeTask(task_id, "completed");
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const isVisible =
    terminalDrawerOpen && tasks.some((t) => t.id === activeTaskId);

  return (
    <AnimatePresence>
      {isVisible && <DrawerContent key="terminal-drawer" />}
    </AnimatePresence>
  );
}
