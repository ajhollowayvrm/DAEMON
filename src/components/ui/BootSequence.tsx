import { useState, useEffect, useMemo, useRef } from "react";
import styles from "./BootSequence.module.css";
import { useTheme } from "../../themes";
import type { BootLine } from "../../themes/types";

// Duration → max tier: 3-6s = tier 1 only, 7-10s = tier 1+2, 11-15s = all tiers
function getBootLines(allLines: BootLine[], duration: number): string[] {
  const maxTier = duration <= 6 ? 1 : duration <= 10 ? 2 : 3;
  return allLines
    .filter((line) => line.tier <= maxTier)
    .map((line) => line.text);
}

// Phases: text → clearText → logoGrow → logoHold → reveal → done
type Phase = "text" | "clearText" | "logoGrow" | "logoHold" | "reveal" | "done";

function getBootSettings() {
  const enabled = localStorage.getItem("daemon_boot_enabled") !== "false";
  const duration = parseInt(localStorage.getItem("daemon_boot_duration") ?? "5", 10);
  return { enabled, duration };
}

export function BootSequence() {
  const { theme } = useTheme();
  const { enabled, duration } = useMemo(getBootSettings, []);
  const bootLines = useMemo(
    () => getBootLines(theme.bootSequence.lines, duration),
    [theme.bootSequence.lines, duration],
  );
  const [phase, setPhase] = useState<Phase>(enabled ? "text" : "done");
  const [visibleLines, setVisibleLines] = useState(0);
  const logoRef = useRef<HTMLImageElement>(null);

  // Text phase timing
  const lineTime = (duration * 1000) * 0.65;
  const holdTime = (duration * 1000) * 0.15;
  const delayPerLine = lineTime / bootLines.length;

  useEffect(() => {
    if (!enabled) return;

    // Phase 1: Show text lines
    const lineTimers = bootLines.map((_, idx) =>
      setTimeout(() => setVisibleLines(idx + 1), idx * delayPerLine),
    );

    const totalLineTime = bootLines.length * delayPerLine;

    // Phase 2: Clear text away (after hold)
    const clearTimer = setTimeout(() => {
      setPhase("clearText");
    }, totalLineTime + holdTime);

    // Phase 3: Logo grows to fill screen
    const growTimer = setTimeout(() => {
      setPhase("logoGrow");
    }, totalLineTime + holdTime + 600);

    // Phase 4: Hold on large logo
    const holdTimer = setTimeout(() => {
      setPhase("logoHold");
    }, totalLineTime + holdTime + 600 + 1200);

    // Phase 5: Fade to dashboard
    const revealTimer = setTimeout(() => {
      setPhase("reveal");
    }, totalLineTime + holdTime + 600 + 1200 + 1500);

    // Phase 6: Done
    const doneTimer = setTimeout(() => {
      setPhase("done");
    }, totalLineTime + holdTime + 600 + 1200 + 1500 + 800);

    return () => {
      lineTimers.forEach(clearTimeout);
      clearTimeout(clearTimer);
      clearTimeout(growTimer);
      clearTimeout(holdTimer);
      clearTimeout(revealTimer);
      clearTimeout(doneTimer);
    };
  }, [enabled, delayPerLine, holdTime, bootLines]);

  if (phase === "done") return null;

  return (
    <div className={`${styles.bootOverlay} ${phase === "reveal" ? styles.overlayFadeOut : ""}`}>
      {/* Text content — fades out during clearText */}
      <div className={`${styles.bootContent} ${
        phase !== "text" ? styles.textFadeOut : ""
      }`}>
        <div className={styles.bootLines}>
          {bootLines.slice(0, visibleLines).map((text, idx) => (
            <div
              key={idx}
              className={`${styles.bootLine} ${
                text.includes("ONLINE") ? styles.bootLineReady : ""
              } ${
                text.includes("FAILED") || text.includes("INEVITABLE") || text.includes("UNCERTAIN")
                  ? styles.bootLineWarn
                  : ""
              } ${
                text.includes("LINKED") || text.includes("OK") || text.includes("ALL GREEN")
                  ? styles.bootLineOk
                  : ""
              } ${text === "" ? styles.bootLineSpacer : ""}`}
            >
              {text}
            </div>
          ))}
          {phase === "text" && visibleLines < bootLines.length && (
            <span className={styles.bootCursor}>█</span>
          )}
        </div>
      </div>

      {/* Logo — always present, transforms through phases */}
      <img
        ref={logoRef}
        src={theme.bootSequence.logoPath}
        alt="D.A.E.M.O.N."
        className={`${styles.bootLogo} ${
          phase === "text" || phase === "clearText"
            ? styles.logoSmall
            : styles.logoLarge
        }`}
      />
    </div>
  );
}
