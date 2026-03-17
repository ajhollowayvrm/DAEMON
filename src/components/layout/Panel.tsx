import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import styles from "./Panel.module.css";

interface PanelProps {
  title: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: "default" | "green";
  children: ReactNode;
  style?: React.CSSProperties;
}

export function Panel({ title, icon: Icon, badge, badgeVariant = "default", children, style }: PanelProps) {
  return (
    <div className={styles.panel} style={style}>
      {/* Corner decorations */}
      <span className={styles.cornerTL} />
      <span className={styles.cornerTR} />
      <span className={styles.cornerBL} />
      <span className={styles.cornerBR} />

      <div className={styles.header}>
        <Icon size={16} className={styles.icon} />
        <span className={styles.title}>{title}</span>
        {badge !== undefined && (
          <span className={`${styles.badge} ${badgeVariant === "green" ? styles.badgeGreen : ""}`}>
            {badge}
          </span>
        )}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
