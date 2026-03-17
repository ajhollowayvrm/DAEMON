import { useState, useEffect } from "react";
import styles from "./BootSequence.module.css";

const BOOT_LINES = [
  { text: "> INITIALIZING D.A.E.M.O.N...", delay: 0 },
  { text: "> LOADING KERNEL MODULES......", delay: 400 },
  { text: "> CONNECTING TO UPLINK........", delay: 800 },
  { text: "> DECRYPTING SECURE CHANNELS..", delay: 1100 },
  { text: "> LOADING INTERFACE MODULES...", delay: 1400 },
  { text: "> SYSTEM READY", delay: 1700 },
];

const TOTAL_BOOT_TIME = 2400; // ms before fade-out starts
const FADE_DURATION = 500; // ms for the fade-out

export function BootSequence() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    // Reveal lines one by one
    const timers = BOOT_LINES.map((line, idx) =>
      setTimeout(() => setVisibleLines(idx + 1), line.delay)
    );

    // Start fade
    const fadeTimer = setTimeout(() => setFading(true), TOTAL_BOOT_TIME);

    // Remove from DOM
    const removeTimer = setTimeout(
      () => setVisible(false),
      TOTAL_BOOT_TIME + FADE_DURATION
    );

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`${styles.bootOverlay} ${fading ? styles.bootFadeOut : ""}`}
      style={
        fading
          ? ({ "--fade-duration": `${FADE_DURATION}ms` } as React.CSSProperties)
          : undefined
      }
    >
      <div className={styles.bootContent}>
        <div className={styles.bootLogo}>D.A.E.M.O.N.</div>
        <div className={styles.bootLines}>
          {BOOT_LINES.slice(0, visibleLines).map((line, idx) => (
            <div
              key={idx}
              className={`${styles.bootLine} ${
                idx === BOOT_LINES.length - 1 && visibleLines === BOOT_LINES.length
                  ? styles.bootLineReady
                  : ""
              }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              {line.text}
            </div>
          ))}
          {visibleLines < BOOT_LINES.length && (
            <span className={styles.bootCursor}>_</span>
          )}
        </div>
        <div className={styles.bootBar}>
          <div
            className={styles.bootBarFill}
            style={{
              width: `${(visibleLines / BOOT_LINES.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
