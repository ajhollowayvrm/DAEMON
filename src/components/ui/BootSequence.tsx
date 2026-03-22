import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./BootSequence.module.css";
import { useTheme } from "../../themes";
import { useLayoutStore } from "../../stores/layoutStore";
import type { BootLine } from "../../themes/types";

// Duration → max tier: 3-6s = tier 1 only, 7-10s = tier 1+2, 11-15s = all tiers
function getBootLines(allLines: BootLine[], duration: number): string[] {
  const maxTier = duration <= 6 ? 1 : duration <= 10 ? 2 : 3;
  return allLines
    .filter((line) => line.tier <= maxTier)
    .map((line) => line.text);
}

type Phase = "text" | "postText" | "reveal" | "done";

function getBootSettings() {
  const enabled = localStorage.getItem("daemon_boot_enabled") !== "false";
  const duration = parseInt(localStorage.getItem("daemon_boot_duration") ?? "5", 10);
  return { enabled, duration };
}

// ── Data rain columns for background animation ──
function generateDataRainColumns(count: number) {
  const chars = "01/\\|-ABCDEFabcdef0123456789><{}[]アイウエオカキクケコ";
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i / count) * 100 + Math.random() * (100 / count),
    speed: 3 + Math.random() * 5,
    delay: Math.random() * 4,
    chars: Array.from({ length: 15 + Math.floor(Math.random() * 20) }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join("\n"),
    opacity: 0.03 + Math.random() * 0.07,
  }));
}

const DATA_RAIN = generateDataRainColumns(30);

// ── Hex grid cells for background ──
function generateHexCells(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 30 + Math.random() * 60,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 4,
  }));
}

const HEX_CELLS = generateHexCells(12);

// ── Framer Motion config ──

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

function getLineColor(text: string): string | undefined {
  if (text.includes("ONLINE")) return "var(--neon-green)";
  if (text.includes("FAILED") || text.includes("INEVITABLE") || text.includes("UNCERTAIN"))
    return "var(--neon-yellow)";
  if (text.includes("LINKED") || text.includes("OK") || text.includes("ALL GREEN") || text.includes("GREEN"))
    return "rgba(0, 255, 245, 0.8)";
  if (text.includes("PASS") || text.includes("NOMINAL") || text.includes("CONNECTED"))
    return "rgba(0, 255, 245, 0.6)";
  return undefined;
}

function getLineTextShadow(text: string): string | undefined {
  if (text.includes("ONLINE")) return "0 0 12px rgba(57, 255, 20, 0.5)";
  if (text.includes("FAILED") || text.includes("INEVITABLE") || text.includes("UNCERTAIN"))
    return "0 0 6px rgba(255, 230, 0, 0.3)";
  if (text.includes("═") || text.includes("╔") || text.includes("╚"))
    return "0 0 4px rgba(0, 255, 245, 0.3)";
  return undefined;
}

// ── Typewriter line — types out character by character ──

function TypewriterLine({
  text,
  charDelay,
  onComplete,
}: {
  text: string;
  charDelay: number;
  onComplete?: () => void;
}) {
  const [visibleChars, setVisibleChars] = useState(0);
  const completeRef = useRef(false);

  useEffect(() => {
    if (text === "") {
      onComplete?.();
      return;
    }

    let frame: number;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const chars = Math.min(Math.floor(elapsed / charDelay), text.length);
      setVisibleChars(chars);

      if (chars < text.length) {
        frame = requestAnimationFrame(animate);
      } else if (!completeRef.current) {
        completeRef.current = true;
        onComplete?.();
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [text, charDelay, onComplete]);

  if (text === "") return <div className={styles.bootLineSpacer} />;

  const color = getLineColor(text);
  const textShadow = getLineTextShadow(text);
  const isBanner = text.includes("═") || text.includes("║");

  return (
    <div
      className={`${styles.bootLine} ${isBanner ? styles.bootLineBanner : ""}`}
      style={{
        color,
        textShadow,
        fontWeight: text.includes("ONLINE") ? 700 : undefined,
        fontSize: text.includes("ONLINE") ? "12px" : undefined,
      }}
    >
      {text.slice(0, visibleChars)}
      {visibleChars < text.length && (
        <span className={styles.typingCursorInline}>█</span>
      )}
    </div>
  );
}

// ── Cyberpunk Boot Component ──

function CyberpunkBoot({
  bootLines,
  logoPath,
  duration,
  onDone,
}: {
  bootLines: string[];
  logoPath: string;
  duration: number;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("text");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [showPostEffects, setShowPostEffects] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate typing speed from duration
  // 50% of time for typing, 50% for post-text effects + reveal
  const totalChars = bootLines.reduce((sum, line) => sum + Math.max(line.length, 1), 0);
  const typingBudgetMs = duration * 1000 * 0.50;
  const charDelay = Math.max(1, typingBudgetMs / totalChars);

  // Auto-scroll as lines appear
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [completedLines, currentLineIndex]);

  const handleLineComplete = useCallback(() => {
    setCompletedLines((prev) => [...prev, bootLines[currentLineIndex] ?? ""]);
    const nextIndex = currentLineIndex + 1;
    if (nextIndex < bootLines.length) {
      setCurrentLineIndex(nextIndex);
    } else {
      // All lines typed — move to post-text
      setTimeout(() => {
        setPhase("postText");
        setShowPostEffects(true);
      }, 400);
    }
  }, [currentLineIndex, bootLines]);

  // Phase chain — post-text effects get the remaining time budget
  // Reserve 900ms for the reveal fade-out
  const postTextDuration = Math.max(1500, duration * 1000 * 0.45);
  useEffect(() => {
    if (phase === "postText") {
      const t = setTimeout(() => setPhase("reveal"), postTextDuration);
      return () => clearTimeout(t);
    }
    if (phase === "reveal") {
      const t = setTimeout(() => onDone(), 900);
      return () => clearTimeout(t);
    }
  }, [phase, onDone, postTextDuration]);

  const showText = phase === "text" || phase === "postText";

  return (
    <motion.div
      className={styles.bootOverlay}
      animate={
        phase === "reveal"
          ? { opacity: 0, scale: 1.03, filter: "blur(8px)" }
          : { opacity: 1, scale: 1, filter: "blur(0px)" }
      }
      transition={{ duration: 0.8, ease: EASE_OUT }}
    >
      {/* Scanline overlay */}
      <div className={styles.scanlineOverlay} />

      {/* Background logo watermark — visible throughout like a BIOS splash */}
      <motion.img
        src={logoPath}
        alt=""
        className={styles.bootLogoWatermark}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={
          phase === "postText" || phase === "reveal"
            ? {
                opacity: 0.25,
                scale: 1.05,
                filter:
                  "drop-shadow(0 0 40px rgba(176,38,255,0.6)) drop-shadow(0 0 80px rgba(0,255,245,0.3))",
              }
            : {
                opacity: 0.06,
                scale: 1,
                filter:
                  "drop-shadow(0 0 12px rgba(176,38,255,0.3)) drop-shadow(0 0 30px rgba(0,255,245,0.15))",
              }
        }
        transition={{
          duration: phase === "postText" ? 1.5 : 2,
          ease: EASE_OUT,
        }}
      />

      {/* Data rain — appears subtly during typing, intensifies post-text */}
      <div
        className={`${styles.dataRainContainer} ${showPostEffects ? styles.dataRainActive : ""}`}
      >
        {DATA_RAIN.map((col) => (
          <div
            key={col.id}
            className={styles.dataRainColumn}
            style={{
              left: `${col.x}%`,
              animationDuration: `${col.speed}s`,
              animationDelay: `${col.delay}s`,
              opacity: col.opacity,
            }}
          >
            {col.chars}
          </div>
        ))}
      </div>

      {/* Hex grid cells — appear post-text */}
      <AnimatePresence>
        {showPostEffects &&
          HEX_CELLS.map((cell) => (
            <motion.div
              key={cell.id}
              className={styles.hexCell}
              style={{
                left: `${cell.x}%`,
                top: `${cell.y}%`,
                width: `${cell.size}px`,
                height: `${cell.size}px`,
              }}
              initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
              animate={{
                opacity: [0, 0.08, 0.03, 0.06, 0],
                scale: [0.5, 1, 1.1, 1, 0.8],
                rotate: [0, 30, 60],
              }}
              transition={{
                duration: cell.duration,
                delay: cell.delay * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
      </AnimatePresence>

      {/* Circuit trace lines — post-text */}
      {showPostEffects && (
        <div className={styles.circuitTraces}>
          <div className={`${styles.circuitTrace} ${styles.circuitTrace1}`} />
          <div className={`${styles.circuitTrace} ${styles.circuitTrace2}`} />
          <div className={`${styles.circuitTrace} ${styles.circuitTrace3}`} />
          <div className={`${styles.circuitTrace} ${styles.circuitTrace4}`} />
          <div className={`${styles.circuitTrace} ${styles.circuitTrace5}`} />
        </div>
      )}

      {/* ── Text Phase ── */}
      <AnimatePresence>
        {showText && (
          <motion.div
            key="boot-text"
            className={styles.bootContent}
            exit={{
              opacity: 0,
              y: -30,
              filter: "blur(10px)",
              transition: { duration: 0.5, ease: EASE_OUT },
            }}
          >
            <div className={styles.bootLines} ref={scrollRef}>
              {/* Already-completed lines */}
              {completedLines.map((text, idx) => {
                if (text === "") return <div key={idx} className={styles.bootLineSpacer} />;
                const color = getLineColor(text);
                const textShadow = getLineTextShadow(text);
                const isBanner = text.includes("═") || text.includes("║");
                return (
                  <div
                    key={idx}
                    className={`${styles.bootLine} ${styles.bootLineCompleted} ${isBanner ? styles.bootLineBanner : ""}`}
                    style={{
                      color,
                      textShadow,
                      fontWeight: text.includes("ONLINE") ? 700 : undefined,
                      fontSize: text.includes("ONLINE") ? "12px" : undefined,
                    }}
                  >
                    {text}
                  </div>
                );
              })}

              {/* Currently typing line */}
              {currentLineIndex < bootLines.length && phase === "text" && (
                <TypewriterLine
                  key={`typing-${currentLineIndex}`}
                  text={bootLines[currentLineIndex]}
                  charDelay={charDelay}
                  onComplete={handleLineComplete}
                />
              )}
            </div>

            {/* Bottom status bar */}
            {phase === "postText" && (
              <motion.div
                className={styles.bootStatusBar}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              >
                <span className={styles.bootStatusReady}>SYSTEM READY</span>
                <span className={styles.bootStatusDivider}>|</span>
                <span className={styles.bootStatusDetail}>Initializing interface...</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main BootSequence ──

export function BootSequence({ forcePlay = false }: { forcePlay?: boolean }) {
  const { theme } = useTheme();
  const setBooting = useLayoutStore((s) => s.setBooting);
  const { enabled, duration } = useMemo(getBootSettings, []);
  const shouldPlay = forcePlay || enabled;
  const bootLines = useMemo(
    () => getBootLines(theme.bootSequence.lines, duration),
    [theme.bootSequence.lines, duration],
  );
  const [phase, setPhase] = useState<Phase>(shouldPlay ? "text" : "done");

  // Signal booting state to layoutStore
  useEffect(() => {
    if (phase === "done") {
      setBooting(false);
    } else {
      setBooting(true);
    }
  }, [phase, setBooting]);

  if (phase === "done") return null;
  if (!shouldPlay) return null;

  return (
    <CyberpunkBoot
      bootLines={bootLines}
      logoPath={theme.bootSequence.logoPath}
      duration={duration}
      onDone={() => setPhase("done")}
    />
  );
}
