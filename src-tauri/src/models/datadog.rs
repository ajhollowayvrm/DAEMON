use serde::{Deserialize, Serialize};

/// Raw Datadog API response for monitors
#[derive(Debug, Deserialize)]
pub struct DatadogMonitorRaw {
    pub id: u64,
    pub name: String,
    pub overall_state: String,
    #[serde(rename = "type")]
    pub monitor_type: String,
    pub tags: Vec<String>,
    pub query: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub priority: Option<u8>,
    pub created: Option<String>,
    pub modified: Option<String>,
}

/// Frontend-facing monitor type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatadogMonitor {
    pub id: u64,
    pub name: String,
    /// "OK", "Alert", "Warn", "No Data", or raw API value
    pub status: String,
    pub monitor_type: String,
    pub tags: Vec<String>,
    pub query: String,
    /// The monitor's notification message — often describes what the alert means
    pub message: String,
    pub priority: Option<u8>,
    pub modified: Option<String>,
}
