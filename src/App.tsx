import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import "./theme/globals.css";
import { TitleBar, type PanelId } from "./components/layout/TitleBar";
import { StatusBar } from "./components/layout/StatusBar";
import { DashboardGrid } from "./components/layout/DashboardGrid";
import { ScanlineOverlay } from "./components/layout/ScanlineOverlay";
import { HudDecorations } from "./components/ui/HudDecorations";
import { BootSequence } from "./components/ui/BootSequence";
import { SettingsModal } from "./components/ui/SettingsModal";
import { EmptySlot } from "./components/layout/EmptySlot";
import { SlackPanel } from "./panels/slack/SlackPanel";
import { GitLabPanel } from "./panels/gitlab/GitLabPanel";
import { AgentsPanel } from "./panels/agents/AgentsPanel";
import { LinearPanel } from "./panels/linear/LinearPanel";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

const PANEL_ORDER: PanelId[] = ["slack", "gitlab", "agents", "linear"];

const PANEL_COMPONENTS: Record<PanelId, React.ComponentType> = {
  slack: SlackPanel,
  gitlab: GitLabPanel,
  agents: AgentsPanel,
  linear: LinearPanel,
};

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [openPanels, setOpenPanels] = useState<Set<PanelId>>(
    new Set(PANEL_ORDER),
  );

  const togglePanel = useCallback((id: PanelId) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const unlisten = listen("open-settings", () => {
      setShowSettings(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "relative",
          zIndex: 1,
        }}
      >
        <TitleBar openPanels={openPanels} onTogglePanel={togglePanel} />
        <DashboardGrid>
          {PANEL_ORDER.map((id) => {
            if (openPanels.has(id)) {
              const Component = PANEL_COMPONENTS[id];
              return <Component key={id} />;
            }
            return <EmptySlot key={id} />;
          })}
        </DashboardGrid>
        <StatusBar onOpenSettings={() => setShowSettings(true)} />
        <ScanlineOverlay />
        <HudDecorations />
        <BootSequence />
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
      </div>
    </QueryClientProvider>
  );
}

export default App;
