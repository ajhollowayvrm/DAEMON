import { type ButtonHTMLAttributes } from "react";
import styles from "./NeonButton.module.css";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "magenta" | "purple";
}

export function NeonButton({
  variant = "cyan",
  className,
  ...props
}: NeonButtonProps) {
  const variantClass = variant !== "cyan" ? styles[variant] : "";
  return (
    <button
      className={`${styles.button} ${variantClass} ${className ?? ""}`}
      {...props}
    />
  );
}
