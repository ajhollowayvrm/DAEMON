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

// Generate random stars for LCARS starfield
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.6 + 0.2,
    delay: Math.random() * 3,
  }));
}

const STARS = generateStars(120);

export function BootSequence({ forcePlay = false }: { forcePlay?: boolean }) {
  const { theme } = useTheme();
  const { enabled, duration } = useMemo(getBootSettings, []);
  const shouldPlay = forcePlay || enabled;
  const bootLines = useMemo(
    () => getBootLines(theme.bootSequence.lines, duration),
    [theme.bootSequence.lines, duration],
  );
  const [phase, setPhase] = useState<Phase>(shouldPlay ? "text" : "done");
  const [visibleLines, setVisibleLines] = useState(0);
  const logoRef = useRef<HTMLImageElement>(null);

  // Text phase timing
  const lineTime = (duration * 1000) * 0.65;
  const holdTime = (duration * 1000) * 0.15;
  const delayPerLine = lineTime / bootLines.length;

  useEffect(() => {
    if (!shouldPlay) return;

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
  }, [shouldPlay, delayPerLine, holdTime, bootLines]);

  if (phase === "done") return null;

  const isLcars = theme.layoutStyle === "lcars";

  // ─── LCARS Boot ───
  if (isLcars) {
    const showAssembly = phase === "logoGrow" || phase === "logoHold" || phase === "reveal";

    return (
      <div className={`${styles.lcarsBootOverlay} ${phase === "reveal" ? styles.overlayFadeOut : ""}`}>
        {/* Subtle starfield background throughout */}
        <div className={styles.starfield}>
          {STARS.map((star) => (
            <div
              key={star.id}
              className={styles.star}
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity * 0.5,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}
        </div>

        {/* LCARS frame around boot text */}
        <div className={`${styles.lcarsBootFrame} ${phase !== "text" ? styles.lcarsBootFrameFade : ""}`}>
          <div className={styles.lcarsBootSidebar}>
            <div className={styles.lcarsBootElbow} />
            <div className={styles.lcarsBootSidebarBar} />
            <div className={styles.lcarsBootSidebarPill} />
          </div>
          <div className={styles.lcarsBootContent}>
            <div className={styles.lcarsBootHeader}>
              <span className={styles.lcarsBootHeaderLabel}>LCARS BOOT SEQUENCE</span>
              <span className={styles.lcarsBootHeaderAccent} />
            </div>
            <div className={styles.lcarsBootLines}>
              {bootLines.slice(0, visibleLines).map((text, idx) => (
                <div
                  key={idx}
                  className={`${styles.lcarsBootLine} ${
                    text.includes("READY") || text.includes("ONLINE") ? styles.lcarsBootLineReady : ""
                  } ${
                    text.includes("ERROR") || text.includes("DENIED") || text.includes("FAILED")
                      ? styles.lcarsBootLineWarn
                      : ""
                  } ${text === "" ? styles.bootLineSpacer : ""}`}
                >
                  {text}
                </div>
              ))}
              {phase === "text" && visibleLines < bootLines.length && (
                <span className={styles.lcarsBootCursor}>▌</span>
              )}
            </div>
          </div>
        </div>

        {/* LCARS Assembly — full interface frame builds itself */}
        {showAssembly && (
          <div className={styles.lcarsAssembly}>
            {/* Top bar — slides from left */}
            <div className={styles.assembleTopBar}>
              <div className={styles.assembleSegment} style={{ background: "#ff9933", flex: "0 0 44px", borderRadius: "0 0 0 22px" }} />
              <div className={styles.assembleSegment} style={{ background: "#cc6699", flex: "0 0 80px" }} />
              <div className={styles.assembleSegment} style={{ background: "#9966cc", flex: "0 0 40px" }} />
              <div className={styles.assembleSegment} style={{ background: "#9999ff", flex: "1 1 auto" }} />
              <div className={styles.assembleSegment} style={{ background: "#cc6699", flex: "0 0 60px" }} />
              <div className={styles.assembleSegment} style={{ background: "#ff9933", flex: "0 0 30px", borderRadius: "0 16px 16px 0" }} />
            </div>

            {/* Left sidebar — slides from top */}
            <div className={styles.assembleLeftBar}>
              <div className={styles.assembleSegment} style={{ background: "#ff9933", flex: "1 1 auto" }} />
              <div className={styles.assembleSegment} style={{ background: "#cc6699", flex: "0 0 60px" }} />
              <div className={styles.assembleSegment} style={{ background: "#9999ff", flex: "0 0 30px" }} />
              <div className={styles.assembleSegment} style={{ background: "#9966cc", flex: "0 0 20px", borderRadius: "0 0 0 12px" }} />
            </div>

            {/* Right sidebar — slides from bottom */}
            <div className={styles.assembleRightBar}>
              <div className={styles.assembleSegment} style={{ background: "#9966cc", flex: "0 0 20px", borderRadius: "0 12px 0 0" }} />
              <div className={styles.assembleSegment} style={{ background: "#9999ff", flex: "0 0 40px" }} />
              <div className={styles.assembleSegment} style={{ background: "#cc6699", flex: "0 0 80px" }} />
              <div className={styles.assembleSegment} style={{ background: "#ff9933", flex: "1 1 auto" }} />
            </div>

            {/* Bottom bar — slides from right */}
            <div className={styles.assembleBottomBar}>
              <div className={styles.assembleSegment} style={{ background: "#9966cc", flex: "0 0 30px", borderRadius: "16px 0 0 0" }} />
              <div className={styles.assembleSegment} style={{ background: "#ff9933", flex: "0 0 100px" }} />
              <div className={styles.assembleSegment} style={{ background: "#9999ff", flex: "1 1 auto" }} />
              <div className={styles.assembleSegment} style={{ background: "#cc6699", flex: "0 0 50px" }} />
              <div className={styles.assembleSegment} style={{ background: "#9966cc", flex: "0 0 44px", borderRadius: "0 0 22px 0" }} />
            </div>

            {/* Inner horizontal divider — slides from left, delayed */}
            <div className={styles.assembleInnerH}>
              <div className={styles.assembleSegment} style={{ background: "#9999ff", flex: "0 0 120px" }} />
              <div className={styles.assembleSegment} style={{ background: "#cc6699", flex: "1 1 auto" }} />
              <div className={styles.assembleSegment} style={{ background: "#ff9933", flex: "0 0 80px" }} />
            </div>

            {/* Inner vertical divider — slides from top, delayed */}
            <div className={styles.assembleInnerV}>
              <div className={styles.assembleSegment} style={{ background: "#cc6699", flex: "0 0 60px" }} />
              <div className={styles.assembleSegment} style={{ background: "#ff9933", flex: "1 1 auto" }} />
            </div>

            {/* Center text */}
            <div className={styles.assembleCenter}>
              <span className={styles.assembleCenterText}>LCARS INTERFACE ACTIVE</span>
              <span className={styles.assembleCenterSub}>DISTRIBUTED AUTONOMOUS ENGINEERING MANAGEMENT ORCHESTRATION NODE</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Cyberpunk Boot (unchanged) ───
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
