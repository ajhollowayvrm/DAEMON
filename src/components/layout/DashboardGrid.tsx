import { type ReactNode } from "react";
import styles from "./DashboardGrid.module.css";

interface DashboardGridProps {
  children: ReactNode;
}

export function DashboardGrid({ children }: DashboardGridProps) {
  return (
    <div className={styles.grid}>
      {children}
      <div className={styles.intersectionNode} />
    </div>
  );
}
