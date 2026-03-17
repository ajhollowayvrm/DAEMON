use std::collections::HashMap;
use crate::models::slack::{SlackMessage, SlackSection};
use crate::services::slack::{get_slack_creds, slack_api};

struct ChannelDef {
    name: &'static str,
    id: &'static str,
}

const WATCHED_CHANNELS: &[ChannelDef] = &[
    ChannelDef { name: "commrades", id: "C0A2XKT5J2Z" },
    ChannelDef { name: "comms", id: "C06LQ093JR1" },
    ChannelDef { name: "comms_alerts", id: "C0A8SVCRD7D" },
    ChannelDef { name: "comms-product-questions", id: "C09ABA5RQEA" },
    ChannelDef { name: "schema-change-reviews", id: "C0ALT18EQHH" },
];

#[tauri::command]
pub async fn get_slack_sections() -> Result<Vec<SlackSection>, String> {
    let creds = get_slack_creds()?;
    let http = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    // Cache for user ID → display name resolution
    let mut user_cache: HashMap<String, String> = HashMap::new();

    let mut sections = Vec::new();

    // Watched channels
    for ch in WATCHED_CHANNELS {
        match fetch_channel_history(&http, &creds, ch.name, ch.id, &mut user_cache).await {
            Ok((messages, unread_count)) => {
                sections.push(SlackSection {
                    title: format!("#{}", ch.name),
                    section_type: "channel".into(),
                    messages,
                    unread_count,
                });
            }
            Err(e) => {
                eprintln!("[slack] Error fetching #{}: {}", ch.name, e);
                sections.push(SlackSection {
                    title: format!("#{}", ch.name),
                    section_type: "channel".into(),
                    messages: vec![],
                    unread_count: 0,
                });
            }
        }
    }

    // Engineering → comms
    match search_messages(&http, &creds, "in:#engineering comms OR mailer OR scheduler OR sendgrid OR notifications OR email OR whatsapp OR flow", 10).await {
        Ok(messages) => {
            sections.push(SlackSection {
                title: "#engineering → comms".into(),
                section_type: "search".into(),
                messages,
                unread_count: 0,
            });
        }
        Err(e) => {
            eprintln!("[slack] Error searching engineering: {}", e);
            sections.push(SlackSection {
                title: "#engineering → comms".into(),
                section_type: "search".into(),
                messages: vec![],
                unread_count: 0,
            });
        }
    }

    // Customer issues → comms
    match search_messages(&http, &creds, "in:#customer-issues comms OR communications OR mailer OR email OR notifications", 10).await {
        Ok(messages) => {
            sections.push(SlackSection {
                title: "#customer-issues → comms".into(),
                section_type: "search".into(),
                messages,
                unread_count: 0,
            });
        }
        Err(e) => {
            eprintln!("[slack] Error searching customer-issues: {}", e);
            sections.push(SlackSection {
                title: "#customer-issues → comms".into(),
                section_type: "search".into(),
                messages: vec![],
                unread_count: 0,
            });
        }
    }

    // Direct mentions
    let mention_query = format!("<@{}>", creds.user_id);
    match search_messages(&http, &creds, &mention_query, 15).await {
        Ok(messages) => {
            sections.push(SlackSection {
                title: "@mentions".into(),
                section_type: "mentions".into(),
                messages,
                unread_count: 0,
            });
        }
        Err(e) => {
            eprintln!("[slack] Error searching mentions: {}", e);
            sections.push(SlackSection {
                title: "@mentions".into(),
                section_type: "mentions".into(),
                messages: vec![],
                unread_count: 0,
            });
        }
    }

    Ok(sections)
}

async fn resolve_user(
    http: &reqwest::Client,
    creds: &crate::services::slack::SlackCreds,
    user_id: &str,
    cache: &mut HashMap<String, String>,
) -> String {
    if let Some(name) = cache.get(user_id) {
        return name.clone();
    }

    match slack_api(http, creds, "users.info", &[("user", user_id)]).await {
        Ok(data) => {
            let name = data["user"]["real_name"]
                .as_str()
                .or_else(|| data["user"]["profile"]["display_name"].as_str())
                .or_else(|| data["user"]["name"].as_str())
                .unwrap_or(user_id)
                .to_string();
            cache.insert(user_id.to_string(), name.clone());
            name
        }
        Err(_) => {
            cache.insert(user_id.to_string(), user_id.to_string());
            user_id.to_string()
        }
    }
}

async fn fetch_channel_history(
    http: &reqwest::Client,
    creds: &crate::services::slack::SlackCreds,
    channel_name: &str,
    channel_id: &str,
    user_cache: &mut HashMap<String, String>,
) -> Result<(Vec<SlackMessage>, u32), String> {
    // Get channel info for last_read timestamp
    let info = slack_api(http, creds, "conversations.info", &[("channel", channel_id)]).await?;
    let last_read: f64 = info["channel"]["last_read"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);

    // Get recent messages
    let data = slack_api(
        http,
        creds,
        "conversations.history",
        &[("channel", channel_id), ("limit", "15")],
    )
    .await?;

    let mut messages = Vec::new();
    let mut unread_count: u32 = 0;

    if let Some(msgs) = data["messages"].as_array() {
        for msg in msgs {
            // Skip subtypes (joins, leaves, etc.)
            if msg["subtype"].as_str().is_some() {
                continue;
            }

            let user_id_str = msg["user"].as_str().unwrap_or("").to_string();
            let text = msg["text"].as_str().unwrap_or("").to_string();
            let ts = msg["ts"].as_str().unwrap_or("0").to_string();

            let ts_f64: f64 = ts.parse().unwrap_or(0.0);
            if ts_f64 > last_read {
                unread_count += 1;
            }

            // Resolve user display name
            let sender = if !user_id_str.is_empty() {
                resolve_user(http, creds, &user_id_str, user_cache).await
            } else {
                "unknown".to_string()
            };

            // Resolve @mentions in message text
            let clean_text = resolve_mentions_in_text(&text, http, creds, user_cache).await;

            messages.push(SlackMessage {
                id: ts.clone(),
                channel: format!("#{}", channel_name),
                sender,
                message: clean_text,
                timestamp: format_relative_time(&ts),
                permalink: String::new(),
                is_unread: ts_f64 > last_read,
            });
        }
    }

    Ok((messages, unread_count))
}

async fn resolve_mentions_in_text(
    text: &str,
    http: &reqwest::Client,
    creds: &crate::services::slack::SlackCreds,
    cache: &mut HashMap<String, String>,
) -> String {
    let mut result = text.to_string();

    // Handle <@USERID|DisplayName> format (from search results)
    let re_with_name = regex::Regex::new(r"<@(U[A-Z0-9]+)\|([^>]+)>").unwrap();
    result = re_with_name.replace_all(&result, "@$2").to_string();

    // Handle <@USERID> format (from channel history) — resolve via API
    let re_bare = regex::Regex::new(r"<@(U[A-Z0-9]+)>").unwrap();
    let user_ids: Vec<String> = re_bare
        .captures_iter(&result.clone())
        .map(|c| c[1].to_string())
        .collect();

    for uid in user_ids {
        let name = resolve_user(http, creds, &uid, cache).await;
        result = result.replace(&format!("<@{}>", uid), &format!("@{}", name));
    }

    // Clean up channel references <#CXXXXXX|name> → #name
    let ch_re = regex::Regex::new(r"<#[A-Z0-9]+\|([^>]+)>").unwrap();
    result = ch_re.replace_all(&result, "#$1").to_string();

    // Clean up URL formatting <url|text> → text, <url> → url
    let url_re = regex::Regex::new(r"<(https?://[^|>]+)\|([^>]+)>").unwrap();
    result = url_re.replace_all(&result, "$2").to_string();
    let bare_url_re = regex::Regex::new(r"<(https?://[^>]+)>").unwrap();
    result = bare_url_re.replace_all(&result, "$1").to_string();

    result
}

async fn search_messages(
    http: &reqwest::Client,
    creds: &crate::services::slack::SlackCreds,
    query: &str,
    limit: usize,
) -> Result<Vec<SlackMessage>, String> {
    let mut user_cache: HashMap<String, String> = HashMap::new();
    let data = slack_api(
        http,
        creds,
        "search.messages",
        &[
            ("query", query),
            ("sort", "timestamp"),
            ("sort_dir", "desc"),
            ("count", &limit.to_string()),
        ],
    )
    .await?;

    let user_id = &creds.user_id;
    let mut messages = Vec::new();

    if let Some(matches) = data["messages"]["matches"].as_array() {
        for msg in matches {
            let channel_name = msg["channel"]["name"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let sender = msg["username"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let text = msg["text"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let ts = msg["ts"]
                .as_str()
                .unwrap_or("0")
                .to_string();
            let permalink = msg["permalink"]
                .as_str()
                .unwrap_or("")
                .to_string();

            let mut clean_text = resolve_mentions_in_text(&text, http, creds, &mut user_cache).await;
            clean_text = clean_text.replace(&format!("@{}", creds.user_name), "@you");

            messages.push(SlackMessage {
                id: ts.clone(),
                channel: format!("#{}", channel_name),
                sender,
                message: clean_text,
                timestamp: format_relative_time(&ts),
                permalink,
                is_unread: false,
            });
        }
    }

    Ok(messages)
}

#[tauri::command]
pub async fn get_mentions() -> Result<Vec<SlackMessage>, String> {
    let sections = get_slack_sections().await?;
    Ok(sections.into_iter().flat_map(|s| s.messages).collect())
}

fn format_relative_time(ts: &str) -> String {
    let ts_f64: f64 = ts.parse().unwrap_or(0.0);
    let msg_time = std::time::UNIX_EPOCH + std::time::Duration::from_secs_f64(ts_f64);
    let now = std::time::SystemTime::now();
    let elapsed = now.duration_since(msg_time).unwrap_or_default();
    let mins = elapsed.as_secs() / 60;

    if mins < 1 { "just now".into() }
    else if mins < 60 { format!("{}m ago", mins) }
    else if mins < 1440 { format!("{}h ago", mins / 60) }
    else { format!("{}d ago", mins / 1440) }
}
