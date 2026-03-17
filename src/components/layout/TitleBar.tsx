import styles from "./TitleBar.module.css";

export function TitleBar() {
  return (
    <div className={styles.titleBar} data-tauri-drag-region>
      {/* Left HUD decoration */}
      <div className={styles.hudLeft}>
        <span className={styles.hudDot} />
        <span className={styles.hudLine} />
      </div>

      {/* Title with bracket decorations + ghost */}
      <span className={styles.bracketLeft}>[</span>
      <span className={styles.titleWrap}>
        <span className={styles.ghostTitle} aria-hidden="true">D.A.E.M.O.N.</span>
        <span className={styles.title} title="Distributed Autonomous Engineering Management Orchestration Node">
          D.A.E.M.O.N.
        </span>
      </span>
      <span className={styles.bracketRight}>]</span>

      {/* Right HUD decoration */}
      <div className={styles.hudRight}>
        <span className={styles.hudLineRight} />
        <span className={styles.hudDotRight} />
      </div>
    </div>
  );
}
