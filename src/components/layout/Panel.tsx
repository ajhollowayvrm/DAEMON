import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import styles from "./Panel.module.css";
import { useTheme } from "../../themes";

interface PanelProps {
  title: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: "default" | "green";
  children: ReactNode;
  style?: React.CSSProperties;
}

/**
 * LCARS color palette for bar segments.
 * Each panel rotates the starting color based on its DOM index.
 */
const LCARS_COLORS = ["#ff9933", "#cc6699", "#9999ff", "#9966cc"];

/**
 * Generate a rotated color array for segment variety across panels.
 * panelIndex 0 => [orange, mauve, blue, purple]
 * panelIndex 1 => [mauve, blue, purple, orange]
 * etc.
 */
function getLcarsColors(panelIndex: number): string[] {
  const offset = panelIndex % LCARS_COLORS.length;
  return [...LCARS_COLORS.slice(offset), ...LCARS_COLORS.slice(0, offset)];
}

export function Panel({ title, icon: Icon, badge, badgeVariant = "default", children, style }: PanelProps) {
  const { theme } = useTheme();
  const isLcars = theme.layoutStyle === "lcars";

  if (isLcars) {
    return (
      <LcarsPanel
        title={title}
        icon={Icon}
        badge={badge}
        badgeVariant={badgeVariant}
        style={style}
      >
        {children}
      </LcarsPanel>
    );
  }

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

/* ── LCARS Panel ──────────────────────────────────────────────────
 *  L-shaped frame: vertical sidebar (left) + horizontal header (top)
 *  connected by a curved elbow in the top-left corner.
 *  Both bars are segmented with colored blocks separated by black gaps.
 * ─────────────────────────────────────────────────────────────── */

interface LcarsPanelProps {
  title: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: "default" | "green";
  children: ReactNode;
  style?: React.CSSProperties;
}

function LcarsPanel({ title, icon: Icon, badge, badgeVariant = "default", children, style }: LcarsPanelProps) {
  // Use a simple index derived from the title for color rotation
  const panelIndex = title.charCodeAt(0) % 4;
  const colors = getLcarsColors(panelIndex);

  return (
    <div className={styles.panelLcars} style={style}>
      <div className={styles.lcarsFrame}>
        {/* Top-left elbow: connects sidebar to header bar */}
        <div
          className={styles.lcarsElbowCorner}
          style={{ background: colors[0] }}
        />

        {/* Header bar (top) — segmented colored blocks with title */}
        <div className={styles.lcarsHeaderBar}>
          <div className={styles.lcarsHeaderSegments}>
            <div
              className={styles.lcarsHeaderSegment}
              style={{ background: colors[1], flex: "0 0 80px" }}
            />
            <div
              className={styles.lcarsHeaderSegment}
              style={{ background: colors[2], flex: "0 0 50px" }}
            />
            <div className={styles.lcarsHeaderTitle}>
              <Icon size={14} className={styles.iconLcars} />
              <span className={styles.titleLcars}>{title}</span>
            </div>
            {badge !== undefined && (
              <span className={`${styles.badgeLcars} ${badgeVariant === "green" ? styles.badgeLcarsGreen : ""}`}>
                {badge}
              </span>
            )}
            <div
              className={styles.lcarsHeaderSegment}
              style={{ background: colors[3], flex: "0 0 40px", borderRadius: "0 20px 20px 0" }}
            />
          </div>
        </div>

        {/* Thin separator line below header */}
        <div className={styles.lcarsSeparatorLeft} style={{ background: colors[0] }} />
        <div className={styles.lcarsSeparatorRight} />

        {/* Sidebar (left) — segmented colored blocks */}
        <div className={styles.lcarsSidebar}>
          <div
            className={styles.lcarsSidebarSegment}
            style={{ background: colors[0], flex: "1 1 auto" }}
          />
          <div
            className={styles.lcarsSidebarSegment}
            style={{ background: colors[1], flex: "0 0 30px" }}
          />
          <div
            className={styles.lcarsSidebarSegment}
            style={{ background: colors[2], flex: "0 0 20px" }}
          />
          {/* Pill-shaped bottom end */}
          <div
            className={styles.lcarsSidebarPill}
            style={{ background: colors[3] }}
          />
        </div>

        {/* Content area — right of sidebar, below header */}
        <div className={styles.lcarsContent}>
          {children}
        </div>
      </div>
    </div>
  );
}
