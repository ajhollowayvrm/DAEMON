import { AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { useMonitorStore } from "../../stores/monitorStore";
import { AgentToast } from "./AgentToast";
import styles from "./AgentToast.module.css";

export function AgentToastContainer() {
  // useShallow does a shallow array comparison so we only re-render when
  // the actual list of pending event IDs changes, not on every store update.
  const toasts = useMonitorStore(
    useShallow((s) => s.events.filter((e) => e.status === "pending")),
  );

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      <AnimatePresence mode="popLayout">
        {toasts.slice(0, 5).map((event) => (
          <AgentToast key={event.id} event={event} />
        ))}
      </AnimatePresence>
    </div>
  );
}
