use crate::models::linear::{IssueDetailData, LinearIssue, LinearIssueDetail, TeamIssuesData, ViewerData};
use crate::services::credentials;
use crate::services::linear::LinearClient;

/// COM team ID in Linear
const COM_TEAM_ID: &str = "d097c0ee-3414-4d3e-9ff9-56017012a45a";

/// AJ's direct reports (Linear display names)
const TEAM_MEMBERS: &[&str] = &[
    "AJ Holloway",
    "Eric Johnson",
    "Riley Reed",
    "Keanna Lund",
    "Aaron Heo",
];

fn get_client() -> Result<LinearClient, String> {
    let key = credentials::get_credential("linear_api_key")?
        .ok_or_else(|| "Linear API key not configured.".to_string())?;
    LinearClient::new(&key)
}

#[tauri::command]
pub async fn get_issues() -> Result<Vec<LinearIssue>, String> {
    let client = get_client()?;

    // Get viewer's assigned issues
    let my_issues: ViewerData = client
        .query(
            r#"{
                viewer {
                    assignedIssues(
                        first: 50
                        orderBy: updatedAt
                        filter: { state: { type: { nin: ["completed", "canceled"] } } }
                    ) {
                        nodes {
                            id identifier title priority url
                            state { name type }
                            assignee { id name }
                            team { key name }
                            labels { nodes { name } }
                            updatedAt createdAt
                        }
                    }
                }
            }"#,
        )
        .await?;

    // Get COM team issues (includes team members' work)
    let team_query = format!(
        r#"{{
            team(id: "{}") {{
                issues(
                    first: 50
                    orderBy: updatedAt
                    filter: {{ state: {{ type: {{ nin: ["completed", "canceled"] }} }} }}
                ) {{
                    nodes {{
                        id identifier title priority url
                        state {{ name type }}
                        assignee {{ id name }}
                        team {{ key name }}
                        labels {{ nodes {{ name }} }}
                        updatedAt createdAt
                    }}
                }}
            }}
        }}"#,
        COM_TEAM_ID
    );
    let team_issues: TeamIssuesData = client.query(&team_query).await?;

    // Merge and deduplicate
    let mut seen = std::collections::HashSet::new();
    let mut all_raw = Vec::new();

    for issue in my_issues.viewer.assigned_issues.nodes {
        if seen.insert(issue.id.clone()) {
            all_raw.push(issue);
        }
    }
    for issue in team_issues.team.issues.nodes {
        if seen.insert(issue.id.clone()) {
            all_raw.push(issue);
        }
    }

    // Convert to frontend shape
    let issues: Vec<LinearIssue> = all_raw
        .into_iter()
        .map(|raw| {
            let assignee_name = raw.assignee.as_ref().map(|a| a.name.clone());
            let assignee_is_me = assignee_name
                .as_deref()
                .map(|n| n == "AJ Holloway")
                .unwrap_or(false);
            let assignee_is_team = assignee_name
                .as_deref()
                .map(|n| TEAM_MEMBERS.iter().any(|&m| m == n))
                .unwrap_or(false);

            LinearIssue {
                id: raw.id,
                identifier: raw.identifier,
                title: raw.title,
                status: raw.state.name,
                status_type: raw.state.state_type,
                priority: raw.priority,
                assignee: assignee_name,
                assignee_is_me,
                assignee_is_team,
                team_key: raw.team.key,
                team_name: raw.team.name,
                labels: raw.labels.nodes.into_iter().map(|l| l.name).collect(),
                url: raw.url,
                updated_at: raw.updated_at,
                created_at: raw.created_at,
            }
        })
        .collect();

    Ok(issues)
}

#[tauri::command]
pub async fn get_issue_detail(identifier: String) -> Result<LinearIssueDetail, String> {
    let client = get_client()?;

    let query = format!(
        r#"{{
            issue(id: "{}") {{
                id identifier title description priority url
                state {{ name type }}
                assignee {{ id name }}
                team {{ key name }}
                labels {{ nodes {{ name }} }}
                comments(first: 30, orderBy: createdAt) {{
                    nodes {{
                        body
                        createdAt
                        user {{ name }}
                    }}
                }}
                updatedAt createdAt
            }}
        }}"#,
        identifier
    );

    let data: IssueDetailData = client.query(&query).await?;
    let raw = data.issue;

    Ok(LinearIssueDetail {
        id: raw.id,
        identifier: raw.identifier,
        title: raw.title,
        description: raw.description.unwrap_or_default(),
        status: raw.state.name,
        status_type: raw.state.state_type,
        priority: raw.priority,
        assignee: raw.assignee.map(|a| a.name),
        team_key: raw.team.key,
        labels: raw.labels.nodes.into_iter().map(|l| l.name).collect(),
        url: raw.url,
        comments: raw
            .comments
            .nodes
            .into_iter()
            .map(|c| crate::models::linear::IssueComment {
                author: c.user.name,
                body: c.body,
                created_at: c.created_at,
            })
            .collect(),
        updated_at: raw.updated_at,
    })
}

#[derive(serde::Deserialize)]
struct CommentCreateResponse {
    #[serde(rename = "commentCreate")]
    comment_create: CommentCreateResult,
}

#[derive(serde::Deserialize)]
struct CommentCreateResult {
    success: bool,
}

#[tauri::command]
pub async fn add_linear_comment(issue_id: String, body: String) -> Result<bool, String> {
    let client = get_client()?;
    let escaped_body = body.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n");
    let query = format!(
        r#"mutation {{ commentCreate(input: {{ issueId: "{}", body: "{}" }}) {{ success }} }}"#,
        issue_id, escaped_body
    );
    let data: CommentCreateResponse = client.query(&query).await?;
    Ok(data.comment_create.success)
}
