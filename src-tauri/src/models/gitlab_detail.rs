use serde::{Deserialize, Serialize};

/// Raw MR detail from GitLab API
#[derive(Debug, Deserialize)]
pub struct MRDetailRaw {
    pub iid: u64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub draft: Option<bool>,
    pub author: super::gitlab::GitLabUser,
    #[serde(default)]
    pub assignees: Vec<super::gitlab::GitLabUser>,
    #[serde(default)]
    pub reviewers: Vec<super::gitlab::GitLabUser>,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub merge_status: Option<String>,
    pub detailed_merge_status: Option<String>,
    pub has_conflicts: Option<bool>,
    pub changes_count: Option<String>,
    pub blocking_discussions_resolved: Option<bool>,
    pub head_pipeline: Option<PipelineRef>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PipelineRef {
    pub id: u64,
    pub status: String,
}

/// Pipeline job from GitLab API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineJob {
    pub id: u64,
    pub name: String,
    pub stage: String,
    pub status: String,
    #[serde(default)]
    pub allow_failure: bool,
}

/// Discussion thread from GitLab API
#[derive(Debug, Deserialize)]
pub struct Discussion {
    pub id: String,
    pub notes: Vec<DiscussionNote>,
}

#[derive(Debug, Deserialize)]
pub struct DiscussionNote {
    pub id: u64,
    pub body: String,
    pub author: super::gitlab::GitLabUser,
    pub created_at: String,
    #[serde(default)]
    pub system: bool,
    #[serde(default)]
    pub resolvable: bool,
    #[serde(default)]
    pub resolved: bool,
}

/// Frontend-facing MR detail
#[derive(Debug, Clone, Serialize)]
pub struct MRDetail {
    pub iid: u64,
    pub project_id: u64,
    pub title: String,
    pub description: String,
    pub state: String,
    pub draft: bool,
    pub author: String,
    pub assignees: Vec<String>,
    pub reviewers: Vec<String>,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub merge_status: String,
    pub detailed_merge_status: String,
    pub has_conflicts: bool,
    pub changes_count: String,
    pub discussions_resolved: bool,
    pub pipeline_status: Option<String>,
    pub pipeline_id: Option<u64>,
    pub jobs: Vec<PipelineJob>,
    pub approval_rules: Vec<ApprovalRuleInfo>,
    pub discussions: Vec<DiscussionThread>,
    pub can_merge: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApprovalRuleInfo {
    pub name: String,
    pub approved: bool,
    pub approvals_required: u32,
    pub approved_by: Vec<String>,
    pub rule_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiscussionThread {
    pub id: String,
    pub notes: Vec<ThreadNote>,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThreadNote {
    pub id: u64,
    pub author: String,
    pub body: String,
    pub created_at: String,
    pub system: bool,
}
