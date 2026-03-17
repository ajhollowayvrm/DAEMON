import { type ReactNode } from "react";
import styles from "./GlowCard.module.css";

interface GlowCardProps {
  children: ReactNode;
  urgent?: boolean;
  className?: string;
  onClick?: () => void;
}

export function GlowCard({ children, urgent, className, onClick }: GlowCardProps) {
  return (
    <div
      className={`${styles.card} ${urgent ? styles.urgent : ""} ${onClick ? styles.clickable : ""} ${className ?? ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    >
      {children}
    </div>
  );
}
