import { invoke } from "@tauri-apps/api/core";
import type {
  SlackSection,
  SlackMessage,
  EnrichedMergeRequest,
  MRDetail,
  LinearIssue,
  LinearIssueDetail,
  WorkflowState,
} from "../types/models";

export function fetchSlackSections(): Promise<SlackSection[]> {
  return invoke<SlackSection[]>("get_slack_sections");
}

export function fetchThreadReplies(channelId: string, threadTs: string): Promise<SlackMessage[]> {
  return invoke<SlackMessage[]>("get_thread_replies", { channelId, threadTs });
}

export function sendSlackMessage(
  channelId: string,
  text: string,
  threadTs?: string,
): Promise<SlackMessage> {
  return invoke<SlackMessage>("send_slack_message", { channelId, text, threadTs });
}

export function fetchDmConversations(): Promise<import("../types/models").DmConversation[]> {
  return invoke<import("../types/models").DmConversation[]>("get_dm_conversations");
}

export function markAsRead(channelId: string, ts: string): Promise<boolean> {
  return invoke<boolean>("mark_as_read", { channelId, ts });
}

export function fetchMergeRequests(): Promise<EnrichedMergeRequest[]> {
  return invoke<EnrichedMergeRequest[]>("get_merge_requests");
}

export function saveGitlabToken(token: string): Promise<void> {
  return invoke("save_gitlab_token", { token });
}

export function checkGitlabConnection(): Promise<string> {
  return invoke<string>("check_gitlab_connection");
}

export function fetchMRDetail(projectId: number, mrIid: number): Promise<MRDetail> {
  return invoke<MRDetail>("get_mr_detail", { projectId, mrIid });
}

export function fetchMRDiff(projectId: number, mrIid: number): Promise<import("../types/models").MRDiff> {
  return invoke<import("../types/models").MRDiff>("get_mr_diff", { projectId, mrIid });
}

export function mergeMR(projectId: number, mrIid: number): Promise<boolean> {
  return invoke<boolean>("merge_mr", { projectId, mrIid });
}

export function addMRNote(projectId: number, mrIid: number, body: string): Promise<boolean> {
  return invoke<boolean>("add_mr_note", { projectId, mrIid, body });
}

export function playJob(projectId: number, jobId: number): Promise<boolean> {
  return invoke<boolean>("play_job", { projectId, jobId });
}

export function retryJob(projectId: number, jobId: number): Promise<boolean> {
  return invoke<boolean>("retry_job", { projectId, jobId });
}

export function fetchIssues(): Promise<LinearIssue[]> {
  return invoke<LinearIssue[]>("get_issues");
}

export function fetchIssueDetail(identifier: string): Promise<LinearIssueDetail> {
  return invoke<LinearIssueDetail>("get_issue_detail", { identifier });
}

export function addLinearComment(issueId: string, body: string): Promise<boolean> {
  return invoke<boolean>("add_linear_comment", { issueId, body });
}

export function fetchWorkflowStates(teamId: string): Promise<WorkflowState[]> {
  return invoke<WorkflowState[]>("get_workflow_states", { teamId });
}

export function updateIssueStatus(issueId: string, stateId: string): Promise<boolean> {
  return invoke<boolean>("update_issue_status", { issueId, stateId });
}

// ── Datadog ──

export function fetchDatadogMonitors(): Promise<import("../types/models").DatadogMonitor[]> {
  return invoke<import("../types/models").DatadogMonitor[]>("get_datadog_monitors");
}

// ── PTY agent functions ──

export function spawnAgentPty(ptyId: string, command: string, args: string): Promise<void> {
  return invoke("spawn_agent_pty", { ptyId, command, args });
}

export function writeAgentPty(ptyId: string, data: string): Promise<void> {
  return invoke("write_agent_pty", { ptyId, data });
}

export function killAgentPty(ptyId: string): Promise<void> {
  return invoke("kill_agent_pty", { ptyId });
}

// ── Interactive agent functions ──

export interface InteractiveAgentOptions {
  model?: string;
  systemPrompt?: string;
  allowedTools?: string[] | null;
  deniedTools?: string[] | null;
  maxBudgetUsd?: number;
  disableSlashCommands?: boolean;
}

export function runInteractiveAgent(
  taskId: string,
  command: string,
  args: string,
  options?: InteractiveAgentOptions,
): Promise<void> {
  return invoke("run_interactive_agent", { taskId, command, args, options });
}

export function respondToAgent(
  taskId: string,
  questionId: string | null,
  response: string,
): Promise<void> {
  return invoke("respond_to_agent", { taskId, questionId, response });
}

export function killInteractiveAgent(taskId: string): Promise<void> {
  return invoke("kill_agent_pty", { ptyId: taskId });
}
