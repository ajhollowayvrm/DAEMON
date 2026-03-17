import styles from "./EmptySlot.module.css";

export function EmptySlot() {
  return (
    <div className={styles.slot}>
      <div className={styles.slotContent}>
        <span className={styles.slotIcon}>⬡</span>
        <span className={styles.slotText}>Panel offline</span>
        <span className={styles.slotHint}>Use header bar to activate</span>
      </div>
    </div>
  );
}
