use crate::services::credentials;
use serde::Serialize;

#[derive(Serialize)]
pub struct AppSettings {
    pub gitlab_pat: Option<String>,
    pub linear_api_key: Option<String>,
    pub gitlab_group_id: String,
    pub linear_team_id: String,
}

fn mask_key(key: &str) -> String {
    if key.len() <= 8 {
        return "••••••••".to_string();
    }
    let prefix = &key[..6];
    let suffix = &key[key.len() - 4..];
    format!("{}••••{}", prefix, suffix)
}

#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    let gitlab_pat = credentials::get_credential("gitlab_pat")?
        .map(|k| mask_key(&k));
    let linear_api_key = credentials::get_credential("linear_api_key")?
        .map(|k| mask_key(&k));

    Ok(AppSettings {
        gitlab_pat,
        linear_api_key,
        gitlab_group_id: "12742924".to_string(),
        linear_team_id: "d097c0ee-3414-4d3e-9ff9-56017012a45a".to_string(),
    })
}

#[tauri::command]
pub async fn save_setting(key: String, value: String) -> Result<(), String> {
    match key.as_str() {
        "gitlab_pat" | "linear_api_key" => {
            credentials::store_credential(&key, &value)
        }
        _ => Err(format!("Unknown setting key: {}", key)),
    }
}

#[tauri::command]
pub async fn test_gitlab_connection() -> Result<String, String> {
    let token = credentials::get_credential("gitlab_pat")?
        .ok_or("No GitLab PAT configured")?;

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "PRIVATE-TOKEN",
        reqwest::header::HeaderValue::from_str(&token).map_err(|e| e.to_string())?,
    );
    let http = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())?;

    let user: serde_json::Value = http
        .get("https://gitlab.com/api/v4/user")
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Parse failed: {}", e))?;

    Ok(format!(
        "{} ({})",
        user["name"].as_str().unwrap_or("Unknown"),
        user["username"].as_str().unwrap_or("?")
    ))
}

#[tauri::command]
pub async fn test_linear_connection() -> Result<String, String> {
    let key = credentials::get_credential("linear_api_key")?
        .ok_or("No Linear API key configured")?;

    let http = reqwest::Client::new();
    let resp: serde_json::Value = http
        .post("https://api.linear.app/graphql")
        .header("Authorization", &key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "query": "{ viewer { name email } }" }))
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Parse failed: {}", e))?;

    if let Some(errors) = resp["errors"].as_array() {
        return Err(errors[0]["message"].as_str().unwrap_or("Unknown error").to_string());
    }

    Ok(format!(
        "{} ({})",
        resp["data"]["viewer"]["name"].as_str().unwrap_or("Unknown"),
        resp["data"]["viewer"]["email"].as_str().unwrap_or("?")
    ))
}
