use reqwest::header::{HeaderMap, HeaderValue};

use crate::models::gitlab::{
    ApprovalState, GitLabUser, MergeRequestNote,
};

const GITLAB_API: &str = "https://gitlab.com/api/v4";

pub struct GitLabClient {
    client: reqwest::Client,
}

impl GitLabClient {
    pub fn new(token: &str) -> Result<Self, String> {
        let mut headers = HeaderMap::new();
        headers.insert(
            "PRIVATE-TOKEN",
            HeaderValue::from_str(token).map_err(|e| e.to_string())?,
        );
        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self { client })
    }

    pub async fn get_current_user(&self) -> Result<GitLabUser, String> {
        self.client
            .get(format!("{GITLAB_API}/user"))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json::<GitLabUser>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_mr_approval_state(
        &self,
        project_id: u64,
        mr_iid: u64,
    ) -> Result<ApprovalState, String> {
        self.client
            .get(format!(
                "{GITLAB_API}/projects/{project_id}/merge_requests/{mr_iid}/approval_state"
            ))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json::<ApprovalState>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_mr_notes(
        &self,
        project_id: u64,
        mr_iid: u64,
    ) -> Result<Vec<MergeRequestNote>, String> {
        self.client
            .get(format!(
                "{GITLAB_API}/projects/{project_id}/merge_requests/{mr_iid}/notes"
            ))
            .query(&[("per_page", "100"), ("order_by", "created_at"), ("sort", "desc")])
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }
}
