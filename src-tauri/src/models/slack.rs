use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackMessage {
    pub id: String,
    pub channel: String,
    pub sender: String,
    pub message: String,
    pub timestamp: String,
    pub permalink: String,
    pub is_unread: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackSection {
    pub title: String,
    pub section_type: String,
    pub messages: Vec<SlackMessage>,
    pub unread_count: u32,
}
