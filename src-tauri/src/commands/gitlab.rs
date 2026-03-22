use crate::models::gitlab::{EnrichedMergeRequest, MergeRequest, MergeRequestRaw};
use crate::models::gitlab_detail::{DiffChange, FileDiff, MRDiff};
use crate::services::credentials;
use crate::services::gitlab::GitLabClient;

const NECTARHR_GROUP_ID: u64 = 12742924;

/// AJ's direct team members (GitLab usernames)
const TEAM_USERNAMES: &[&str] = &[
    "ajholloway34",  // AJ Holloway (you)
    "Enrique704",    // Eric Johnson
    "riley8684116",  // Riley Reed
    "keanna",        // Keanna Lund
    "aaron.heo",     // Aaron Heo
];

fn get_token() -> Result<String, String> {
    credentials::get_credential("gitlab_pat")?
        .ok_or_else(|| "GitLab PAT not configured.".to_string())
}

fn build_http(token: &str) -> Result<reqwest::Client, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "PRIVATE-TOKEN",
        reqwest::header::HeaderValue::from_str(token).map_err(|e| e.to_string())?,
    );
    reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_merge_requests() -> Result<Vec<EnrichedMergeRequest>, String> {
    let token = get_token()?;
    let http = build_http(&token)?;

    // Get current user
    let user: crate::models::gitlab::GitLabUser = http
        .get("https://gitlab.com/api/v4/user")
        .send()
        .await
        .map_err(|e| format!("Failed to get user: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse user: {e}"))?;

    let user_id = user.id;
    let username = user.username;

    // Fetch open MRs
    let raw_mrs: Vec<MergeRequestRaw> = http
        .get(format!(
            "https://gitlab.com/api/v4/groups/{NECTARHR_GROUP_ID}/merge_requests"
        ))
        .query(&[
            ("state", "opened"),
            ("order_by", "updated_at"),
            ("sort", "desc"),
            ("per_page", "50"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to fetch MRs: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse MRs: {e}"))?;

    let mrs: Vec<MergeRequest> = raw_mrs.into_iter().map(MergeRequest::from).collect();

    // Enrich each MR — share the same HTTP client, use semaphore for rate limiting
    let http = std::sync::Arc::new(http);
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(5));
    let mut handles = Vec::new();

    for mr in mrs {
        let http = http.clone();
        let sem = semaphore.clone();
        let uname = username.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            enrich_mr(&http, mr, user_id, &uname).await
        });
        handles.push(handle);
    }

    let mut enriched = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(Ok(emr)) => enriched.push(emr),
            Ok(Err(e)) => eprintln!("[gitlab] Error enriching MR: {}", e),
            Err(e) => eprintln!("[gitlab] Task join error: {}", e),
        }
    }

    // Sort: needs_your_approval first, then by updated_at desc
    enriched.sort_by(|a, b| {
        b.needs_your_approval
            .cmp(&a.needs_your_approval)
            .then_with(|| b.mr.updated_at.cmp(&a.mr.updated_at))
    });

    Ok(enriched)
}

async fn enrich_mr(
    http: &reqwest::Client,
    mr: MergeRequest,
    user_id: u64,
    username: &str,
) -> Result<EnrichedMergeRequest, String> {
    let project_id = mr.project_id;
    let mr_iid = mr.iid;
    let base = format!(
        "https://gitlab.com/api/v4/projects/{project_id}/merge_requests/{mr_iid}"
    );

    // Fetch approval state (skip notes for speed — we'll get those in detail view)
    let approval_state: crate::models::gitlab::ApprovalState = http
        .get(format!("{base}/approval_state"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut needs_your_approval = false;
    let mut approval_rules_needing_you = Vec::new();

    for rule in &approval_state.rules {
        if rule.rule_type == "any_approver" || rule.rule_type == "report_approver" {
            continue;
        }
        if rule.approved || rule.approvals_required == 0 {
            continue;
        }
        let is_eligible = rule
            .eligible_approvers
            .iter()
            .any(|approver| approver.id == user_id);
        if is_eligible {
            needs_your_approval = true;
            approval_rules_needing_you.push(rule.name.clone());
        }
    }

    // Check mentions via notes (only fetch first page for speed)
    let notes: Vec<crate::models::gitlab::MergeRequestNote> = http
        .get(format!("{base}/notes"))
        .query(&[("per_page", "50")])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mention_pattern = format!("@{}", username);
    let you_are_mentioned = notes
        .iter()
        .any(|note| !note.system && note.body.contains(&mention_pattern));

    let is_team_member = TEAM_USERNAMES
        .iter()
        .any(|&u| u.eq_ignore_ascii_case(&mr.author_username));

    Ok(EnrichedMergeRequest {
        mr,
        is_team_member,
        needs_your_approval,
        approval_rules_needing_you,
        you_are_mentioned,
    })
}

#[tauri::command]
pub async fn save_gitlab_token(token: String) -> Result<(), String> {
    credentials::store_credential("gitlab_pat", &token)
}

#[tauri::command]
pub async fn check_gitlab_connection() -> Result<String, String> {
    let token = get_token()?;
    let http = build_http(&token)?;
    let user: crate::models::gitlab::GitLabUser = http
        .get("https://gitlab.com/api/v4/user")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(user.username)
}

// ── MR Detail ──

use crate::models::gitlab_detail::*;

#[tauri::command]
pub async fn get_mr_detail(project_id: u64, mr_iid: u64) -> Result<MRDetail, String> {
    let token = get_token()?;
    let http = build_http(&token)?;
    let base = format!("https://gitlab.com/api/v4/projects/{project_id}/merge_requests/{mr_iid}");

    let (mr_resp, disc_resp, approval_resp) = tokio::join!(
        http.get(&base).send(),
        http.get(format!("{base}/discussions")).query(&[("per_page", "100")]).send(),
        http.get(format!("{base}/approval_state")).send(),
    );

    let raw: MRDetailRaw = mr_resp.map_err(|e| e.to_string())?
        .json().await.map_err(|e| format!("MR parse error: {e}"))?;
    let discussions: Vec<Discussion> = disc_resp.map_err(|e| e.to_string())?
        .json().await.map_err(|e| format!("Discussion parse error: {e}"))?;
    let approval_state: crate::models::gitlab::ApprovalState = approval_resp.map_err(|e| e.to_string())?
        .json().await.map_err(|e| format!("Approval parse error: {e}"))?;

    let jobs = if let Some(ref pipeline) = raw.head_pipeline {
        http.get(format!(
            "https://gitlab.com/api/v4/projects/{project_id}/pipelines/{}/jobs",
            pipeline.id
        ))
        .query(&[("per_page", "50")])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<PipelineJob>>()
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    let all_approvals_met = approval_state.rules.iter().all(|r| {
        r.approved || r.approvals_required == 0
    });
    let pipeline_ok = raw.head_pipeline.as_ref()
        .map(|p| p.status == "success")
        .unwrap_or(true);
    let can_merge = raw.state == "opened"
        && !raw.draft.unwrap_or(false)
        && !raw.has_conflicts.unwrap_or(false)
        && raw.blocking_discussions_resolved.unwrap_or(true)
        && all_approvals_met
        && pipeline_ok;

    Ok(MRDetail {
        iid: raw.iid,
        project_id,
        title: raw.title,
        description: raw.description.unwrap_or_default(),
        state: raw.state,
        draft: raw.draft.unwrap_or(false),
        author: raw.author.name,
        assignees: raw.assignees.into_iter().map(|u| u.name).collect(),
        reviewers: raw.reviewers.into_iter().map(|u| u.name).collect(),
        source_branch: raw.source_branch,
        target_branch: raw.target_branch,
        web_url: raw.web_url,
        merge_status: raw.merge_status.unwrap_or_default(),
        detailed_merge_status: raw.detailed_merge_status.unwrap_or_default(),
        has_conflicts: raw.has_conflicts.unwrap_or(false),
        changes_count: raw.changes_count.unwrap_or_else(|| "0".into()),
        discussions_resolved: raw.blocking_discussions_resolved.unwrap_or(true),
        pipeline_status: raw.head_pipeline.as_ref().map(|p| p.status.clone()),
        pipeline_id: raw.head_pipeline.as_ref().map(|p| p.id),
        jobs,
        approval_rules: approval_state.rules.into_iter().map(|r| ApprovalRuleInfo {
            name: r.name,
            approved: r.approved,
            approvals_required: r.approvals_required,
            approved_by: r.approved_by.into_iter().map(|u| u.name).collect(),
            rule_type: r.rule_type,
        }).collect(),
        discussions: discussions.into_iter()
            .filter(|d| !d.notes.is_empty() && !d.notes[0].system)
            .map(|d| {
                let resolved = d.notes.iter().any(|n| n.resolvable) && d.notes.iter().all(|n| !n.resolvable || n.resolved);
                DiscussionThread {
                    id: d.id,
                    notes: d.notes.into_iter().map(|n| ThreadNote {
                        id: n.id,
                        author: n.author.name,
                        body: n.body,
                        created_at: n.created_at,
                        system: n.system,
                    }).collect(),
                    resolved,
                }
            })
            .collect(),
        can_merge,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
    })
}

#[tauri::command]
pub async fn merge_mr(project_id: u64, mr_iid: u64) -> Result<bool, String> {
    let token = get_token()?;
    let http = build_http(&token)?;
    let resp = http
        .put(format!(
            "https://gitlab.com/api/v4/projects/{project_id}/merge_requests/{mr_iid}/merge"
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Merge failed: {}", body))
    }
}

#[tauri::command]
pub async fn add_mr_note(project_id: u64, mr_iid: u64, body: String) -> Result<bool, String> {
    let token = get_token()?;
    let http = build_http(&token)?;
    let resp = http
        .post(format!(
            "https://gitlab.com/api/v4/projects/{project_id}/merge_requests/{mr_iid}/notes"
        ))
        .json(&serde_json::json!({ "body": body }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.status().is_success())
}

#[tauri::command]
pub async fn play_job(project_id: u64, job_id: u64) -> Result<bool, String> {
    let token = get_token()?;
    let http = build_http(&token)?;
    let resp = http
        .post(format!(
            "https://gitlab.com/api/v4/projects/{project_id}/jobs/{job_id}/play"
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Play failed: {}", body))
    }
}

#[tauri::command]
pub async fn retry_job(project_id: u64, job_id: u64) -> Result<bool, String> {
    let token = get_token()?;
    let http = build_http(&token)?;
    let resp = http
        .post(format!(
            "https://gitlab.com/api/v4/projects/{project_id}/jobs/{job_id}/retry"
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Retry failed: {}", body))
    }
}

// ── MR Diff ──────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct MRChangesResponse {
    changes: Vec<DiffChange>,
}

#[tauri::command]
pub async fn get_mr_diff(project_id: u64, mr_iid: u64) -> Result<MRDiff, String> {
    let token = get_token()?;
    let http = build_http(&token)?;

    let url = format!(
        "https://gitlab.com/api/v4/projects/{}/merge_requests/{}/changes",
        project_id, mr_iid
    );

    let resp: MRChangesResponse = http
        .get(&url)
        .query(&[("per_page", "100")])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let files: Vec<FileDiff> = resp
        .changes
        .into_iter()
        .map(|c| {
            let status = if c.new_file {
                "added"
            } else if c.deleted_file {
                "deleted"
            } else if c.renamed_file {
                "renamed"
            } else {
                "modified"
            };
            FileDiff {
                old_path: c.old_path,
                new_path: c.new_path,
                status: status.to_string(),
                diff: c.diff,
            }
        })
        .collect();

    Ok(MRDiff { files })
}
