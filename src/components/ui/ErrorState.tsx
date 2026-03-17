import { NeonButton } from "./NeonButton";
import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Failed to load data",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.error}>
      <span>CONNECTION ERROR</span>
      <span className={styles.message}>{message}</span>
      {onRetry && (
        <NeonButton variant="magenta" onClick={onRetry}>
          Retry
        </NeonButton>
      )}
    </div>
  );
}
