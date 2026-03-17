import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./theme/globals.css";
import { TitleBar } from "./components/layout/TitleBar";
import { StatusBar } from "./components/layout/StatusBar";
import { DashboardGrid } from "./components/layout/DashboardGrid";
import { ScanlineOverlay } from "./components/layout/ScanlineOverlay";
import { HudDecorations } from "./components/ui/HudDecorations";
import { BootSequence } from "./components/ui/BootSequence";
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

function App() {
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
        <TitleBar />
        <DashboardGrid>
          <SlackPanel />
          <GitLabPanel />
          <AgentsPanel />
          <LinearPanel />
        </DashboardGrid>
        <StatusBar />
        <ScanlineOverlay />
        <HudDecorations />
        <BootSequence />
      </div>
    </QueryClientProvider>
  );
}

export default App;
