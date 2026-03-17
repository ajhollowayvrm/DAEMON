import styles from "./EmptySlot.module.css";
import { useTheme } from "../../themes";

/** Dark gray LCARS colors for the offline/dimmed frame */
const LCARS_DIM = { primary: "#2a2a38", accent: "#222230" };

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
            style={{ background: LCARS_DIM.primary }}
          />

          {/* Dimmed header bar — accent chip + fill with pill end */}
          <div className={styles.lcarsHeader}>
            <div className={styles.lcarsHeaderSeg} style={{ background: LCARS_DIM.accent, flex: "0 0 40px" }} />
            <div className={styles.lcarsHeaderSeg} style={{ background: LCARS_DIM.primary, flex: "1 1 auto", borderRadius: "0 15px 15px 0" }} />
          </div>

          {/* Separator */}
          <div className={styles.lcarsSepLeft} style={{ background: LCARS_DIM.primary }} />
          <div className={styles.lcarsSepRight} />

          {/* Dimmed sidebar — main fill + accent pill */}
          <div className={styles.lcarsSidebar}>
            <div className={styles.lcarsSidebarSeg} style={{ background: LCARS_DIM.primary, flex: "1 1 auto" }} />
            <div className={styles.lcarsSidebarPill} style={{ background: LCARS_DIM.accent }} />
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
