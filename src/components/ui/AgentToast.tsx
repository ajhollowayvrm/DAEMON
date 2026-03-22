import { useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { getPersonaById } from "../../config/personas";
import {
  useMonitorStore,
  hydrateTemplate,
  type MonitorEvent,
} from "../../stores/monitorStore";
import styles from "./AgentToast.module.css";

const AUTO_DISMISS_MS = 30_000;

interface AgentToastProps {
  event: MonitorEvent;
}

export function AgentToast({ event }: AgentToastProps) {
  const persona = getPersonaById(event.personaId);

  // Look up rule once — rules don't change during a toast's lifetime.
  // Use useMemo to avoid subscribing to the store on every render.
  const rule = useMemo(
    () => useMonitorStore.getState().rules.find((r) => r.id === event.ruleId),
    [event.ruleId],
  );

  // Track whether the toast has been acted on so we stop the timer
  const actedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after timeout
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!actedRef.current) {
        actedRef.current = true;
        useMonitorStore.getState().dismissEvent(event.id);
      }
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [event.id]);

  const handleAccept = useCallback(() => {
    if (actedRef.current) return;
    actedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    useMonitorStore.getState().dispatchEvent(event.id);
  }, [event.id]);

  const handleDismiss = useCallback(() => {
    if (actedRef.current) return;
    actedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    useMonitorStore.getState().dismissEvent(event.id);
  }, [event.id]);

  if (!persona || !rule) return null;

  const toastMessage = hydrateTemplate(rule.toastTemplate, event.context);

  return (
    <motion.div
      className={styles.toast}
      style={{ "--agent-color": persona.color } as React.CSSProperties}
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      layout
    >
      {persona.avatar && (
        <img
          src={persona.avatar}
          alt={persona.name}
          className={styles.avatar}
        />
      )}

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.name}>{persona.name}</span>
          <span className={styles.role}>{persona.role}</span>
          <span className={styles.sourceBadge}>{event.source}</span>
        </div>

        <div className={styles.message}>{toastMessage}</div>

        <div className={styles.actions}>
          <button className={styles.acceptBtn} onClick={handleAccept}>
            On it
          </button>
          <button className={styles.dismissBtn} onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      </div>

      {/* Auto-dismiss progress — pure CSS animation, no re-renders */}
      <div className={styles.progressBar} />
    </motion.div>
  );
}
