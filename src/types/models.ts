export interface SlackMessage {
  id: string;
  channel: string;
  sender: string;
  message: string;
  timestamp: string;
  permalink: string;
  is_unread: boolean;
}

export interface SlackSection {
  title: string;
  section_type: string;
  messages: SlackMessage[];
  unread_count: number;
}

export interface MergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  draft: boolean;
  author: string;
  author_username: string;
  author_avatar: string | null;
  assignees: string[];
  reviewers: string[];
  source_branch: string;
  target_branch: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  pipeline_status: string | null;
  has_conflicts: boolean;
  notes_count: number;
}

export interface EnrichedMergeRequest extends MergeRequest {
  is_team_member: boolean;
  needs_your_approval: boolean;
  approval_rules_needing_you: string[];
  you_are_mentioned: boolean;
}

// ── GitLab MR Detail ──

export interface PipelineJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  allow_failure: boolean;
}

export interface ApprovalRuleInfo {
  name: string;
  approved: boolean;
  approvals_required: number;
  approved_by: string[];
  rule_type: string;
}

export interface ThreadNote {
  id: number;
  author: string;
  body: string;
  created_at: string;
  system: boolean;
}

export interface DiscussionThread {
  id: string;
  notes: ThreadNote[];
  resolved: boolean;
}

export interface MRDetail {
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  draft: boolean;
  author: string;
  assignees: string[];
  reviewers: string[];
  source_branch: string;
  target_branch: string;
  web_url: string;
  merge_status: string;
  detailed_merge_status: string;
  has_conflicts: boolean;
  changes_count: string;
  discussions_resolved: boolean;
  pipeline_status: string | null;
  pipeline_id: number | null;
  jobs: PipelineJob[];
  approval_rules: ApprovalRuleInfo[];
  discussions: DiscussionThread[];
  can_merge: boolean;
  created_at: string;
  updated_at: string;
}

// ── Linear ──

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  status_type: string;
  priority: number;
  assignee: string | null;
  assignee_is_me: boolean;
  assignee_is_team: boolean;
  team_key: string;
  team_name: string;
  labels: string[];
  url: string;
  updated_at: string;
  created_at: string;
}

export interface IssueComment {
  author: string;
  body: string;
  created_at: string;
}

export interface LinearIssueDetail {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  status_type: string;
  priority: number;
  assignee: string | null;
  team_key: string;
  labels: string[];
  url: string;
  comments: IssueComment[];
  updated_at: string;
}

// ── Agents ──

export type AgentTaskStatus = "Queued" | "Running" | "Completed" | "Failed";

export interface AgentTask {
  id: string;
  description: string;
  status: AgentTaskStatus;
  subtasks: string[];
  result: string | null;
}
