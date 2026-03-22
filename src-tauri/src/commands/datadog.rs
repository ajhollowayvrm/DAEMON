use crate::models::datadog::DatadogMonitor;
use crate::services::credentials;
use crate::services::datadog::DatadogClient;

fn get_client() -> Result<Option<DatadogClient>, String> {
    let api_key = match credentials::get_credential("dd_api_key")? {
        Some(k) if !k.is_empty() => k,
        _ => return Ok(None),
    };
    let app_key = match credentials::get_credential("dd_app_key")? {
        Some(k) if !k.is_empty() => k,
        _ => return Ok(None),
    };
    DatadogClient::new(&api_key, &app_key).map(Some)
}

#[tauri::command]
pub async fn get_datadog_monitors() -> Result<Vec<DatadogMonitor>, String> {
    match get_client()? {
        Some(client) => client.get_monitors().await,
        None => Ok(vec![]),
    }
}
