import { invoke } from "@tauri-apps/api/core";
import type {
  SlackSection,
  EnrichedMergeRequest,
  MRDetail,
  LinearIssue,
  LinearIssueDetail,
} from "../types/models";

export function fetchSlackSections(): Promise<SlackSection[]> {
  return invoke<SlackSection[]>("get_slack_sections");
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
