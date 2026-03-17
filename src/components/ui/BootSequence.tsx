import { useState, useEffect, useMemo } from "react";
import styles from "./BootSequence.module.css";

const BOOT_LINES = [
  "BIOS v4.20.69 — NectarCorp Unified Firmware",
  "CPU: AMD Ryzen 9 9950X @ 5.7GHz ............ OK",
  "RAM: 128GB DDR5-6400 ECC .................... OK",
  "GPU: NVIDIA RTX 5090 Ti (48GB VRAM) ......... OK",
  "NEURAL_LINK: Arasaka Mk.IV Interface ........ CONNECTED",
  "",
  "Loading D.A.E.M.O.N. kernel v0.1.0...",
  "  [████████████████████████████████████] 100%",
  "",
  "Mounting /dev/sda1 on /mnt/corporate-overlord ....... OK",
  "Initializing quantum entanglement resolver .......... OK",
  "Loading todo_list.txt (WARNING: 847 items found) .... OK",
  "Checking if it works on my machine .................. YES",
  "Resolving node_modules (429,817 packages) ........... OK",
  "Compiling 441 Rust crates ........................... OK",
  "rm -rf node_modules && npm install .................. SKIPPED",
  "Verifying left-pad is not deprecated ................ UNCERTAIN",
  "",
  "Establishing secure uplinks:",
  "  ├─ Slack    ⟶ nectar-hr.slack.com ................ LINKED",
  "  ├─ GitLab   ⟶ gitlab.com/nectarhr ............... LINKED",
  "  ├─ Linear   ⟶ linear.app/nectar ................. LINKED",
  "  └─ Claude   ⟶ /usr/local/bin/claude ............. STANDBY",
  "",
  "Deploying countermeasures against:",
  "  ├─ Unnecessary meetings .......................... BLOCKED",
  "  ├─ Scope creep .................................. DETECTED (ironic)",
  "  ├─ \"Quick question\" DMs .......................... QUEUED",
  "  └─ Production incidents on Friday at 4:59pm ...... INEVITABLE",
  "",
  "Calibrating engineer caffeine-to-productivity ratio.. 1:0.03",
  "Disabling imposter syndrome module .................. FAILED (as expected)",
  "Running final diagnostics ........................... ALL GREEN",
  "",
  "╔══════════════════════════════════════════════════════╗",
  "║  D.A.E.M.O.N. ONLINE — ALL SYSTEMS OPERATIONAL     ║",
  "║  \"It's not a bug, it's a feature.\"                  ║",
  "╚══════════════════════════════════════════════════════╝",
];

const FADE_DURATION = 600;

function getBootSettings() {
  const enabled = localStorage.getItem("daemon_boot_enabled") !== "false";
  const duration = parseInt(localStorage.getItem("daemon_boot_duration") ?? "5", 10);
  return { enabled, duration };
}

export function BootSequence() {
  const { enabled, duration } = useMemo(getBootSettings, []);

  const [visible, setVisible] = useState(enabled);
  const [fading, setFading] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);

  // Calculate timing: lines take ~70% of duration, hold at end takes ~30%
  const lineTime = (duration * 1000) * 0.7;
  const holdTime = (duration * 1000) * 0.3;
  const delayPerLine = lineTime / BOOT_LINES.length;

  useEffect(() => {
    if (!enabled) return;

    const timers = BOOT_LINES.map((_, idx) =>
      setTimeout(() => setVisibleLines(idx + 1), idx * delayPerLine),
    );

    const totalLineTime = BOOT_LINES.length * delayPerLine;
    const fadeTimer = setTimeout(() => setFading(true), totalLineTime + holdTime);
    const removeTimer = setTimeout(
      () => setVisible(false),
      totalLineTime + holdTime + FADE_DURATION,
    );

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [enabled, delayPerLine, holdTime]);

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
        <img
          src="/assets/daemon-logo.png"
          alt="D.A.E.M.O.N."
          className={styles.bootLogoImg}
        />
        <div className={styles.bootLines}>
          {BOOT_LINES.slice(0, visibleLines).map((text, idx) => (
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
          {visibleLines < BOOT_LINES.length && (
            <span className={styles.bootCursor}>█</span>
          )}
        </div>
      </div>
    </div>
  );
}
