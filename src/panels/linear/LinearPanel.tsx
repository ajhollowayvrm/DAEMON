import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutList, ArrowLeft, ExternalLink, ChevronDown, ListPlus, CheckSquare, Copy } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import Markdown from "react-markdown";
import { Panel } from "../../components/layout/Panel";
import { GlowCard } from "../../components/ui/GlowCard";
import { NeonButton } from "../../components/ui/NeonButton";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { useLinearIssues, useIssueDetail } from "../../hooks";
import { useLayoutStore } from "../../stores/layoutStore";
import { useTodos } from "../../hooks/useTodos";
import { addLinearComment, fetchWorkflowStates, updateIssueStatus } from "../../services/tauri-bridge";
import { CreateTodoModal } from "../../components/ui/CreateTodoModal";
import { AddToFocusButton } from "../../components/ui/AddToFocusButton";
import { RelatedItems, CorrelationBadge } from "../../components/ui/RelatedItems";
import { ActionMenu } from "../../components/ai/ActionMenu";
import { AgentPromptBar } from "../../components/ai/AgentPromptBar";
import type { LinearIssue, WorkflowState } from "../../types/models";
import type { CreateTodoPreset } from "../../components/ui/CreateTodoModal";
import styles from "./LinearPanel.module.css";

// ── Framer Motion variants ─────────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const issueCardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97, filter: "blur(4px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      delay: i * 0.065,
      duration: 0.38,
      ease: EASE_OUT,
    },
  }),
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    filter: "blur(3px)",
    transition: { duration: 0.18 },
  },
} satisfies Record<string, object>;

const priorityPulseVariants = {
  hidden: { scale: 0.7, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 600,
      damping: 20,
    },
  },
} satisfies Record<string, object>;

const statusBadgeVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 22,
      delay: 0.05,
    },
  },
} satisfies Record<string, object>;

/** Smart suggested to-do titles based on ticket state */
function getTicketSuggestions(issue: LinearIssue): { title: string; priority: CreateTodoPreset["priority"] }[] {
  const suggestions: { title: string; priority: CreateTodoPreset["priority"] }[] = [];

  if (issue.status_type === "started") {
    suggestions.push({ title: `Continue work on ${issue.identifier}`, priority: "high" });
  }
  if (issue.status_type === "unstarted" && issue.assignee_is_me) {
    suggestions.push({ title: `Start ${issue.identifier}: ${issue.title}`, priority: "medium" });
  }
  if (issue.priority === 1) {
    suggestions.push({ title: `Urgent: ${issue.identifier} — ${issue.title}`, priority: "high" });
  }
  if (issue.status === "In Review" || issue.status === "In QA") {
    suggestions.push({ title: `Follow up on ${issue.identifier} review`, priority: "medium" });
  }
  if (issue.status === "Ready to Deploy" || issue.status === "Ready to Start") {
    suggestions.push({ title: `Deploy ${issue.identifier}`, priority: "medium" });
  }

  suggestions.push({ title: `Follow up on ${issue.identifier}: ${issue.title}`, priority: "low" });
  return suggestions;
}

type Tab = "mine" | "team" | "ready";

const MAX_DEPLOYED = 3;

function capDeployed(issues: LinearIssue[]): LinearIssue[] {
  const nonDeployed = issues.filter((i) => i.status !== "Deployed");
  const deployed = issues
    .filter((i) => i.status === "Deployed")
    .slice(0, MAX_DEPLOYED);
  return [...nonDeployed, ...deployed];
}

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

function getPriorityLabel(p: number): string {
  switch (p) {
    case 1: return "Urgent";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "";
  }
}

function getPriorityClass(p: number): string {
  switch (p) {
    case 1: return styles.urgent;
    case 2: return styles.high;
    case 3: return styles.medium;
    case 4: return styles.low;
    default: return "";
  }
}

function getStatusClass(statusType: string): string {
  switch (statusType) {
    case "started": return styles.statusStarted;
    case "unstarted": return styles.statusUnstarted;
    case "backlog": return styles.statusBacklog;
    case "completed": return styles.statusCompleted;
    default: return "";
  }
}

function IssueCard({
  issue,
  onOpen,
  hasTodo,
}: {
  issue: LinearIssue;
  onOpen: (id: string) => void;
  hasTodo?: boolean;
}) {
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoPreset, setTodoPreset] = useState<CreateTodoPreset | null>(null);
  const suggestions = useMemo(() => getTicketSuggestions(issue), [issue]);

  const handleSuggestion = (s: { title: string; priority: CreateTodoPreset["priority"] }) => {
    setTodoPreset({
      source: "linear",
      title: s.title,
      subtitle: `${issue.identifier} · ${issue.status}`,
      url: issue.url,
      priority: s.priority,
    });
    setShowSuggestions(false);
    setShowTodoModal(true);
  };

  return (
    <>
      <GlowCard onClick={() => onOpen(issue.identifier)}>
        <div className={styles.ticketItem}>
          <div className={styles.ticketHeader}>
            <span className={styles.ticketId}>{issue.identifier}</span>
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
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <motion.span
                className={`${styles.statusBadge} ${getStatusClass(issue.status_type)}`}
                variants={statusBadgeVariants}
                initial="hidden"
                animate="visible"
              >
                {issue.status}
              </motion.span>
              <AddToFocusButton
                compact
                link={{
                  source: "linear",
                  label: issue.title,
                  subtitle: `${issue.identifier} · ${issue.status}`,
                  url: issue.url,
                  navigateTo: "linear",
                  sourceId: issue.identifier,
                }}
                title={issue.title}
              />
              <CorrelationBadge entityId={`linear:${issue.identifier}`} />
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
                source="linear"
                context={{
                  identifier: issue.identifier,
                  title: issue.title,
                  url: issue.url,
                  status: issue.status,
                }}
              />
            </div>
          </div>
          <span className={styles.ticketTitle}>{issue.title}</span>
          {showSuggestions && (
            <div className={styles.suggestionsRow}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className={`${styles.suggestionChip} ${styles[`suggestion_${s.priority}`]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSuggestion(s);
                  }}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
          <div className={styles.ticketMeta}>
            {issue.priority > 0 && (
              <>
                <motion.span
                  className={`${styles.priorityBadge} ${getPriorityClass(issue.priority)}`}
                  variants={priorityPulseVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{
                    scale: 1.08,
                    boxShadow: issue.priority === 1
                      ? "0 0 10px rgba(255,23,68,0.5)"
                      : issue.priority === 2
                        ? "0 0 10px rgba(255,107,43,0.5)"
                        : "0 0 8px rgba(255,230,0,0.3)",
                    transition: { duration: 0.15 },
                  }}
                >
                  {getPriorityLabel(issue.priority)}
                </motion.span>
                <span>·</span>
              </>
            )}
            <span className={styles.assignee}>
              {issue.assignee ?? "Unassigned"}
            </span>
            <span>·</span>
            <span className={styles.teamKey}>{issue.team_key}</span>
            <span>·</span>
            <span className={styles.timeAgo}>{timeAgo(issue.updated_at)}</span>
          </div>
          {issue.labels.length > 0 && (
            <div className={styles.labels}>
              {issue.labels.map((label) => (
                <span key={label} className={styles.label}>
                  {label}
                </span>
              ))}
            </div>
          )}
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

function StatusPicker({
  currentStatus,
  currentStatusType,
  issueId,
  teamId,
  onStatusChanged,
}: {
  currentStatus: string;
  currentStatusType: string;
  issueId: string;
  teamId: string;
  onStatusChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [updating, setUpdating] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Fetch workflow states on first open
  useEffect(() => {
    if (open && states.length === 0 && teamId) {
      fetchWorkflowStates(teamId).then(setStates).catch(() => {});
    }
  }, [open, states.length, teamId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
  };

  const handleSelect = async (state: WorkflowState) => {
    if (state.name === currentStatus) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    setOpen(false);
    try {
      await updateIssueStatus(issueId, state.id);
      onStatusChanged();
      // Invalidate the issues list so the Linear panel list + todos update
      queryClient.invalidateQueries({ queryKey: ["linear", "issues"] });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        className={`${styles.statusBadge} ${getStatusClass(currentStatusType)} ${styles.statusPickerTrigger}`}
        onClick={handleToggle}
        disabled={updating}
      >
        {updating ? "Updating..." : currentStatus}
        <ChevronDown size={10} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className={styles.statusDropdown}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {states.length === 0 ? (
            <div className={styles.statusDropdownLoading}>Loading...</div>
          ) : (
            states.map((state) => (
              <button
                key={state.id}
                className={`${styles.statusDropdownItem} ${state.name === currentStatus ? styles.statusDropdownItemActive : ""}`}
                onClick={() => handleSelect(state)}
              >
                <span className={`${styles.statusDot} ${styles[`dot_${state.state_type}`]}`} />
                {state.name}
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function IssueDetailView({
  identifier,
  onBack,
}: {
  identifier: string;
  onBack: () => void;
}) {
  const { data: detail, isLoading, isError, refetch } = useIssueDetail(identifier);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showCreateTodo, setShowCreateTodo] = useState(false);

  const handlePostComment = async () => {
    if (!commentText.trim() || !detail) return;
    setPosting(true);
    try {
      await addLinearComment(detail.id, commentText);
      setCommentText("");
      refetch();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={styles.detailView}>
      <div className={styles.detailToolbar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} />
          Back
        </button>
        <span className={styles.detailId}>{identifier}</span>
        {detail && (
          <>
            <AddToFocusButton
              link={{
                source: "linear",
                label: detail.title,
                subtitle: `${detail.identifier} · ${detail.status}`,
                url: detail.url,
                navigateTo: "linear",
                sourceId: detail.identifier,
              }}
              title={detail.title}
            />
            <CorrelationBadge entityId={`linear:${identifier}`} />
            <button
              className={styles.externalBtn}
              onClick={() => setShowCreateTodo(true)}
              title="Create To-Do"
            >
              <ListPlus size={12} />
            </button>
            <button
              className={styles.externalBtn}
              onClick={() => open(detail.url)}
              title="Open in Linear"
            >
              <ExternalLink size={12} />
            </button>
            <button
              className={styles.externalBtn}
              onClick={() => navigator.clipboard.writeText(detail.url)}
              title="Copy link"
            >
              <Copy size={12} />
            </button>
            <ActionMenu
              source="linear"
              context={{
                identifier: detail.identifier,
                title: detail.title,
                url: detail.url,
                status: detail.status,
                priority: detail.priority,
                assignee: detail.assignee,
                description: detail.description,
              }}
            />
          </>
        )}
      </div>
      {detail && (
        <AgentPromptBar
          contextLabel={detail.identifier}
          contextPrefix={`Regarding Linear ticket ${detail.identifier}: "${detail.title}"\nStatus: ${detail.status}\nPriority: ${getPriorityLabel(detail.priority) || "None"}\nAssignee: ${detail.assignee ?? "Unassigned"}`}
        />
      )}
      {showCreateTodo && detail && (
        <CreateTodoModal
          preset={{
            source: "linear",
            title: detail.title,
            subtitle: `${detail.identifier} · ${detail.status}`,
            url: detail.url,
          }}
          onClose={() => setShowCreateTodo(false)}
        />
      )}

      {isLoading && <RetroLoader type="linear" />}
      {isError && <ErrorState message="Could not load ticket" />}
      {detail && (
        <div className={styles.detailContent}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>{detail.title}</h2>
            <div className={styles.detailMeta}>
              <StatusPicker
                currentStatus={detail.status}
                currentStatusType={detail.status_type}
                issueId={detail.id}
                teamId={detail.team_id}
                onStatusChanged={refetch}
              />
              {detail.priority > 0 && (
                <span className={`${styles.priorityBadge} ${getPriorityClass(detail.priority)}`}>
                  {getPriorityLabel(detail.priority)}
                </span>
              )}
              <span className={styles.assignee}>
                {detail.assignee ?? "Unassigned"}
              </span>
              <span className={styles.teamKey}>{detail.team_key}</span>
            </div>
            {detail.labels.length > 0 && (
              <div className={styles.labels}>
                {detail.labels.map((label) => (
                  <span key={label} className={styles.label}>{label}</span>
                ))}
              </div>
            )}
          </div>

          {/* Cross-panel correlations */}
          <RelatedItems entityId={`linear:${detail.identifier}`} />

          {detail.description && (
            <div className={styles.detailDescription}>
              <div className={styles.markdown}><Markdown>{detail.description}</Markdown></div>
            </div>
          )}

          <div className={styles.commentsSection}>
            <div className={styles.commentsSectionTitle}>
              Comments ({detail.comments.length})
            </div>
            {detail.comments.map((comment, i) => (
              <div key={i} className={styles.comment}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{comment.author}</span>
                  <span className={styles.commentTime}>
                    {timeAgo(comment.created_at)}
                  </span>
                </div>
                <div className={styles.commentBody}><Markdown>{comment.body}</Markdown></div>
              </div>
            ))}

            <div className={styles.commentInputBox}>
              <textarea
                className={styles.commentInput}
                placeholder="Write a comment... (Markdown supported)"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
              />
              <NeonButton
                variant="magenta"
                onClick={handlePostComment}
                disabled={posting || !commentText.trim()}
              >
                {posting ? "Posting..." : "Comment"}
              </NeonButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LinearPanel() {
  const [tab, setTab] = useState<Tab>("mine");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const { data: allIssues, isLoading, isError, refetch } = useLinearIssues();
  const { todos } = useTodos();
  const pendingLinearId = useLayoutStore((s) => s.pendingLinearId);
  const clearPendingLinear = useLayoutStore((s) => s.clearPendingLinear);

  // Deep-link: open a specific ticket when navigated from another panel
  useEffect(() => {
    if (pendingLinearId) {
      if (allIssues) {
        const issue = allIssues.find((i) => i.identifier === pendingLinearId);
        if (issue) {
          setSelectedIssue(issue.identifier);
          // Switch to the right tab
          if (issue.assignee_is_me) setTab("mine");
          else if (issue.assignee_is_team) setTab("team");
          else setTab("ready");
        } else {
          // Issue not in current data — open detail view directly by identifier
          setSelectedIssue(pendingLinearId);
          refetch();
        }
      } else {
        // Data not loaded yet — set it and it'll resolve when data arrives
        setSelectedIssue(pendingLinearId);
      }
      clearPendingLinear();
    }
  }, [pendingLinearId, allIssues, clearPendingLinear, refetch]);
  const todoUrls = useMemo(() => new Set(todos.filter((t) => t.url).map((t) => t.url!)), [todos]);

  const { myIssues, teamIssues, readyIssues } = useMemo(() => {
    if (!allIssues) return { myIssues: [], teamIssues: [], readyIssues: [] };
    return {
      myIssues: capDeployed(allIssues.filter((i) => i.assignee_is_me)),
      teamIssues: capDeployed(allIssues.filter((i) => i.assignee_is_team)),
      readyIssues: allIssues.filter((i) => i.status === "Ready to Start"),
    };
  }, [allIssues]);

  const currentIssues =
    tab === "mine"
      ? myIssues
      : tab === "team"
        ? teamIssues
        : readyIssues;

  const badge = currentIssues.length;

  return (
    <Panel title="Linear" icon={LayoutList} badge={badge} onRefresh={() => refetch()}>
      <AnimatePresence mode="wait">
        {selectedIssue ? (
          <motion.div
            key="issue-detail"
            initial={{ opacity: 0, x: 40, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.38, ease: EASE_OUT } }}
            exit={{ opacity: 0, x: 40, filter: "blur(6px)", transition: { duration: 0.22 } }}
          >
            <IssueDetailView
              identifier={selectedIssue}
              onBack={() => setSelectedIssue(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="issue-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${tab === "mine" ? styles.tabActive : ""}`}
                onClick={() => setTab("mine")}
              >
                Mine
                <span className={styles.tabBadge}>{myIssues.length}</span>
              </button>
              <button
                className={`${styles.tab} ${tab === "team" ? styles.tabActive : ""}`}
                onClick={() => setTab("team")}
              >
                Team
                <span className={styles.tabBadge}>{teamIssues.length}</span>
              </button>
              <button
                className={`${styles.tab} ${tab === "ready" ? styles.tabActive : ""}`}
                onClick={() => setTab("ready")}
              >
                Ready
                <span className={styles.tabBadge}>{readyIssues.length}</span>
              </button>
            </div>

            {isLoading && <RetroLoader type="linear" />}
            {isError && (
              <ErrorState
                message="Could not reach Linear"
                onRetry={() => refetch()}
              />
            )}
            {!isLoading && !isError && currentIssues.length === 0 && (
              <div className={styles.emptyState}>No tickets</div>
            )}
            <AnimatePresence mode="wait">
              <motion.div key={tab}>
                {currentIssues.map((issue, i) => (
                  <motion.div
                    key={issue.id}
                    custom={i}
                    variants={issueCardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <IssueCard issue={issue} onOpen={setSelectedIssue} hasTodo={todoUrls.has(issue.url)} />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
