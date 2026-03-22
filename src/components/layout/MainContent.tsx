import { type ComponentType } from "react";
import { useLayoutStore, type PanelId } from "../../stores/layoutStore";
import { HubPanel } from "../../panels/hub/HubPanel";
import { SlackPanel } from "../../panels/slack/SlackPanel";
import { GitLabPanel } from "../../panels/gitlab/GitLabPanel";
import { AgentsPanel } from "../../panels/agents/AgentsPanel";
import { LinearPanel } from "../../panels/linear/LinearPanel";
import { TodosPanel } from "../../panels/todos/TodosPanel";
import { ArchivePanel } from "../../panels/archive/ArchivePanel";
import { BrowserPanel } from "../../panels/browser/BrowserPanel";
import { DatadogPanel } from "../../panels/datadog/DatadogPanel";
import styles from "./MainContent.module.css";

const PANEL_COMPONENTS: Record<PanelId, ComponentType> = {
  hub: HubPanel,
  slack: SlackPanel,
  gitlab: GitLabPanel,
  agents: AgentsPanel,
  linear: LinearPanel,
  todos: TodosPanel,
  archive: ArchivePanel,
  browser: BrowserPanel,
  datadog: DatadogPanel,
};

export function MainContent() {
  const activePanel = useLayoutStore((s) => s.activePanel);
  const Component = PANEL_COMPONENTS[activePanel];

  return (
    <main className={styles.main}>
      <Component key={activePanel} />
    </main>
  );
}
