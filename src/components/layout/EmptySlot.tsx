import styles from "./EmptySlot.module.css";
import { useTheme } from "../../themes";

/** Dark gray LCARS colors for the offline/dimmed frame */
const LCARS_DIM_COLORS = ["#333340", "#2a2a38", "#252535", "#303040"];

export function EmptySlot() {
  const { theme } = useTheme();
  const isLcars = theme.layoutStyle === "lcars";

  if (isLcars) {
    return (
      <div className={styles.slotLcars}>
        <div className={styles.lcarsFrame}>
          {/* Dimmed elbow */}
          <div
            className={styles.lcarsElbow}
            style={{ background: LCARS_DIM_COLORS[0] }}
          />

          {/* Dimmed header bar */}
          <div className={styles.lcarsHeader}>
            <div className={styles.lcarsHeaderSeg} style={{ background: LCARS_DIM_COLORS[1], flex: "0 0 80px" }} />
            <div className={styles.lcarsHeaderSeg} style={{ background: LCARS_DIM_COLORS[2], flex: "0 0 50px" }} />
            <div className={styles.lcarsHeaderSeg} style={{ background: LCARS_DIM_COLORS[3], flex: "1 1 auto" }} />
            <div className={styles.lcarsHeaderSeg} style={{ background: LCARS_DIM_COLORS[0], flex: "0 0 40px", borderRadius: "0 20px 20px 0" }} />
          </div>

          {/* Separator */}
          <div className={styles.lcarsSepLeft} style={{ background: LCARS_DIM_COLORS[0] }} />
          <div className={styles.lcarsSepRight} />

          {/* Dimmed sidebar */}
          <div className={styles.lcarsSidebar}>
            <div className={styles.lcarsSidebarSeg} style={{ background: LCARS_DIM_COLORS[0], flex: "1 1 auto" }} />
            <div className={styles.lcarsSidebarSeg} style={{ background: LCARS_DIM_COLORS[1], flex: "0 0 30px" }} />
            <div className={styles.lcarsSidebarSeg} style={{ background: LCARS_DIM_COLORS[2], flex: "0 0 20px" }} />
            <div className={styles.lcarsSidebarPill} style={{ background: LCARS_DIM_COLORS[3] }} />
          </div>

          {/* Content area with OFFLINE text */}
          <div className={styles.lcarsContentArea}>
            <span className={styles.lcarsOfflineText}>OFFLINE</span>
            <span className={styles.lcarsOfflineHint}>Use header bar to activate</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.slot}>
      <div className={styles.slotContent}>
        <span className={styles.slotIcon}>&#x2B21;</span>
        <span className={styles.slotText}>Panel offline</span>
        <span className={styles.slotHint}>Use header bar to activate</span>
      </div>
    </div>
  );
}
