use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLabUser {
    pub id: u64,
    pub username: String,
    pub name: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub id: u64,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MergeRequestRaw {
    pub id: u64,
    pub iid: u64,
    pub project_id: u64,
    pub title: String,
    pub state: String,
    pub draft: Option<bool>,
    pub author: GitLabUser,
    #[serde(default)]
    pub assignees: Vec<GitLabUser>,
    #[serde(default)]
    pub reviewers: Vec<GitLabUser>,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub merge_status: Option<String>,
    pub has_conflicts: Option<bool>,
    pub head_pipeline: Option<Pipeline>,
    pub user_notes_count: Option<u32>,
}

/// The shape we send to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    pub id: u64,
    pub iid: u64,
    pub project_id: u64,
    pub title: String,
    pub draft: bool,
    pub author: String,
    pub author_username: String,
    pub author_avatar: Option<String>,
    pub assignees: Vec<String>,
    pub reviewers: Vec<String>,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub pipeline_status: Option<String>,
    pub has_conflicts: bool,
    pub notes_count: u32,
}

impl From<MergeRequestRaw> for MergeRequest {
    fn from(raw: MergeRequestRaw) -> Self {
        Self {
            id: raw.id,
            iid: raw.iid,
            project_id: raw.project_id,
            title: raw.title,
            draft: raw.draft.unwrap_or(false),
            author: raw.author.name.clone(),
            author_username: raw.author.username.clone(),
            author_avatar: raw.author.avatar_url,
            assignees: raw.assignees.into_iter().map(|u| u.name).collect(),
            reviewers: raw.reviewers.into_iter().map(|u| u.name).collect(),
            source_branch: raw.source_branch,
            target_branch: raw.target_branch,
            web_url: raw.web_url,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
            pipeline_status: raw.head_pipeline.map(|p| p.status),
            has_conflicts: raw.has_conflicts.unwrap_or(false),
            notes_count: raw.user_notes_count.unwrap_or(0),
        }
    }
}

// ── Approval types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRule {
    pub id: u64,
    pub name: String,
    pub rule_type: String,
    pub approvals_required: u32,
    #[serde(default)]
    pub eligible_approvers: Vec<GitLabUser>,
    #[serde(default)]
    pub approved_by: Vec<GitLabUser>,
    #[serde(default)]
    pub groups: Vec<ApprovalGroup>,
    #[serde(default)]
    pub approved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalGroup {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalState {
    #[serde(default)]
    pub rules: Vec<ApprovalRule>,
}

// ── Notes/comments ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequestNote {
    pub id: u64,
    pub body: String,
    pub author: GitLabUser,
    pub created_at: String,
    #[serde(default)]
    pub system: bool,
}

// ── Frontend-facing enriched MR ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedMergeRequest {
    #[serde(flatten)]
    pub mr: MergeRequest,
    pub is_team_member: bool,
    pub needs_your_approval: bool,
    pub approval_rules_needing_you: Vec<String>,
    pub you_are_mentioned: bool,
}
