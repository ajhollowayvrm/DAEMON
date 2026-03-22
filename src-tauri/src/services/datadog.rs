use reqwest::header::{HeaderMap, HeaderValue};

use crate::models::datadog::{DatadogMonitor, DatadogMonitorRaw};

const DATADOG_API: &str = "https://api.datadoghq.com/api/v1";

pub struct DatadogClient {
    client: reqwest::Client,
}

impl DatadogClient {
    pub fn new(api_key: &str, app_key: &str) -> Result<Self, String> {
        let mut headers = HeaderMap::new();
        headers.insert(
            "DD-API-KEY",
            HeaderValue::from_str(api_key).map_err(|e| e.to_string())?,
        );
        headers.insert(
            "DD-APPLICATION-KEY",
            HeaderValue::from_str(app_key).map_err(|e| e.to_string())?,
        );
        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self { client })
    }

    /// Fetch monitors, returning only the fields the frontend needs.
    /// Limited to 200 monitors per request to avoid over-fetching.
    pub async fn get_monitors(&self) -> Result<Vec<DatadogMonitor>, String> {
        let raw: Vec<DatadogMonitorRaw> = self
            .client
            .get(format!("{DATADOG_API}/monitor"))
            .query(&[("page_size", "200")])
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        Ok(raw
            .into_iter()
            .map(|m| DatadogMonitor {
                id: m.id,
                name: m.name,
                status: m.overall_state,
                monitor_type: m.monitor_type,
                tags: m.tags,
                query: m.query,
                message: m.message,
                priority: m.priority,
                modified: m.modified,
            })
            .collect())
    }
}
