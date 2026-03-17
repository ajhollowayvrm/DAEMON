import { type ReactNode, type CSSProperties } from "react";
import styles from "./HoverTooltip.module.css";

interface HoverTooltipProps {
  children: ReactNode;
  label: string;
  /** Direction the line extends: "right" (default) or "left" */
  direction?: "right" | "left";
  /** Color variant: "cyan" (default) or "magenta" */
  color?: "cyan" | "magenta";
  /** Length of the connecting line in px */
  lineLength?: number;
  className?: string;
}

export function HoverTooltip({
  children,
  label,
  direction = "right",
  color = "cyan",
  lineLength = 60,
  className,
}: HoverTooltipProps) {
  const lineStyle: CSSProperties = {
    "--line-length": `${lineLength}px`,
  } as CSSProperties;

  const isLeft = direction === "left";
  const isMagenta = color === "magenta";

  const lineClass = isLeft
    ? styles.lineLeft
    : isMagenta
      ? styles.lineMagenta
      : styles.line;

  const textClass = isLeft
    ? styles.textLeft
    : isMagenta
      ? styles.textMagenta
      : styles.text;

  return (
    <span className={`${styles.wrapper} ${className ?? ""}`}>
      {children}
      <span className={lineClass} style={lineStyle} />
      <span className={textClass} style={lineStyle}>
        {label}
      </span>
    </span>
  );
}
