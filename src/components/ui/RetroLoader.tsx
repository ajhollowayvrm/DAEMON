import styles from "./RetroLoader.module.css";

interface RetroLoaderProps {
  text?: string;
}

export function RetroLoader({ text = "Loading..." }: RetroLoaderProps) {
  return (
    <div className={styles.loader}>
      <div className={styles.spinner} />
      <span>{text}</span>
    </div>
  );
}
