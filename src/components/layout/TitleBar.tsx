import { MessageSquare, GitMerge, Bot, LayoutList } from "lucide-react";
import styles from "./TitleBar.module.css";

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

export function TitleBar({ openPanels, onTogglePanel }: TitleBarProps) {
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
        <span className={styles.hudLine} />
        <img
          src="/assets/daemon-logo.png"
          alt="D.A.E.M.O.N."
          className={styles.logoImg}
          title="Distributed Autonomous Engineering Management Orchestration Node"
        />
      </div>
    </div>
  );
}
