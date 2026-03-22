import { useState, useMemo, useEffect } from "react";
import { Activity, ArrowLeft, ExternalLink } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { Panel } from "../../components/layout/Panel";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { ActionMenu } from "../../components/ai/ActionMenu";
import { AgentPromptBar } from "../../components/ai/AgentPromptBar";
import { AddToFocusButton } from "../../components/ui/AddToFocusButton";
import { RelatedItems, CorrelationBadge } from "../../components/ui/RelatedItems";
import { useDatadogMonitors } from "../../hooks";
import { useLayoutStore } from "../../stores/layoutStore";
import type { DatadogMonitor } from "../../types/models";
import styles from "./DatadogPanel.module.css";

// ── Status helpers ──

function statusOrder(status: string): number {
  switch (status) {
    case "Alert": return 0;
    case "Warn": return 1;
    case "No Data": return 2;
    case "OK": return 3;
    default: return 4;
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "Alert": return styles.statusAlert;
    case "Warn": return styles.statusWarn;
    case "OK": return styles.statusOk;
    default: return styles.statusNoData;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Alert": return styles.badgeAlert;
    case "Warn": return styles.badgeWarn;
    case "OK": return styles.badgeOk;
    default: return styles.badgeNoData;
  }
}

// ── Monitor Card ──

function MonitorCard({
  monitor,
  onSelect,
}: {
  monitor: DatadogMonitor;
  onSelect: () => void;
}) {
  const isComms = monitor.tags.includes("team:comms");
  return (
    <div className={styles.monitorCard} onClick={onSelect}>
      <div className={`${styles.statusDot} ${statusDotClass(monitor.status)}`} />
      <div className={styles.monitorContent}>
        <div className={styles.monitorName}>{monitor.name}</div>
        <div className={styles.monitorMeta}>
          <span className={styles.monitorType}>{monitor.monitor_type}</span>
          {isComms && <span className={styles.commsTag}>comms</span>}
          {monitor.tags.filter((t) => t !== "team:comms").slice(0, 2).map((tag) => (
            <span key={tag} className={styles.monitorTag}>{tag}</span>
          ))}
        </div>
      </div>
      <CorrelationBadge entityId={`datadog:${monitor.id}`} />
      <span className={`${styles.statusBadge} ${statusBadgeClass(monitor.status)}`}>
        {monitor.status}
      </span>
    </div>
  );
}

// ── Monitor Detail View ──

function MonitorDetail({
  monitor,
  onBack,
}: {
  monitor: DatadogMonitor;
  onBack: () => void;
}) {
  const ddUrl = `https://app.datadoghq.com/monitors/${monitor.id}`;

  return (
    <div className={styles.detailView}>
      <div className={styles.detailToolbar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={12} />
          Back
        </button>
        <span className={`${styles.statusBadge} ${statusBadgeClass(monitor.status)}`}>
          {monitor.status}
        </span>
        <AddToFocusButton
          link={{
            source: "datadog",
            label: monitor.name,
            subtitle: `${monitor.status} · ${monitor.monitor_type}`,
            sourceId: String(monitor.id),
          }}
          title={monitor.name}
        />
        <CorrelationBadge entityId={`datadog:${monitor.id}`} />
        <button
          className={styles.backBtn}
          onClick={() => open(ddUrl)}
          title="Open in Datadog"
        >
          <ExternalLink size={11} />
        </button>
        <ActionMenu
          source="datadog"
          context={{
            monitorName: monitor.name,
            monitorId: monitor.id,
            status: monitor.status,
            query: monitor.query,
            tags: monitor.tags.join(", "),
          }}
        />
      </div>

      <AgentPromptBar
        contextLabel={monitor.name}
        contextPrefix={`Regarding Datadog monitor "${monitor.name}" (ID ${monitor.id})\nStatus: ${monitor.status}\nType: ${monitor.monitor_type}\nQuery: ${monitor.query}\nTags: ${monitor.tags.join(", ")}`}
      />

      <div className={styles.detailTitle}>{monitor.name}</div>

      {/* Cross-panel correlations */}
      <RelatedItems entityId={`datadog:${monitor.id}`} />

      <div className={styles.detailSection}>
        <span className={styles.detailLabel}>Query</span>
        <div className={styles.queryBox}>{monitor.query}</div>
      </div>

      {monitor.message && (
        <div className={styles.detailSection}>
          <span className={styles.detailLabel}>Alert Message</span>
          <div className={styles.detailValue}>{monitor.message}</div>
        </div>
      )}

      <div className={styles.detailSection}>
        <span className={styles.detailLabel}>Type</span>
        <div className={styles.detailValue}>{monitor.monitor_type}</div>
      </div>

      {monitor.tags.length > 0 && (
        <div className={styles.detailSection}>
          <span className={styles.detailLabel}>Tags</span>
          <div className={styles.tagList}>
            {monitor.tags.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        </div>
      )}

      {monitor.priority != null && (
        <div className={styles.detailSection}>
          <span className={styles.detailLabel}>Priority</span>
          <div className={styles.detailValue}>P{monitor.priority}</div>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ──

export function DatadogPanel() {
  const { data: monitors, isLoading, isError, refetch } = useDatadogMonitors();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pendingMonitorId = useLayoutStore((s) => s.pendingMonitorId);
  const clearPendingMonitor = useLayoutStore((s) => s.clearPendingMonitor);

  // Handle deep-link from AlertsBadge or correlation navigation
  useEffect(() => {
    if (pendingMonitorId != null) {
      setSelectedId(pendingMonitorId);
      clearPendingMonitor();
    }
  }, [pendingMonitorId, clearPendingMonitor]);

  const sorted = useMemo(() => {
    if (!monitors) return [];
    return [...monitors].sort((a, b) => statusOrder(a.status) - statusOrder(b.status));
  }, [monitors]);

  const selected = selectedId != null
    ? monitors?.find((m) => m.id === selectedId) ?? null
    : null;

  // Group by status
  const groups = useMemo(() => {
    const g: Record<string, DatadogMonitor[]> = {};
    for (const m of sorted) {
      const key = m.status;
      if (!g[key]) g[key] = [];
      g[key].push(m);
    }
    return g;
  }, [sorted]);

  const alertMonitors = sorted.filter((m) => m.status === "Alert");
  const warnMonitors = sorted.filter((m) => m.status === "Warn");
  const alertCount = alertMonitors.length;
  const warnCount = warnMonitors.length;
  const commsAlertCount = alertMonitors.filter((m) => m.tags.includes("team:comms")).length;
  const commsWarnCount = warnMonitors.filter((m) => m.tags.includes("team:comms")).length;
  const commsTotal = commsAlertCount + commsWarnCount;

  return (
    <Panel
      title="Monitors"
      icon={Activity}
      badge={alertCount + warnCount || undefined}
      onRefresh={refetch}
    >
      {isLoading && <RetroLoader type="linear" />}
      {isError && <ErrorState message="Could not load Datadog monitors" />}

      {!selected && (alertCount > 0 || warnCount > 0) && (
        <div className={styles.summaryBar}>
          {alertCount > 0 && (
            <span className={styles.summaryChip + " " + styles.summaryAlert}>
              {alertCount} alert{alertCount !== 1 ? "s" : ""}
            </span>
          )}
          {warnCount > 0 && (
            <span className={styles.summaryChip + " " + styles.summaryWarn}>
              {warnCount} warn
            </span>
          )}
          {commsTotal > 0 && (
            <span className={styles.summaryChip + " " + styles.summaryComms}>
              {commsTotal} comms
            </span>
          )}
        </div>
      )}

      {selected ? (
        <MonitorDetail
          monitor={selected}
          onBack={() => setSelectedId(null)}
        />
      ) : monitors && monitors.length === 0 ? (
        <div className={styles.empty}>
          <Activity size={24} style={{ opacity: 0.2 }} />
          <div className={styles.emptyTitle}>No Monitors</div>
          <div className={styles.emptyHint}>Configure Datadog credentials in ~/.config/daemon/credentials.json</div>
        </div>
      ) : (
        <div className={styles.monitorList}>
          {Object.entries(groups).map(([status, items]) => (
            <div key={status}>
              <div className={styles.sectionHeader}>
                {status} ({items.length})
              </div>
              {items.map((monitor) => (
                <MonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  onSelect={() => setSelectedId(monitor.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
