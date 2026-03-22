import styles from "./ScanlineOverlay.module.css";

interface ScanlineOverlayProps {
  enabled?: boolean;
}

export function ScanlineOverlay({ enabled = true }: ScanlineOverlayProps) {
  if (!enabled) return null;
  return (
    <>
      <div className={styles.scanlines} />
      <div className={styles.chromaticEdge} />
    </>
  );
}
