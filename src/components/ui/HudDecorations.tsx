import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import styles from "./HudDecorations.module.css";
import { useTheme } from "../../themes";

/** Generate a random character from a stream character set */
function randomStreamChar(chars: string) {
  return chars[Math.floor(Math.random() * chars.length)];
}

/** Generate a column of stream characters */
function generateStreamColumn(chars: string) {
  const length = 15 + Math.floor(Math.random() * 20);
  return Array.from({ length }, () => randomStreamChar(chars)).join("\n");
}

/** Configuration for floating particles */
interface ParticleConfig {
  id: number;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
}

function generateParticles(count: number, particleColors: string[]): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => {
    const opacity = 0.08 + Math.random() * 0.12;
    const colorTemplate = particleColors[i % particleColors.length];
    return {
      id: i,
      size: 2 + Math.random() * 2,
      startX: 5 + Math.random() * 90,
      startY: 10 + Math.random() * 80,
      driftX: (Math.random() - 0.5) * 200,
      driftY: -60 - Math.random() * 120,
      duration: 12 + Math.random() * 16,
      delay: Math.random() * 10,
      opacity,
      color: colorTemplate.replace("VAR_OPACITY", opacity.toFixed(2)),
    };
  });
}

/** Stream column configuration */
interface StreamColumnConfig {
  id: number;
  chars: string;
  left: number;
  speed: number;
  opacity: number;
  delay: number;
  side: "left" | "right";
}

function generateStreamColumns(count: number, streamChars: string): StreamColumnConfig[] {
  const cols: StreamColumnConfig[] = [];
  for (let i = 0; i < count; i++) {
    const side = i < count / 2 ? "left" : "right";
    const baseLeft =
      side === "left"
        ? 4 + (i * 18)
        : 100 - 4 - ((i - count / 2) * 18);
    cols.push({
      id: i,
      chars: generateStreamColumn(streamChars),
      left: baseLeft,
      speed: 8 + Math.random() * 14,
      opacity: 0.06 + Math.random() * 0.1,
      delay: Math.random() * 8,
      side,
    });
  }
  return cols;
}

export function HudDecorations() {
  const { theme } = useTheme();

  const { streamCharacters, streamColumnCount, particleCount, particleColors } = theme.hud;

  // Generate stable configurations once (re-generate when theme changes)
  const streamColumns = useMemo(
    () => generateStreamColumns(streamColumnCount, streamCharacters),
    [streamColumnCount, streamCharacters],
  );
  const particles = useMemo(
    () => generateParticles(particleCount, particleColors),
    [particleCount, particleColors],
  );

  // Periodically refresh stream characters
  const [streamChars, setStreamChars] = useState<string[]>(() =>
    streamColumns.map((c) => c.chars)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setStreamChars(streamColumns.map(() => generateStreamColumn(streamCharacters)));
    }, 6000);
    return () => clearInterval(interval);
  }, [streamColumns, streamCharacters]);

  return (
    <div className={styles.hudContainer}>
      {/* Corner brackets */}
      <div className={styles.cornerMarkTL} />
      <div className={styles.cornerMarkTR} />
      <div className={styles.cornerMarkBL} />
      <div className={styles.cornerMarkBR} />

      {/* Decorative lines with dots */}
      <div className={styles.decorLineTop}>
        <span className={styles.lineDot} />
        <span className={styles.lineBar} />
        <span className={styles.lineDot} />
      </div>
      <div className={styles.decorLineBottom}>
        <span className={styles.lineDot} />
        <span className={styles.lineBar} />
        <span className={styles.lineDot} />
      </div>

      {/* Cyberpunk animated circuit lines */}
      <svg className={styles.circuitOverlay} viewBox="0 0 1920 1080" preserveAspectRatio="none">
        {/* Top-left circuit */}
        <motion.path
          d="M 0 120 L 80 120 L 100 100 L 200 100"
          className={styles.circuitLine}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.4, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
        />
        <motion.path
          d="M 0 180 L 50 180 L 70 160 L 160 160 L 180 180 L 250 180"
          className={styles.circuitLine}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.3, 0.1] }}
          transition={{ duration: 1.5, delay: 1, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
        />
        {/* Top-right circuit */}
        <motion.path
          d="M 1920 150 L 1820 150 L 1800 130 L 1700 130"
          className={styles.circuitLineCyan}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.35, 0.12] }}
          transition={{ duration: 1.8, delay: 0.5, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }}
        />
        {/* Bottom-left circuit */}
        <motion.path
          d="M 0 900 L 120 900 L 140 920 L 280 920"
          className={styles.circuitLineMagenta}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.3, 0.1] }}
          transition={{ duration: 2.2, delay: 2, repeat: Infinity, repeatDelay: 7, ease: "easeInOut" }}
        />
        {/* Bottom-right circuit */}
        <motion.path
          d="M 1920 950 L 1840 950 L 1820 930 L 1720 930 L 1700 950 L 1650 950"
          className={styles.circuitLine}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.35, 0.12] }}
          transition={{ duration: 1.6, delay: 3, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
        />
        {/* Left edge vertical circuit */}
        <motion.path
          d="M 30 300 L 30 400 L 50 420 L 50 520 L 30 540 L 30 600"
          className={styles.circuitLineCyan}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.25, 0.08] }}
          transition={{ duration: 3, delay: 1.5, repeat: Infinity, repeatDelay: 8, ease: "easeInOut" }}
        />
        {/* Right edge vertical circuit */}
        <motion.path
          d="M 1890 350 L 1890 450 L 1870 470 L 1870 550 L 1890 570 L 1890 650"
          className={styles.circuitLine}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.2, 0.07] }}
          transition={{ duration: 2.8, delay: 4, repeat: Infinity, repeatDelay: 9, ease: "easeInOut" }}
        />
        {/* Mid-left horizontal with branch */}
        <motion.path
          d="M 0 540 L 40 540 L 60 520 L 120 520 L 140 540 L 200 540 L 220 520"
          className={styles.circuitLineMagenta}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.2, 0.06] }}
          transition={{ duration: 2.5, delay: 6, repeat: Infinity, repeatDelay: 10, ease: "easeInOut" }}
        />
        {/* Mid-right horizontal */}
        <motion.path
          d="M 1920 480 L 1860 480 L 1840 500 L 1760 500 L 1740 480 L 1680 480"
          className={styles.circuitLineCyan}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.25, 0.08] }}
          transition={{ duration: 2, delay: 3.5, repeat: Infinity, repeatDelay: 7, ease: "easeInOut" }}
        />
        {/* Top-left diagonal connector */}
        <motion.path
          d="M 100 100 L 100 140 L 120 160"
          className={styles.circuitLine}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.3, 0.1] }}
          transition={{ duration: 1, delay: 2, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
        />
        {/* Bottom center trace */}
        <motion.path
          d="M 800 1060 L 800 1020 L 820 1000 L 920 1000 L 940 1020 L 1100 1020 L 1120 1000"
          className={styles.circuitLine}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.15, 0.05] }}
          transition={{ duration: 2.5, delay: 5, repeat: Infinity, repeatDelay: 8, ease: "easeInOut" }}
        />
        {/* Top center trace */}
        <motion.path
          d="M 700 20 L 700 50 L 720 70 L 850 70 L 870 50 L 870 20"
          className={styles.circuitLineCyan}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.2, 0.06] }}
          transition={{ duration: 2, delay: 7, repeat: Infinity, repeatDelay: 9, ease: "easeInOut" }}
        />

        {/* Circuit nodes — glowing dots at intersections */}
        <motion.circle
          cx="200" cy="100" r="2"
          className={styles.circuitNode}
          animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2, delay: 2, repeat: Infinity, repeatDelay: 4 }}
        />
        <motion.circle
          cx="250" cy="180" r="2"
          className={styles.circuitNode}
          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2, delay: 2.5, repeat: Infinity, repeatDelay: 5 }}
        />
        <motion.circle
          cx="1700" cy="130" r="2"
          className={styles.circuitNodeCyan}
          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2, delay: 2.3, repeat: Infinity, repeatDelay: 6 }}
        />
        <motion.circle
          cx="280" cy="920" r="2"
          className={styles.circuitNodeMagenta}
          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2, delay: 4.2, repeat: Infinity, repeatDelay: 7 }}
        />
        {/* Additional nodes on new circuits */}
        <motion.circle
          cx="50" cy="520" r="2"
          className={styles.circuitNodeCyan}
          animate={{ opacity: [0, 0.4, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{ duration: 2, delay: 3, repeat: Infinity, repeatDelay: 8 }}
        />
        <motion.circle
          cx="1870" cy="470" r="2"
          className={styles.circuitNode}
          animate={{ opacity: [0, 0.4, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{ duration: 2, delay: 5, repeat: Infinity, repeatDelay: 9 }}
        />
        <motion.circle
          cx="1680" cy="480" r="2"
          className={styles.circuitNodeCyan}
          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2, delay: 5.5, repeat: Infinity, repeatDelay: 7 }}
        />
        <motion.circle
          cx="220" cy="520" r="2"
          className={styles.circuitNodeMagenta}
          animate={{ opacity: [0, 0.4, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{ duration: 2, delay: 7, repeat: Infinity, repeatDelay: 10 }}
        />
        <motion.circle
          cx="920" cy="1000" r="2"
          className={styles.circuitNode}
          animate={{ opacity: [0, 0.3, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{ duration: 2, delay: 6, repeat: Infinity, repeatDelay: 8 }}
        />
        <motion.circle
          cx="850" cy="70" r="2"
          className={styles.circuitNodeCyan}
          animate={{ opacity: [0, 0.35, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{ duration: 2, delay: 8, repeat: Infinity, repeatDelay: 9 }}
        />
      </svg>

      {/* Data stream columns (Matrix rain) */}
      {streamColumns.map((col, idx) => (
        <div
          key={col.id}
          className={styles.streamColumn}
          style={{
            left: `${col.left}px`,
            animationDuration: `${col.speed}s`,
            animationDelay: `${col.delay}s`,
            opacity: col.opacity,
          }}
        >
          {streamChars[idx]}
        </div>
      ))}

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.startX}%`,
            top: `${p.startY}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--drift-x" as string]: `${p.driftX}px`,
            ["--drift-y" as string]: `${p.driftY}px`,
            ["--particle-opacity" as string]: `${p.opacity}`,
          }}
        />
      ))}
    </div>
  );
}
