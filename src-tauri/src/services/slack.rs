use serde::Deserialize;
use std::sync::Mutex;
use once_cell::sync::Lazy;

#[derive(Debug, Clone, Deserialize)]
pub struct SlackCreds {
    pub token: String,
    pub cookie: String,
    pub team_id: String,
    pub team_name: String,
    pub user_id: String,
    pub user_name: String,
}

static CACHED_CREDS: Lazy<Mutex<Option<SlackCreds>>> = Lazy::new(|| Mutex::new(None));

pub fn get_slack_creds() -> Result<SlackCreds, String> {
    // Return cached creds if available
    if let Some(ref creds) = *CACHED_CREDS.lock().unwrap() {
        return Ok(creds.clone());
    }

    // Run the Python script to extract creds from Slack desktop app
    let script_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join("slack_creds.py");

    let output = std::process::Command::new("python3")
        .arg(&script_path)
        .output()
        .map_err(|e| format!("Failed to run slack_creds.py: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Slack creds script failed: {}", stderr));
    }

    let creds: SlackCreds = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse slack creds: {}", e))?;

    *CACHED_CREDS.lock().unwrap() = Some(creds.clone());
    Ok(creds)
}

pub async fn slack_api(
    http: &reqwest::Client,
    creds: &SlackCreds,
    method: &str,
    params: &[(&str, &str)],
) -> Result<serde_json::Value, String> {
    let url = format!("https://slack.com/api/{}", method);
    let resp = http
        .get(&url)
        .header("Authorization", format!("Bearer {}", creds.token))
        .header("Cookie", format!("d={}", creds.cookie))
        .query(params)
        .send()
        .await
        .map_err(|e| format!("Slack API error: {}", e))?;

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Slack API parse error: {}", e))?;

    if !data["ok"].as_bool().unwrap_or(false) {
        return Err(format!(
            "Slack API error: {}",
            data["error"].as_str().unwrap_or("unknown")
        ));
    }

    Ok(data)
}
