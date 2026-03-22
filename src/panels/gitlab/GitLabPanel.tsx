import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitMerge, ListPlus, CheckSquare } from "lucide-react";
import { Panel } from "../../components/layout/Panel";
import { GlowCard } from "../../components/ui/GlowCard";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { useMergeRequests } from "../../hooks";
import { MRDetailView } from "./MRDetailView";
import { ActionMenu } from "../../components/ai/ActionMenu";
import { useLayoutStore } from "../../stores/layoutStore";
import { CreateTodoModal, type CreateTodoPreset } from "../../components/ui/CreateTodoModal";
import { AddToFocusButton } from "../../components/ui/AddToFocusButton";
import { CorrelationBadge } from "../../components/ui/RelatedItems";
import { useTodos } from "../../hooks/useTodos";
import type { EnrichedMergeRequest } from "../../types/models";
import styles from "./GitLabPanel.module.css";

// ── Framer Motion variants ─────────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const mrCardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97, filter: "blur(4px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      delay: i * 0.07,
      duration: 0.38,
      ease: EASE_OUT,
    },
  }),
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.96,
    filter: "blur(3px)",
    transition: { duration: 0.2 },
  },
} satisfies Record<string, object>;

const badgePopVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 22,
    },
  },
} satisfies Record<string, object>;

/** Extract short repo name from MR web_url (e.g. "frontend" from "https://gitlab.com/nectarhr/frontend/-/merge_requests/123") */
function repoFromUrl(url: string): string {
  try {
    const parts = url.split("/-/")[0].split("/");
    return parts[parts.length - 1] || "unknown";
  } catch {
    return "unknown";
  }
}

/** Group MRs by repo, preserving order within each group */
function groupByRepo(mrs: EnrichedMergeRequest[]): [string, EnrichedMergeRequest[]][] {
  const groups = new Map<string, EnrichedMergeRequest[]>();
  for (const mr of mrs) {
    const repo = repoFromUrl(mr.web_url);
    if (!groups.has(repo)) groups.set(repo, []);
    groups.get(repo)!.push(mr);
  }
  return Array.from(groups.entries());
}

/** Generate smart suggested to-do titles based on MR state */
function getSuggestedTodoActions(mr: EnrichedMergeRequest): { title: string; priority: CreateTodoPreset["priority"] }[] {
  const suggestions: { title: string; priority: CreateTodoPreset["priority"] }[] = [];

  if (mr.pipeline_status === "failed") {
    suggestions.push({ title: `Fix pipeline for !${mr.iid}`, priority: "high" });
  }
  if (mr.has_conflicts) {
    suggestions.push({ title: `Resolve conflicts on !${mr.iid}`, priority: "high" });
  }
  if (mr.needs_your_approval) {
    suggestions.push({ title: `Review & approve !${mr.iid}`, priority: "high" });
  }
  if (mr.pipeline_status === "success" && !mr.draft && !mr.has_conflicts) {
    suggestions.push({ title: `Deploy !${mr.iid}: ${mr.title}`, priority: "medium" });
  }
  if (mr.pipeline_status === "running") {
    suggestions.push({ title: `Check pipeline status for !${mr.iid}`, priority: "low" });
  }
  if (mr.draft) {
    suggestions.push({ title: `Finish draft !${mr.iid}: ${mr.title}`, priority: "medium" });
  }
  if (mr.you_are_mentioned) {
    suggestions.push({ title: `Respond to mention in !${mr.iid}`, priority: "medium" });
  }

  // Always offer a generic one
  suggestions.push({ title: `Follow up on !${mr.iid}: ${mr.title}`, priority: "low" });

  return suggestions;
}

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

function MRCard({ mr, onSelect, hasTodo }: { mr: EnrichedMergeRequest; onSelect: () => void; hasTodo?: boolean }) {
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoPreset, setTodoPreset] = useState<CreateTodoPreset | null>(null);
  const suggestions = useMemo(() => getSuggestedTodoActions(mr), [mr]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSuggestionClick = (s: { title: string; priority: CreateTodoPreset["priority"] }) => {
    setTodoPreset({
      source: "gitlab",
      title: s.title,
      subtitle: `!${mr.iid} by ${mr.author}`,
      url: mr.web_url,
      priority: s.priority,
      nav: { panel: "gitlab", projectId: mr.project_id, iid: mr.iid },
    });
    setShowSuggestions(false);
    setShowTodoModal(true);
  };

  return (
    <>
      <GlowCard
        urgent={mr.needs_your_approval}
        onClick={onSelect}
      >
        <div className={styles.mrItem}>
          <div className={styles.mrHeader}>
            <span className={styles.mrId}>!{mr.iid}</span>
            {hasTodo && (
              <button
                className={styles.todoLink}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePanel("todos");
                }}
                title="View linked To-Do"
              >
                <CheckSquare size={9} />
                To-Do
              </button>
            )}
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {mr.draft && (
                <motion.span
                  className={`${styles.statusBadge} ${styles.draftBadge}`}
                  variants={badgePopVariants}
                  initial="hidden"
                  animate="visible"
                >
                  draft
                </motion.span>
              )}
              {mr.has_conflicts && (
                <motion.span
                  className={`${styles.statusBadge} ${styles.conflicts}`}
                  variants={badgePopVariants}
                  initial="hidden"
                  animate="visible"
                >
                  conflicts
                </motion.span>
              )}
              {mr.you_are_mentioned && (
                <motion.span
                  className={styles.mentionBadge}
                  variants={badgePopVariants}
                  initial="hidden"
                  animate="visible"
                >@you</motion.span>
              )}
              <AddToFocusButton
                compact
                link={{
                  source: "gitlab",
                  label: mr.title,
                  subtitle: `!${mr.iid} · ${mr.author}`,
                  url: mr.web_url,
                  navigateTo: "gitlab",
                  sourceId: String(mr.iid),
                  sourceBranch: mr.source_branch,
                }}
                title={mr.title}
              />
              <CorrelationBadge entityId={`gitlab:${mr.iid}`} />
              <button
                className={styles.quickTodoBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSuggestions(!showSuggestions);
                }}
                title="Create To-Do"
              >
                <ListPlus size={13} />
              </button>
              <ActionMenu
                source="gitlab"
                context={{
                  iid: mr.iid,
                  title: mr.title,
                  projectId: mr.project_id,
                  author: mr.author,
                  webUrl: mr.web_url,
                }}
              />
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
          {showSuggestions && (
            <div className={styles.suggestionsRow}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className={`${styles.suggestionChip} ${styles[`suggestion_${s.priority}`]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSuggestionClick(s);
                  }}
                >
                  {s.title}
                </button>
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
      {showTodoModal && todoPreset && (
        <CreateTodoModal
          preset={todoPreset}
          onClose={() => { setShowTodoModal(false); setTodoPreset(null); }}
        />
      )}
    </>
  );
}

export function GitLabPanel() {
  const [tab, setTab] = useState<Tab>("mine");
  const [selectedMR, setSelectedMR] = useState<{ projectId: number; iid: number } | null>(null);
  const { data: allMRs, isLoading, isError, error, refetch } = useMergeRequests();
  const { todos } = useTodos();
  const pendingMR = useLayoutStore((s) => s.pendingMR);
  const clearPendingMR = useLayoutStore((s) => s.clearPendingMR);

  // URLs that have linked to-dos
  const todoUrls = useMemo(() => new Set(todos.filter((t) => t.url).map((t) => t.url!)), [todos]);

  // If navigated here from a to-do with a specific MR, open it
  useEffect(() => {
    if (pendingMR) {
      setSelectedMR({ projectId: pendingMR.projectId, iid: pendingMR.iid });
      clearPendingMR();
    }
  }, [pendingMR, clearPendingMR]);

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

  const groupedMRs = useMemo(() => groupByRepo(currentMRs), [currentMRs]);

  const badge = currentMRs.length;

  return (
    <Panel title="GitLab MRs" icon={GitMerge} badge={badge} onRefresh={() => refetch()}>
      <AnimatePresence mode="wait">
        {selectedMR ? (
          <motion.div
            key="mr-detail"
            initial={{ opacity: 0, x: 40, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.38, ease: EASE_OUT } }}
            exit={{ opacity: 0, x: 40, filter: "blur(6px)", transition: { duration: 0.22 } }}
          >
            <MRDetailView
              projectId={selectedMR.projectId}
              mrIid={selectedMR.iid}
              onBack={() => setSelectedMR(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`mr-list-${tab}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } }}
            exit={{ opacity: 0, x: -10, transition: { duration: 0.18 } }}
          >
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${tab === "mine" ? styles.tabActive : ""}`}
                onClick={() => setTab("mine")}
              >
                Mine
                <span className={styles.tabBadge}>{myMRs.length}</span>
              </button>
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
            <AnimatePresence>
              {groupedMRs.map(([repo, mrs]) => (
                <div key={repo}>
                  <div className={styles.repoHeader}>
                    <span className={styles.repoName}>{repo}</span>
                    <span className={styles.repoCount}>{mrs.length}</span>
                  </div>
                  {mrs.map((mr, i) => (
                    <motion.div
                      key={mr.id}
                      custom={i}
                      variants={mrCardVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <MRCard
                        mr={mr}
                        hasTodo={todoUrls.has(mr.web_url)}
                        onSelect={() => setSelectedMR({ projectId: mr.project_id, iid: mr.iid })}
                      />
                    </motion.div>
                  ))}
                </div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
