import { MessageSquare, GitMerge, Bot, LayoutList } from "lucide-react";
import styles from "./TitleBar.module.css";
import { useTheme } from "../../themes";

export type PanelId = "slack" | "gitlab" | "agents" | "linear";

interface TitleBarProps {
  openPanels: Set<PanelId>;
  onTogglePanel: (id: PanelId) => void;
}

const PANELS: { id: PanelId; label: string; icon: typeof MessageSquare }[] = [
  { id: "slack", label: "Slack", icon: MessageSquare },
  { id: "gitlab", label: "GitLab", icon: GitMerge },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "linear", label: "Linear", icon: LayoutList },
];

/** LCARS button color cycle: orange, tan, blue, purple */
const LCARS_BUTTON_COLORS = ["#ff9933", "#cc6699", "#9999ff", "#9966cc"];

export function TitleBar({ openPanels, onTogglePanel }: TitleBarProps) {
  const { theme } = useTheme();
  const isLcars = theme.layoutStyle === "lcars";

  if (isLcars) {
    return (
      <div className={styles.titleBarLcars} data-tauri-drag-region>
        {/* Large curved elbow on the left */}
        <div className={styles.lcarsElbow} />

        {/* Segmented colored bar across the top */}
        <div className={styles.lcarsBarSegments}>
          <div className={styles.lcarsBarSeg} style={{ background: "#ff9933", flex: "0 0 120px" }} />
          <div className={styles.lcarsBarSeg} style={{ background: "#9999ff", flex: "0 0 60px" }} />
          <div className={styles.lcarsBarSeg} style={{ background: "#cc6699", flex: "0 0 80px" }} />

          {/* Panel toggle buttons sit inside the bar */}
          <div className={styles.panelTogglesLcars}>
            {PANELS.map(({ id, label, icon: Icon }, idx) => (
              <button
                key={id}
                className={`${styles.panelToggleLcars} ${openPanels.has(id) ? styles.panelToggleLcarsActive : ""}`}
                onClick={() => onTogglePanel(id)}
                title={`${openPanels.has(id) ? "Close" : "Open"} ${label}`}
                style={{ "--lcars-btn-color": LCARS_BUTTON_COLORS[idx % LCARS_BUTTON_COLORS.length] } as React.CSSProperties}
              >
                <Icon size={13} />
                <span className={styles.panelToggleLabel}>{label}</span>
              </button>
            ))}
          </div>

          {/* Fill segment that stretches */}
          <div className={styles.lcarsBarSeg} style={{ background: "#9966cc", flex: "1 1 auto" }} />
          {/* Pill-shaped right end */}
          <div className={styles.lcarsBarSeg} style={{ background: "#ff9933", flex: "0 0 50px", borderRadius: "0 25px 25px 0" }} />
        </div>

        {/* Logo — right side */}
        <div className={styles.logoSection}>
          <img
            src="/assets/daemon-logo.png?v=5"
            alt="D.A.E.M.O.N."
            className={styles.logoImgLcars}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.titleBar} data-tauri-drag-region>
      {/* Panel toggle buttons — left side */}
      <div className={styles.panelToggles}>
        {PANELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.panelToggle} ${openPanels.has(id) ? styles.panelToggleActive : ""}`}
            onClick={() => onTogglePanel(id)}
            title={`${openPanels.has(id) ? "Close" : "Open"} ${label}`}
          >
            <Icon size={13} />
            <span className={styles.panelToggleLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* Logo — right side */}
      <div className={styles.logoSection}>
        <img
          src="/assets/daemon-logo.png?v=5"
          alt="D.A.E.M.O.N."
          className={styles.logoImg}
        />
      </div>
    </div>
  );
}
