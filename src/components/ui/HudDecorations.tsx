import { useState, useEffect, useMemo } from "react";
import styles from "./HudDecorations.module.css";

/** Generates a fake stat value that drifts slightly over time */
function useFakeStat(base: number, range: number, label: string) {
  const [value, setValue] = useState(base);

  useEffect(() => {
    const interval = setInterval(() => {
      const drift = (Math.random() - 0.5) * range;
      setValue(Math.min(99.9, Math.max(10, base + drift)));
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [base, range]);

  return `${label}: ${value.toFixed(1)}%`;
}

/** Characters used in the data stream columns */
const STREAM_CHARS = "01/\\|-ABCDEFabcdef0123456789><{}[]";

/** Generate a random character from the stream set */
function randomStreamChar() {
  return STREAM_CHARS[Math.floor(Math.random() * STREAM_CHARS.length)];
}

/** Generate a column of stream characters */
function generateStreamColumn() {
  const length = 15 + Math.floor(Math.random() * 20);
  return Array.from({ length }, () => randomStreamChar()).join("\n");
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

const PARTICLE_COLORS = [
  "rgba(0, 255, 245, VAR_OPACITY)",   // cyan
  "rgba(255, 44, 241, VAR_OPACITY)",   // magenta
  "rgba(176, 38, 255, VAR_OPACITY)",   // purple
];

function generateParticles(count: number): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => {
    const opacity = 0.08 + Math.random() * 0.12;
    const colorTemplate = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
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

function generateStreamColumns(count: number): StreamColumnConfig[] {
  const cols: StreamColumnConfig[] = [];
  for (let i = 0; i < count; i++) {
    const side = i < count / 2 ? "left" : "right";
    const baseLeft =
      side === "left"
        ? 4 + (i * 18)
        : 100 - 4 - ((i - count / 2) * 18);
    cols.push({
      id: i,
      chars: generateStreamColumn(),
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
  const memStat = useFakeStat(94.2, 4, "MEM");
  const cpuStat = useFakeStat(23.5, 12, "CPU");
  const netStat = useFakeStat(87.0, 8, "NET");
  const bufStat = useFakeStat(62.3, 10, "BUF");

  // Generate stable configurations once
  const streamColumns = useMemo(() => generateStreamColumns(8), []);
  const particles = useMemo(() => generateParticles(10), []);

  // Periodically refresh stream characters
  const [streamChars, setStreamChars] = useState<string[]>(() =>
    streamColumns.map((c) => c.chars)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setStreamChars(streamColumns.map(() => generateStreamColumn()));
    }, 6000);
    return () => clearInterval(interval);
  }, [streamColumns]);

  return (
    <div className={styles.hudContainer}>
      {/* Corner brackets */}
      <div className={styles.cornerMarkTL} />
      <div className={styles.cornerMarkTR} />
      <div className={styles.cornerMarkBL} />
      <div className={styles.cornerMarkBR} />

      {/* Data readouts */}
      <span className={styles.dataReadoutTL}>{memStat}</span>
      <span className={styles.dataReadoutTR}>{cpuStat}</span>
      <span className={styles.dataReadoutBL}>{netStat}</span>
      <span className={styles.dataReadoutBR}>{bufStat}</span>

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
