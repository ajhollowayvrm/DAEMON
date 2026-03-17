import { useState, useEffect } from "react";
import styles from "./BootSequence.module.css";

const BOOT_LINES = [
  { text: "BIOS v4.20.69 — NectarCorp Unified Firmware", delay: 0 },
  { text: "CPU: AMD Ryzen 9 9950X @ 5.7GHz ............ OK", delay: 100 },
  { text: "RAM: 128GB DDR5-6400 ECC .................... OK", delay: 180 },
  { text: "GPU: NVIDIA RTX 5090 Ti (48GB VRAM) ......... OK", delay: 260 },
  { text: "NEURAL_LINK: Arasaka Mk.IV Interface ........ CONNECTED", delay: 340 },
  { text: "", delay: 400 },
  { text: "Loading D.A.E.M.O.N. kernel v0.1.0...", delay: 420 },
  { text: "  [████████████████████████████████████] 100%", delay: 500 },
  { text: "", delay: 550 },
  { text: "Mounting /dev/sda1 on /mnt/corporate-overlord ....... OK", delay: 580 },
  { text: "Initializing quantum entanglement resolver .......... OK", delay: 660 },
  { text: "Loading todo_list.txt (WARNING: 847 items found) .... OK", delay: 740 },
  { text: "Checking if it works on my machine .................. YES", delay: 820 },
  { text: "Resolving node_modules (429,817 packages) ........... OK", delay: 900 },
  { text: "Compiling 441 Rust crates ........................... OK", delay: 980 },
  { text: "rm -rf node_modules && npm install .................. SKIPPED", delay: 1040 },
  { text: "Verifying left-pad is not deprecated ................ UNCERTAIN", delay: 1100 },
  { text: "", delay: 1140 },
  { text: "Establishing secure uplinks:", delay: 1160 },
  { text: "  ├─ Slack    ⟶ nectar-hr.slack.com ................ LINKED", delay: 1220 },
  { text: "  ├─ GitLab   ⟶ gitlab.com/nectarhr ............... LINKED", delay: 1300 },
  { text: "  ├─ Linear   ⟶ linear.app/nectar ................. LINKED", delay: 1380 },
  { text: "  └─ Claude   ⟶ /usr/local/bin/claude ............. STANDBY", delay: 1460 },
  { text: "", delay: 1500 },
  { text: "Deploying countermeasures against:", delay: 1520 },
  { text: "  ├─ Unnecessary meetings .......................... BLOCKED", delay: 1580 },
  { text: "  ├─ Scope creep .................................. DETECTED (ironic)", delay: 1640 },
  { text: "  ├─ \"Quick question\" DMs .......................... QUEUED", delay: 1700 },
  { text: "  └─ Production incidents on Friday at 4:59pm ...... INEVITABLE", delay: 1760 },
  { text: "", delay: 1800 },
  { text: "Calibrating engineer caffeine-to-productivity ratio.. 1:0.03", delay: 1840 },
  { text: "Disabling imposter syndrome module .................. FAILED (as expected)", delay: 1920 },
  { text: "Running final diagnostics ........................... ALL GREEN", delay: 2000 },
  { text: "", delay: 2050 },
  { text: "╔══════════════════════════════════════════════════════╗", delay: 2100 },
  { text: "║  D.A.E.M.O.N. ONLINE — ALL SYSTEMS OPERATIONAL     ║", delay: 2150 },
  { text: "║  \"It's not a bug, it's a feature.\"                  ║", delay: 2200 },
  { text: "╚══════════════════════════════════════════════════════╝", delay: 2250 },
];

const TOTAL_BOOT_TIME = 3200;
const FADE_DURATION = 600;

export function BootSequence() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = BOOT_LINES.map((line, idx) =>
      setTimeout(() => setVisibleLines(idx + 1), line.delay),
    );
    const fadeTimer = setTimeout(() => setFading(true), TOTAL_BOOT_TIME);
    const removeTimer = setTimeout(
      () => setVisible(false),
      TOTAL_BOOT_TIME + FADE_DURATION,
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
        <div className={styles.bootSubtitle}>
          Distributed Autonomous Engineering Management Orchestration Node
        </div>
        <div className={styles.bootLines}>
          {BOOT_LINES.slice(0, visibleLines).map((line, idx) => (
            <div
              key={idx}
              className={`${styles.bootLine} ${
                line.text.includes("ONLINE") ? styles.bootLineReady : ""
              } ${line.text.includes("FAILED") || line.text.includes("INEVITABLE") || line.text.includes("UNCERTAIN") ? styles.bootLineWarn : ""} ${
                line.text.includes("LINKED") || line.text.includes("OK") || line.text.includes("ALL GREEN") ? styles.bootLineOk : ""
              } ${line.text === "" ? styles.bootLineSpacer : ""}`}
            >
              {line.text}
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
