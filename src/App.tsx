import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import "./theme/globals.css";
import { ThemeProvider } from "./themes";
import { TitleBar } from "./components/layout/TitleBar";
import { StatusBar } from "./components/layout/StatusBar";
import { AppShell } from "./components/layout/AppShell";
import { LavaBackground } from "./components/layout/LavaBackground";
import { ScanlineOverlay } from "./components/layout/ScanlineOverlay";
import { HudDecorations } from "./components/ui/HudDecorations";
import { BootSequence } from "./components/ui/BootSequence";
import { SettingsModal } from "./components/ui/SettingsModal";
import { TerminalDrawer } from "./components/ai/TerminalDrawer";
import { AgentToastContainer } from "./components/ui/AgentToastContainer";
import { useCorrelationEngine, useMonitorDetectors } from "./hooks";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Inner shell — must be inside QueryClientProvider for useMonitorDetectors */
function DaemonShell() {
  const [showSettings, setShowSettings] = useState(false);
  const [bootKey, setBootKey] = useState(0);

  // Proactive monitoring — detects events from React Query cache updates
  useMonitorDetectors();

  // Cross-panel intelligence — builds correlation index from all data sources
  useCorrelationEngine();

  useEffect(() => {
    const unlistenSettings = listen("open-settings", () => {
      setShowSettings(true);
    });
    const unlistenBoot = listen("replay-boot", () => {
      setBootKey((k) => k + 1);
    });
    return () => {
      unlistenSettings.then((fn) => fn());
      unlistenBoot.then((fn) => fn());
    };
  }, []);

  return (
    <>
      <LavaBackground />
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
        <AppShell />
        <StatusBar onOpenSettings={() => setShowSettings(true)} />
        <TerminalDrawer />
        <ScanlineOverlay />
        <HudDecorations />
        <AgentToastContainer />
        <BootSequence key={bootKey} forcePlay={bootKey > 0} />
        <AnimatePresence>
          {showSettings && (
            <SettingsModal onClose={() => setShowSettings(false)} />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <DaemonShell />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
