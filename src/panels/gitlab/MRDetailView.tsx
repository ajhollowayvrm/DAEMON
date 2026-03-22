import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ExternalLink, GitMerge, MessageSquare, Play, RotateCw, ListPlus, Code, ChevronDown, ChevronRight, Send } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { NeonButton } from "../../components/ui/NeonButton";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { DiffViewer } from "../../components/ui/DiffViewer";
import { ActionMenu } from "../../components/ai/ActionMenu";
import { AgentPromptBar } from "../../components/ai/AgentPromptBar";
import { fetchMRDetail, fetchMRDiff, mergeMR, addMRNote, playJob, retryJob, sendSlackMessage } from "../../services/tauri-bridge";
import { CreateTodoModal } from "../../components/ui/CreateTodoModal";
import { AddToFocusButton } from "../../components/ui/AddToFocusButton";
import { RelatedItems, CorrelationBadge } from "../../components/ui/RelatedItems";
import type { PipelineJob, ApprovalRuleInfo, DiscussionThread, MRDiff } from "../../types/models";
import styles from "./MRDetailView.module.css";

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

function jobStatusClass(status: string): string {
  switch (status) {
    case "success": return styles.jobSuccess;
    case "failed": return styles.jobFailed;
    case "running": return styles.jobRunning;
    case "pending": return styles.jobPending;
    case "manual": return styles.jobManual;
    case "skipped": return styles.jobSkipped;
    default: return "";
  }
}

function stageStatus(jobs: PipelineJob[]): string {
  if (jobs.some((j) => j.status === "failed" && !j.allow_failure)) return "failed";
  if (jobs.some((j) => j.status === "running")) return "running";
  if (jobs.some((j) => j.status === "pending")) return "pending";
  if (jobs.every((j) => j.status === "success" || j.status === "skipped" || j.allow_failure)) return "success";
  if (jobs.every((j) => j.status === "manual")) return "manual";
  if (jobs.every((j) => j.status === "skipped")) return "skipped";
  return "pending";
}

// ── Changes / Diff Section ───────────────────────────────────
function ChangesSection({ projectId, mrIid, changesCount }: { projectId: number; mrIid: number; changesCount: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: diff, isLoading, isError, refetch } = useQuery<MRDiff>({
    queryKey: ["gitlab", "diff", projectId, mrIid],
    queryFn: () => fetchMRDiff(projectId, mrIid),
    enabled: expanded,
    staleTime: 5 * 60_000,
  });

  return (
    <div className={styles.changesSection}>
      <button className={styles.changesSectionHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.changesChevron}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <Code size={12} />
        <span className={styles.sectionTitle} style={{ flex: 1 }}>Changes</span>
        <span className={styles.changes}>{changesCount} files</span>
      </button>
      {expanded && (
        <div className={styles.changesBody}>
          {isLoading && <div className={styles.changesLoading}>Loading diff...</div>}
          {isError && (
            <div className={styles.changesError}>
              Failed to load diff.{" "}
              <button onClick={() => refetch()} className={styles.retryLink}>Retry</button>
            </div>
          )}
          {diff && <DiffViewer files={diff.files} />}
        </div>
      )}
    </div>
  );
}

function PipelineView({ jobs, status, projectId, onRefresh }: { jobs: PipelineJob[]; status: string | null; projectId: number; onRefresh: () => void }) {
  const [tooltip, setTooltip] = useState<{ stage: string; jobs: PipelineJob[]; x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);

  const handlePlay = async (jobId: number) => {
    setPendingJobId(jobId);
    try {
      await playJob(projectId, jobId);
    } catch {
      // silently handled — status will show on next refresh
    }
    setPendingJobId(null);
    setTooltip(null);
    onRefresh();
  };

  const handleRetry = async (jobId: number) => {
    setPendingJobId(jobId);
    try {
      await retryJob(projectId, jobId);
    } catch {
      // silently handled — status will show on next refresh
    }
    setPendingJobId(null);
    setTooltip(null);
    onRefresh();
  };

  const stageMap = new Map<string, PipelineJob[]>();
  for (const job of jobs) {
    const existing = stageMap.get(job.stage) ?? [];
    existing.push(job);
    stageMap.set(job.stage, existing);
  }
  const stages = [...stageMap.entries()];

  const showTooltip = (stage: string, stageJobs: PipelineJob[], e: React.MouseEvent) => {
    clearTimeout(hideTimeout.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ stage, jobs: stageJobs, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  };

  const scheduleHide = () => {
    hideTimeout.current = setTimeout(() => setTooltip(null), 150);
  };

  const cancelHide = () => {
    clearTimeout(hideTimeout.current);
  };

  return (
    <div className={styles.pipeline}>
      <div className={styles.sectionTitle}>
        Pipeline {status && <span className={jobStatusClass(status)}>{status}</span>}
      </div>
      <div className={styles.pipelineTrack}>
        {stages.map(([stage, stageJobs]) => {
          const ss = stageStatus(stageJobs);
          const failed = stageJobs.filter((j) => j.status === "failed" && !j.allow_failure);
          const manual = stageJobs.filter((j) => j.status === "manual");
          return (
            <div
              key={stage}
              className={styles.stageGroup}
              onMouseEnter={(e) => showTooltip(stage, stageJobs, e)}
              onMouseLeave={scheduleHide}
            >
              <div className={`${styles.stageCircle} ${jobStatusClass(ss)}`} />
              <span className={styles.stageName}>{stage.replace(/^\./, "")}</span>
              <span className={styles.stageJobCount}>{stageJobs.length} {stageJobs.length === 1 ? "job" : "jobs"}</span>
              {failed.length > 0 && <span className={styles.stageFailedBadge}>{failed.length} failed</span>}
              {manual.length > 0 && ss === "manual" && <span className={styles.stageManualBadge}>{manual.length} manual</span>}
            </div>
          );
        })}
      </div>
      {tooltip && createPortal(
        <div
          ref={tooltipRef}
          className={styles.stageTooltip}
          style={{ display: "block", left: tooltip.x, top: tooltip.y, transform: "translateX(-50%)" }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <div className={styles.tooltipTitle}>{tooltip.stage}</div>
          {tooltip.jobs.map((job) => (
            <div key={job.id} className={`${styles.tooltipJob} ${jobStatusClass(job.status)}`}>
              <span className={styles.tooltipDot} />
              <span className={styles.tooltipJobName}>{job.name}</span>
              <span className={styles.tooltipStatus}>{job.status}</span>
              {job.status === "manual" && (
                <button
                  className={`${styles.jobAction} ${pendingJobId === job.id ? styles.jobActionPending : ""}`}
                  onClick={() => handlePlay(job.id)}
                  disabled={pendingJobId !== null}
                  title="Play"
                >
                  <Play size={10} />
                </button>
              )}
              {job.status === "failed" && (
                <button
                  className={`${styles.jobAction} ${pendingJobId === job.id ? styles.jobActionPending : ""}`}
                  onClick={() => handleRetry(job.id)}
                  disabled={pendingJobId !== null}
                  title="Retry"
                >
                  <RotateCw size={10} />
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function ApprovalView({ rules }: { rules: ApprovalRuleInfo[] }) {
  const meaningful = rules.filter((r) => r.rule_type !== "report_approver" || r.approvals_required > 0);

  return (
    <div className={styles.approvals}>
      <div className={styles.sectionTitle}>Approvals</div>
      {meaningful.map((rule) => (
        <div key={rule.name} className={`${styles.approvalRule} ${rule.approved ? styles.ruleApproved : styles.rulePending}`}>
          <span className={styles.ruleDot} />
          <span className={styles.ruleName}>{rule.name}</span>
          {rule.approved_by.length > 0 && (
            <span className={styles.ruleApprovers}>{rule.approved_by.join(", ")}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function DiscussionView({ discussions }: { discussions: DiscussionThread[] }) {
  if (discussions.length === 0) return null;

  return (
    <div className={styles.discussions}>
      <div className={styles.sectionTitle}>
        <MessageSquare size={12} /> Discussions ({discussions.length})
      </div>
      {discussions.map((thread) => (
        <div key={thread.id} className={`${styles.thread} ${thread.resolved ? styles.threadResolved : ""}`}>
          {thread.resolved && <span className={styles.resolvedBadge}>resolved</span>}
          {thread.notes.map((note) => (
            <div key={note.id} className={styles.note}>
              <div className={styles.noteHeader}>
                <span className={styles.noteAuthor}>{note.author}</span>
                <span className={styles.noteTime}>{timeAgo(note.created_at)}</span>
              </div>
              <div className={styles.noteBody}><Markdown>{note.body}</Markdown></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MRDetailView({
  projectId,
  mrIid,
  onBack,
}: {
  projectId: number;
  mrIid: number;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: mr, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["gitlab", "mr-detail", projectId, mrIid],
    queryFn: () => fetchMRDetail(projectId, mrIid),
  });

  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const [postingForReview, setPostingForReview] = useState(false);
  const [postedForReview, setPostedForReview] = useState(false);

  // "Post for Review" — posts to #schema-change-reviews or a configurable channel
  const REVIEW_CHANNEL_ID = "C0ALT18EQHH"; // #schema-change-reviews
  const handlePostForReview = async () => {
    if (!mr || postingForReview) return;
    setPostingForReview(true);
    try {
      // Extract ticket ID from branch name (e.g., SUR-940-add-feature → SUR-940)
      const ticketMatch = mr.source_branch.match(/^([A-Z]+-\d+)/);
      const ticketId = ticketMatch ? ticketMatch[1] : "";
      const summary = mr.title.replace(/^(draft:\s*)?/i, "");
      const message = ticketId
        ? `${ticketId}: ${summary}\n${mr.web_url}`
        : `${summary}\n${mr.web_url}`;
      await sendSlackMessage(REVIEW_CHANNEL_ID, message);
      setPostedForReview(true);
      setTimeout(() => setPostedForReview(false), 3000);
    } finally {
      setPostingForReview(false);
    }
  };

  const handleMerge = async () => {
    if (!mr) return;
    setMerging(true);
    setMergeError(null);
    try {
      await mergeMR(mr.project_id, mr.iid);
      queryClient.invalidateQueries({ queryKey: ["gitlab"] });
      refetch();
    } catch (e) {
      setMergeError(String(e));
    } finally {
      setMerging(false);
    }
  };

  const handleComment = async () => {
    if (!mr || !commentText.trim()) return;
    setPosting(true);
    try {
      await addMRNote(mr.project_id, mr.iid, commentText);
      setCommentText("");
      refetch();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={styles.detailView}>
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} />
          Back
        </button>
        <span className={styles.mrId}>!{mrIid}</span>
        {mr && (
          <>
            <AddToFocusButton
              link={{
                source: "gitlab",
                label: mr.title,
                subtitle: `!${mrIid} · ${mr.author}`,
                url: mr.web_url,
                navigateTo: "gitlab",
                sourceId: String(mrIid),
                sourceBranch: mr.source_branch,
              }}
              title={mr.title}
            />
            <CorrelationBadge entityId={`gitlab:${mrIid}`} />
            <button
              className={styles.externalBtn}
              onClick={() => setShowCreateTodo(true)}
              title="Create To-Do"
            >
              <ListPlus size={12} />
            </button>
            <button
              className={`${styles.externalBtn} ${postedForReview ? styles.externalBtnSuccess : ""}`}
              onClick={handlePostForReview}
              disabled={postingForReview || postedForReview}
              title="Post MR for review in Slack"
            >
              <Send size={12} />
              {postedForReview ? "Posted!" : postingForReview ? "..." : ""}
            </button>
            <button className={styles.externalBtn} onClick={() => open(mr.web_url)} title="Open in browser">
              <ExternalLink size={12} />
            </button>
            <ActionMenu
              source="gitlab"
              context={{
                iid: mrIid,
                title: mr.title,
                webUrl: mr.web_url,
                description: mr.description,
                sourceBranch: mr.source_branch,
                targetBranch: mr.target_branch,
                hasConflicts: mr.has_conflicts,
                pipelineStatus: mr.pipeline_status,
                author: mr.author,
              }}
            />
          </>
        )}
      </div>
      {mr && (
        <AgentPromptBar
          contextLabel={`MR !${mrIid}`}
          contextPrefix={`Regarding GitLab MR !${mrIid}: "${mr.title}"\nAuthor: ${mr.author}\nBranches: ${mr.source_branch} → ${mr.target_branch}\nPipeline: ${mr.pipeline_status ?? "unknown"}\nConflicts: ${mr.has_conflicts ? "yes" : "no"}`}
        />
      )}
      {showCreateTodo && mr && (
        <CreateTodoModal
          preset={{
            source: "gitlab",
            title: mr.title,
            subtitle: `!${mrIid} by ${mr.author}`,
            url: mr.web_url,
          }}
          onClose={() => setShowCreateTodo(false)}
        />
      )}

      {isLoading && <RetroLoader type="gitlab" />}
      {isError && <ErrorState message={String(error)} onRetry={() => refetch()} />}
      {mr && (
        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <h2 className={styles.title}>
              {mr.draft && <span className={styles.draftTag}>Draft</span>}
              {mr.title}
            </h2>
            <div className={styles.meta}>
              <span className={styles.author}>{mr.author}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.branch}>{mr.source_branch}</span>
              <span className={styles.arrow}>into</span>
              <span className={styles.branch}>{mr.target_branch}</span>
              <span className={styles.sep}>·</span>
              <span className={styles.changes}>{mr.changes_count} changes</span>
              <span className={styles.sep}>·</span>
              <span className={styles.timeAgo}>{timeAgo(mr.updated_at)}</span>
            </div>
            {mr.has_conflicts && (
              <div className={styles.conflictWarning}>This MR has merge conflicts</div>
            )}
          </div>

          {/* Merge button */}
          <div className={styles.mergeSection}>
            {mr.can_merge ? (
              <NeonButton onClick={handleMerge} disabled={merging}>
                <GitMerge size={12} />
                {merging ? " Merging..." : " Merge"}
              </NeonButton>
            ) : (
              <div className={styles.mergeBlocked}>
                <span className={styles.mergeBlockedIcon}>⊘</span>
                {mr.detailed_merge_status.replace(/_/g, " ")}
              </div>
            )}
            {mergeError && <div className={styles.mergeError}>{mergeError}</div>}
            {mr.state === "merged" && <div className={styles.mergedBadge}>Merged</div>}
          </div>

          {/* Pipeline */}
          {mr.jobs.length > 0 && (
            <PipelineView jobs={mr.jobs} status={mr.pipeline_status} projectId={mr.project_id} onRefresh={() => refetch()} />
          )}

          {/* Approvals */}
          <ApprovalView rules={mr.approval_rules} />

          {/* Cross-panel correlations */}
          <RelatedItems entityId={`gitlab:${mr.iid}`} />

          {/* Changes / Diff */}
          <ChangesSection projectId={mr.project_id} mrIid={mr.iid} changesCount={mr.changes_count} />

          {/* Description */}
          {mr.description && (
            <div className={styles.description}>
              <div className={styles.sectionTitle}>Description</div>
              <div className={styles.markdown}><Markdown>{mr.description}</Markdown></div>
            </div>
          )}

          {/* Discussions */}
          <DiscussionView discussions={mr.discussions} />

          {/* Comment input */}
          <div className={styles.commentSection}>
            <div className={styles.sectionTitle}>Add Comment</div>
            <textarea
              className={styles.commentInput}
              placeholder="Write a comment... (Markdown supported)"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
            />
            <NeonButton
              variant="magenta"
              onClick={handleComment}
              disabled={posting || !commentText.trim()}
            >
              {posting ? "Posting..." : "Comment"}
            </NeonButton>
          </div>
        </div>
      )}
    </div>
  );
}
