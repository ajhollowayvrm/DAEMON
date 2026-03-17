mod commands;
mod models;
mod services;

use commands::{agent, gitlab, linear, settings, slack};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

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
        .setup(|app| {
            let settings_item = MenuItemBuilder::with_id("settings", "Settings...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let replay_boot_item = MenuItemBuilder::with_id("replay-boot", "Replay Boot Sequence")
                .accelerator("CmdOrCtrl+Shift+B")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "D.A.E.M.O.N.")
                .item(&settings_item)
                .item(&replay_boot_item)
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id() == "settings" {
                    let _ = app_handle.emit("open-settings", ());
                } else if event.id() == "replay-boot" {
                    let _ = app_handle.emit("replay-boot", ());
                }
            });

            Ok(())
        })
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
            settings::get_settings,
            settings::save_setting,
            settings::test_gitlab_connection,
            settings::test_linear_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
