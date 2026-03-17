import { useState, useMemo } from "react";
import { GitMerge } from "lucide-react";
import { Panel } from "../../components/layout/Panel";
import { GlowCard } from "../../components/ui/GlowCard";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { useMergeRequests } from "../../hooks";
import { MRDetailView } from "./MRDetailView";
import type { EnrichedMergeRequest } from "../../types/models";
import styles from "./GitLabPanel.module.css";

type Tab = "team" | "approval" | "mentions" | "mine";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function PipelineStatus({ status }: { status: string | null }) {
  if (!status) return <span className={styles.timeAgo}>no pipeline</span>;
  const cls =
    status === "success"
      ? styles.pipelinePassed
      : status === "running" || status === "pending"
        ? styles.pipelineRunning
        : status === "failed"
          ? styles.pipelineFailed
          : styles.timeAgo;
  return <span className={cls}>{status}</span>;
}

function MRCard({ mr, onSelect }: { mr: EnrichedMergeRequest; onSelect: () => void }) {
  return (
    <GlowCard
      urgent={mr.needs_your_approval}
      onClick={onSelect}
    >
      <div className={styles.mrItem}>
        <div className={styles.mrHeader}>
          <span className={styles.mrId}>!{mr.iid}</span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {mr.draft && (
              <span className={`${styles.statusBadge} ${styles.draftBadge}`}>
                draft
              </span>
            )}
            {mr.has_conflicts && (
              <span className={`${styles.statusBadge} ${styles.conflicts}`}>
                conflicts
              </span>
            )}
            {mr.you_are_mentioned && (
              <span className={styles.mentionBadge}>@you</span>
            )}
          </div>
        </div>
        <span
          className={`${styles.mrTitle} ${mr.draft ? styles.mrDraft : ""}`}
        >
          {mr.title}
        </span>
        {mr.approval_rules_needing_you.length > 0 && (
          <div className={styles.approvalRules}>
            {mr.approval_rules_needing_you.map((rule) => (
              <span key={rule} className={styles.approvalRule}>
                {rule}
              </span>
            ))}
          </div>
        )}
        <div className={styles.mrMeta}>
          <span className={styles.author}>{mr.author}</span>
          <span>·</span>
          <span className={styles.branch}>{mr.source_branch}</span>
          <span>·</span>
          <PipelineStatus status={mr.pipeline_status} />
          <span>·</span>
          <span className={styles.timeAgo}>{timeAgo(mr.updated_at)}</span>
        </div>
      </div>
    </GlowCard>
  );
}

export function GitLabPanel() {
  const [tab, setTab] = useState<Tab>("team");
  const [selectedMR, setSelectedMR] = useState<{ projectId: number; iid: number } | null>(null);
  const { data: allMRs, isLoading, isError, error, refetch } = useMergeRequests();

  const { teamMRs, approvalMRs, mentionMRs, myMRs } = useMemo(() => {
    if (!allMRs) return { teamMRs: [], approvalMRs: [], mentionMRs: [], myMRs: [] };
    return {
      teamMRs: allMRs.filter((mr) => mr.is_team_member),
      approvalMRs: allMRs.filter((mr) => mr.needs_your_approval),
      mentionMRs: allMRs.filter((mr) => mr.you_are_mentioned),
      myMRs: allMRs.filter((mr) => mr.author_username === "ajholloway34"),
    };
  }, [allMRs]);

  const currentMRs =
    tab === "team"
      ? teamMRs
      : tab === "approval"
        ? approvalMRs
        : tab === "mentions"
          ? mentionMRs
          : myMRs;

  const badge = currentMRs.length;

  if (selectedMR) {
    return (
      <Panel title="GitLab MRs" icon={GitMerge} badge={badge}>
        <MRDetailView
          projectId={selectedMR.projectId}
          mrIid={selectedMR.iid}
          onBack={() => setSelectedMR(null)}
        />
      </Panel>
    );
  }

  return (
    <Panel title="GitLab MRs" icon={GitMerge} badge={badge}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "team" ? styles.tabActive : ""}`}
          onClick={() => setTab("team")}
        >
          Team
          <span className={styles.tabBadge}>{teamMRs.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === "approval" ? styles.tabActive : ""}`}
          onClick={() => setTab("approval")}
        >
          Needs You
          <span className={styles.tabBadge}>{approvalMRs.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === "mentions" ? styles.tabActive : ""}`}
          onClick={() => setTab("mentions")}
        >
          Mentions
          <span className={styles.tabBadge}>{mentionMRs.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === "mine" ? styles.tabActive : ""}`}
          onClick={() => setTab("mine")}
        >
          Mine
          <span className={styles.tabBadge}>{myMRs.length}</span>
        </button>
      </div>

      {isLoading && <RetroLoader type="gitlab" />}
      {isError && (
        <ErrorState
          message={String(error)}
          onRetry={() => refetch()}
        />
      )}
      {!isLoading && !isError && currentMRs.length === 0 && (
        <div className={styles.emptyState}>No merge requests</div>
      )}
      {currentMRs.map((mr) => (
        <MRCard
          key={mr.id}
          mr={mr}
          onSelect={() => setSelectedMR({ projectId: mr.project_id, iid: mr.iid })}
        />
      ))}
    </Panel>
  );
}
