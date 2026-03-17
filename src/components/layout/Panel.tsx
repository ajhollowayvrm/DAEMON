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
 * Minimal LCARS color scheme per panel.
 * Each panel uses ONE primary color and ONE accent — not a rainbow.
 */
const LCARS_PANEL_COLORS: Record<string, { primary: string; accent: string }> = {
  "Slack":       { primary: "#ff9933", accent: "#cc9966" },   // orange + tan
  "GitLab MRs":  { primary: "#9999ff", accent: "#9966cc" },   // blue + purple
  "Agent Teams": { primary: "#9966cc", accent: "#ff9933" },   // purple + orange
  "Linear":      { primary: "#cc9966", accent: "#9999ff" },   // tan + blue
};

const LCARS_DEFAULT_COLORS = { primary: "#ff9933", accent: "#cc9966" };

function getLcarsPanelColors(title: string) {
  return LCARS_PANEL_COLORS[title] ?? LCARS_DEFAULT_COLORS;
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
  const { primary, accent } = getLcarsPanelColors(title);

  return (
    <div className={styles.panelLcars} style={style}>
      <div className={styles.lcarsFrame}>
        {/* Top-left elbow: connects sidebar to header bar */}
        <div
          className={styles.lcarsElbowCorner}
          style={{ background: primary }}
        />

        {/* Header bar (top) — accent chip + main fill with title + pill end */}
        <div className={styles.lcarsHeaderBar}>
          <div className={styles.lcarsHeaderSegments}>
            <div
              className={styles.lcarsHeaderSegment}
              style={{ background: accent, flex: "0 0 40px" }}
            />
            <div
              className={styles.lcarsHeaderFill}
              style={{ background: primary }}
            >
              <div className={styles.lcarsHeaderTitle}>
                <Icon size={13} className={styles.iconLcars} />
                <span className={styles.titleLcars}>{title}</span>
                {badge !== undefined && (
                  <span className={`${styles.badgeLcars} ${badgeVariant === "green" ? styles.badgeLcarsGreen : ""}`}>
                    {badge}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Thin separator line below header */}
        <div className={styles.lcarsSeparatorLeft} style={{ background: primary }} />
        <div className={styles.lcarsSeparatorRight} />

        {/* Sidebar (left) — main fill + accent pill at bottom */}
        <div className={styles.lcarsSidebar}>
          <div
            className={styles.lcarsSidebarSegment}
            style={{ background: primary, flex: "1 1 auto" }}
          />
          {/* Pill-shaped bottom end */}
          <div
            className={styles.lcarsSidebarPill}
            style={{ background: accent }}
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
