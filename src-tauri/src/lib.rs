mod commands;
mod models;
mod services;

use commands::{agent, gitlab, linear, slack};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file from project root
    let _ = dotenvy::from_path(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".env"),
    );

    // Bootstrap credentials from environment variables
    if let Ok(pat) = std::env::var("GITLAB_PAT") {
        let _ = services::credentials::store_credential("gitlab_pat", &pat);
    }
    if let Ok(key) = std::env::var("LINEAR_API_KEY") {
        let _ = services::credentials::store_credential("linear_api_key", &key);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            slack::get_mentions,
            slack::get_slack_sections,
            gitlab::get_merge_requests,
            gitlab::save_gitlab_token,
            gitlab::check_gitlab_connection,
            gitlab::get_mr_detail,
            gitlab::merge_mr,
            gitlab::add_mr_note,
            gitlab::play_job,
            gitlab::retry_job,
            linear::get_issues,
            linear::get_issue_detail,
            linear::add_linear_comment,
            agent::run_agent_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
