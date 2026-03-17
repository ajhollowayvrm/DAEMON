import { type ReactNode } from "react";
import styles from "./GradientText.module.css";

interface GradientTextProps {
  children: ReactNode;
  as?: "span" | "h1" | "h2" | "h3" | "p";
}

export function GradientText({ children, as: Tag = "span" }: GradientTextProps) {
  return <Tag className={styles.gradient}>{children}</Tag>;
}
