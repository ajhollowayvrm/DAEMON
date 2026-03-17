use serde::{Deserialize, Serialize};

/// Raw GraphQL response types

#[derive(Debug, Deserialize)]
pub struct ViewerData {
    pub viewer: Viewer,
}

#[derive(Debug, Deserialize)]
pub struct Viewer {
    #[serde(rename = "assignedIssues")]
    pub assigned_issues: IssueConnection,
}

#[derive(Debug, Deserialize)]
pub struct TeamIssuesData {
    pub team: TeamWithIssues,
}

#[derive(Debug, Deserialize)]
pub struct TeamWithIssues {
    pub issues: IssueConnection,
}

#[derive(Debug, Deserialize)]
pub struct IssueConnection {
    pub nodes: Vec<IssueRaw>,
}

#[derive(Debug, Deserialize)]
pub struct IssueRaw {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub priority: u8,
    pub url: String,
    pub state: IssueState,
    pub assignee: Option<UserRef>,
    pub team: TeamRef,
    pub labels: LabelConnection,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct IssueState {
    pub name: String,
    #[serde(rename = "type")]
    pub state_type: String,
}

#[derive(Debug, Deserialize)]
pub struct UserRef {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct TeamRef {
    pub key: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct LabelConnection {
    pub nodes: Vec<LabelRef>,
}

#[derive(Debug, Deserialize)]
pub struct LabelRef {
    pub name: String,
}

/// Raw detail query types

#[derive(Debug, Deserialize)]
pub struct IssueDetailData {
    pub issue: IssueDetailRaw,
}

#[derive(Debug, Deserialize)]
pub struct IssueDetailRaw {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: u8,
    pub url: String,
    pub state: IssueState,
    pub assignee: Option<UserRef>,
    pub team: TeamRef,
    pub labels: LabelConnection,
    pub comments: CommentConnection,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CommentConnection {
    pub nodes: Vec<CommentRaw>,
}

#[derive(Debug, Deserialize)]
pub struct CommentRaw {
    pub body: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub user: CommentUser,
}

#[derive(Debug, Deserialize)]
pub struct CommentUser {
    pub name: String,
}

/// Frontend-facing detail type

#[derive(Debug, Clone, Serialize)]
pub struct LinearIssueDetail {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub status_type: String,
    pub priority: u8,
    pub assignee: Option<String>,
    pub team_key: String,
    pub labels: Vec<String>,
    pub url: String,
    pub comments: Vec<IssueComment>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct IssueComment {
    pub author: String,
    pub body: String,
    pub created_at: String,
}

/// Frontend-facing issue type

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinearIssue {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub status: String,
    pub status_type: String,
    pub priority: u8,
    pub assignee: Option<String>,
    pub assignee_is_me: bool,
    pub assignee_is_team: bool,
    pub team_key: String,
    pub team_name: String,
    pub labels: Vec<String>,
    pub url: String,
    pub updated_at: String,
    pub created_at: String,
}
