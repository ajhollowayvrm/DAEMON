import { useState, useMemo } from "react";
import { LayoutList, ArrowLeft, ExternalLink } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import Markdown from "react-markdown";
import { Panel } from "../../components/layout/Panel";
import { GlowCard } from "../../components/ui/GlowCard";
import { NeonButton } from "../../components/ui/NeonButton";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { useLinearIssues, useIssueDetail } from "../../hooks";
import { addLinearComment } from "../../services/tauri-bridge";
import type { LinearIssue } from "../../types/models";
import styles from "./LinearPanel.module.css";

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
}: {
  issue: LinearIssue;
  onOpen: (id: string) => void;
}) {
  return (
    <GlowCard onClick={() => onOpen(issue.identifier)}>
      <div className={styles.ticketItem}>
        <div className={styles.ticketHeader}>
          <span className={styles.ticketId}>{issue.identifier}</span>
          <span className={`${styles.statusBadge} ${getStatusClass(issue.status_type)}`}>
            {issue.status}
          </span>
        </div>
        <span className={styles.ticketTitle}>{issue.title}</span>
        <div className={styles.ticketMeta}>
          {issue.priority > 0 && (
            <>
              <span className={`${styles.priorityBadge} ${getPriorityClass(issue.priority)}`}>
                {getPriorityLabel(issue.priority)}
              </span>
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
          <button
            className={styles.externalBtn}
            onClick={() => open(detail.url)}
            title="Open in Linear"
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {isLoading && <RetroLoader text="Loading ticket..." />}
      {isError && <ErrorState message="Could not load ticket" />}
      {detail && (
        <div className={styles.detailContent}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>{detail.title}</h2>
            <div className={styles.detailMeta}>
              <span className={`${styles.statusBadge} ${getStatusClass(detail.status_type)}`}>
                {detail.status}
              </span>
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

  if (selectedIssue) {
    return (
      <Panel title="Linear" icon={LayoutList} badge={badge}>
        <IssueDetailView
          identifier={selectedIssue}
          onBack={() => setSelectedIssue(null)}
        />
      </Panel>
    );
  }

  return (
    <Panel title="Linear" icon={LayoutList} badge={badge}>
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

      {isLoading && <RetroLoader text="Loading tickets..." />}
      {isError && (
        <ErrorState
          message="Could not reach Linear"
          onRetry={() => refetch()}
        />
      )}
      {!isLoading && !isError && currentIssues.length === 0 && (
        <div className={styles.emptyState}>No tickets</div>
      )}
      {currentIssues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} onOpen={setSelectedIssue} />
      ))}
    </Panel>
  );
}
