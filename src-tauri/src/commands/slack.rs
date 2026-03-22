use std::collections::HashMap;
use crate::models::slack::{SlackMessage, SlackSection};
use crate::services::slack::{get_slack_creds, slack_api, slack_api_post};

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

    // My threads — threads I was mentioned in or replied to, sorted by latest reply
    match fetch_my_threads(&http, &creds, &mut user_cache).await {
        Ok(messages) => {
            sections.insert(0, SlackSection {
                title: "My Threads".into(),
                section_type: "my_threads".into(),
                messages,
                unread_count: 0,
            });
        }
        Err(e) => {
            eprintln!("[slack] Error fetching my threads: {}", e);
            sections.insert(0, SlackSection {
                title: "My Threads".into(),
                section_type: "my_threads".into(),
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

            // Only include top-level messages (thread_ts absent or equals ts)
            let thread_ts = msg["thread_ts"].as_str();
            if let Some(tts) = thread_ts {
                if tts != ts {
                    continue; // skip threaded replies
                }
            }

            let ts_f64: f64 = ts.parse().unwrap_or(0.0);
            if ts_f64 > last_read {
                unread_count += 1;
            }

            let reply_count = msg["reply_count"].as_u64().unwrap_or(0) as u32;
            let latest_reply_ts = msg["latest_reply"].as_str().map(|s| s.to_string());
            let raw_ts = ts.clone();

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
                channel_id: channel_id.to_string(),
                sender,
                message: clean_text,
                timestamp: format_relative_time(&ts),
                raw_ts,
                permalink: String::new(),
                is_unread: ts_f64 > last_read,
                reply_count,
                latest_reply_ts,
            });
        }
    }

    Ok((messages, unread_count))
}

async fn resolve_usergroup(
    http: &reqwest::Client,
    creds: &crate::services::slack::SlackCreds,
    group_id: &str,
    cache: &mut HashMap<String, String>,
) -> String {
    let cache_key = format!("ug:{}", group_id);
    if let Some(name) = cache.get(&cache_key) {
        return name.clone();
    }

    match slack_api(http, creds, "usergroups.list", &[("include_disabled", "false")]).await {
        Ok(data) => {
            // Cache all groups from the response
            if let Some(groups) = data["usergroups"].as_array() {
                for g in groups {
                    let gid = g["id"].as_str().unwrap_or("");
                    let handle = g["handle"].as_str().unwrap_or("");
                    let name = g["name"].as_str().unwrap_or(handle);
                    cache.insert(format!("ug:{}", gid), format!("@{}", handle));
                    let _ = name; // we use handle for the @mention style
                }
            }
            cache.get(&cache_key).cloned().unwrap_or_else(|| format!("@group-{}", group_id))
        }
        Err(_) => {
            let fallback = format!("@group-{}", group_id);
            cache.insert(cache_key, fallback.clone());
            fallback
        }
    }
}

async fn resolve_channel_name(
    http: &reqwest::Client,
    creds: &crate::services::slack::SlackCreds,
    channel_id: &str,
    cache: &mut HashMap<String, String>,
) -> String {
    let cache_key = format!("ch:{}", channel_id);
    if let Some(name) = cache.get(&cache_key) {
        return name.clone();
    }

    match slack_api(http, creds, "conversations.info", &[("channel", channel_id)]).await {
        Ok(data) => {
            let name = data["channel"]["name"]
                .as_str()
                .unwrap_or(channel_id)
                .to_string();
            cache.insert(cache_key, name.clone());
            name
        }
        Err(_) => {
            cache.insert(cache_key, channel_id.to_string());
            channel_id.to_string()
        }
    }
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

    // Handle <!subteam^SXXXXXX|@handle> format — group mentions with label
    let subteam_labeled = regex::Regex::new(r"<!subteam\^[A-Z0-9]+\|@([^>]+)>").unwrap();
    result = subteam_labeled.replace_all(&result, "@$1").to_string();

    // Handle <!subteam^SXXXXXX> format — group mentions without label, resolve via API
    let subteam_bare = regex::Regex::new(r"<!subteam\^([A-Z0-9]+)>").unwrap();
    let group_ids: Vec<String> = subteam_bare
        .captures_iter(&result.clone())
        .map(|c| c[1].to_string())
        .collect();

    for gid in group_ids {
        let name = resolve_usergroup(http, creds, &gid, cache).await;
        result = result.replace(&format!("<!subteam^{}>", gid), &name);
    }

    // Handle special mentions: <!here>, <!channel>, <!everyone>
    result = result.replace("<!here>", "@here");
    result = result.replace("<!here|here>", "@here");
    result = result.replace("<!channel>", "@channel");
    result = result.replace("<!channel|channel>", "@channel");
    result = result.replace("<!everyone>", "@everyone");
    result = result.replace("<!everyone|everyone>", "@everyone");

    // Clean up channel references <#CXXXXXX|name> → #name
    let ch_re = regex::Regex::new(r"<#([A-Z0-9]+)\|([^>]+)>").unwrap();
    result = ch_re.replace_all(&result, "#$2").to_string();

    // Handle bare channel references <#CXXXXXX> — resolve via API
    let ch_bare = regex::Regex::new(r"<#([A-Z0-9]+)>").unwrap();
    let channel_ids: Vec<String> = ch_bare
        .captures_iter(&result.clone())
        .map(|c| c[1].to_string())
        .collect();

    for cid in channel_ids {
        let name = resolve_channel_name(http, creds, &cid, cache).await;
        result = result.replace(&format!("<#{}>", cid), &format!("#{}", name));
    }

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

    let mut messages = Vec::new();

    if let Some(matches) = data["messages"]["matches"].as_array() {
        for msg in matches {
            let channel_name = msg["channel"]["name"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let channel_id = msg["channel"]["id"]
                .as_str()
                .unwrap_or("")
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

            let raw_ts = ts.clone();
            messages.push(SlackMessage {
                id: ts.clone(),
                channel: format!("#{}", channel_name),
                channel_id,
                sender,
                message: clean_text,
                timestamp: format_relative_time(&ts),
                raw_ts,
                permalink,
                is_unread: false,
                reply_count: 0,
                latest_reply_ts: None,
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

#[tauri::command]
pub async fn get_thread_replies(channel_id: String, thread_ts: String) -> Result<Vec<SlackMessage>, String> {
    let creds = get_slack_creds()?;
    let http = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let mut user_cache = HashMap::new();

    let data = slack_api(&http, &creds, "conversations.replies", &[
        ("channel", channel_id.as_str()),
        ("ts", thread_ts.as_str()),
        ("limit", "200"),
        ("inclusive", "true"),
    ]).await?;

    let mut messages = Vec::new();
    if let Some(msgs) = data["messages"].as_array() {
        for msg in msgs {
            let subtype = msg["subtype"].as_str().unwrap_or("");
            if subtype == "channel_join" || subtype == "channel_leave" || subtype == "channel_topic" || subtype == "channel_purpose" {
                continue;
            }
            let user_id_str = msg["user"].as_str().unwrap_or("").to_string();
            let text = msg["text"].as_str().unwrap_or("").to_string();
            let ts = msg["ts"].as_str().unwrap_or("0").to_string();
            let sender = if !user_id_str.is_empty() {
                resolve_user(&http, &creds, &user_id_str, &mut user_cache).await
            } else {
                msg["username"].as_str().unwrap_or("unknown").to_string()
            };
            let clean_text = resolve_mentions_in_text(&text, &http, &creds, &mut user_cache).await;
            let raw_ts = ts.clone();
            messages.push(SlackMessage {
                id: ts.clone(),
                channel: format!("#{}", channel_id),
                channel_id: channel_id.clone(),
                sender,
                message: clean_text,
                timestamp: format_relative_time(&ts),
                raw_ts,
                permalink: String::new(),
                is_unread: false,
                reply_count: 0,
                latest_reply_ts: None,
            });
        }
    }
    Ok(messages)
}

/// Finds threads the user was mentioned in or replied to, returns root messages
/// sorted by latest_reply descending.
async fn fetch_my_threads(
    http: &reqwest::Client,
    creds: &crate::services::slack::SlackCreds,
    _user_cache: &mut HashMap<String, String>,
) -> Result<Vec<SlackMessage>, String> {
    let from_query = format!("from:<@{}>", creds.user_id);
    let mention_query = format!("<@{}>", creds.user_id);

    let from_params: Vec<(&str, &str)> = vec![
        ("query", from_query.as_str()),
        ("sort", "timestamp"),
        ("sort_dir", "desc"),
        ("count", "20"),
    ];
    let mention_params: Vec<(&str, &str)> = vec![
        ("query", mention_query.as_str()),
        ("sort", "timestamp"),
        ("sort_dir", "desc"),
        ("count", "20"),
    ];

    let (from_result, mention_result) = tokio::join!(
        slack_api(http, creds, "search.messages", &from_params),
        slack_api(http, creds, "search.messages", &mention_params),
    );

    // search.messages doesn't include thread_ts in the JSON body, BUT it does
    // embed it in the permalink URL as ?thread_ts=XXXXX. Parse it from there.
    let thread_ts_re = regex::Regex::new(r"thread_ts=(\d+\.\d+)").unwrap();

    let mut seen_threads: std::collections::HashSet<(String, String)> = std::collections::HashSet::new();
    let mut thread_refs: Vec<(String, String, String)> = Vec::new(); // (channel_id, channel_name, root_ts)

    let mut collect = |data: &serde_json::Value| {
        if let Some(matches) = data["messages"]["matches"].as_array() {
            for msg in matches {
                let channel_id = msg["channel"]["id"].as_str().unwrap_or("").to_string();
                let channel_name = msg["channel"]["name"].as_str().unwrap_or("unknown").to_string();
                let ts = msg["ts"].as_str().unwrap_or("0").to_string();
                if channel_id.starts_with('D') { continue; } // skip DMs

                // Extract thread_ts from permalink
                let permalink = msg["permalink"].as_str().unwrap_or("");
                let root_ts = thread_ts_re.captures(permalink)
                    .map(|c| c[1].to_string())
                    .unwrap_or_else(|| ts.clone());

                // If root_ts == ts, this might be a standalone message — we'll filter later
                let key = (channel_id.clone(), root_ts.clone());
                if !seen_threads.contains(&key) && !channel_id.is_empty() {
                    seen_threads.insert(key);
                    thread_refs.push((channel_id, channel_name, root_ts));
                }
            }
        }
    };

    if let Ok(data) = &from_result { collect(data); }
    if let Ok(data) = &mention_result { collect(data); }

    if from_result.is_err() && mention_result.is_err() {
        return Err(from_result.unwrap_err());
    }

    // Fetch root message for each thread via conversations.replies
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(5));
    let http = std::sync::Arc::new(http.clone());
    let creds = std::sync::Arc::new(creds.clone());
    let mut handles = Vec::new();

    for (channel_id, channel_name, root_ts) in thread_refs {
        let http = http.clone();
        let creds = creds.clone();
        let sem = semaphore.clone();

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            let result = slack_api(
                &http,
                &creds,
                "conversations.replies",
                &[
                    ("channel", channel_id.as_str()),
                    ("ts", root_ts.as_str()),
                    ("limit", "2"),
                    ("inclusive", "true"),
                ],
            ).await;
            (channel_id, channel_name, root_ts, result)
        }));
    }

    // Reset for dedup on the output side
    seen_threads.clear();
    let mut messages: Vec<SlackMessage> = Vec::new();

    for handle in handles {
        let (channel_id, channel_name, root_ts, result) = match handle.await {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Dedup: skip if we already have this thread
        let thread_key = (channel_id.clone(), root_ts.clone());
        if seen_threads.contains(&thread_key) { continue; }

        let data = match result {
            Ok(d) => d,
            Err(_) => continue,
        };

        let msgs = match data["messages"].as_array() {
            Some(m) if !m.is_empty() => m,
            _ => continue,
        };

        // Root message is always index 0
        let root = &msgs[0];
        // Only skip subtypes that are truly noise (joins, leaves, etc.)
        // Keep bot_message, me_message, etc. since they can start real threads
        let subtype = root["subtype"].as_str().unwrap_or("");
        if subtype == "channel_join" || subtype == "channel_leave" || subtype == "channel_topic" || subtype == "channel_purpose" {
            continue;
        }

        let reply_count = root["reply_count"].as_u64().unwrap_or(0) as u32;

        // Skip standalone messages with no replies
        if reply_count == 0 && msgs.len() <= 1 { continue; }

        seen_threads.insert(thread_key);

        let user_id_str = root["user"].as_str().unwrap_or("").to_string();
        let text = root["text"].as_str().unwrap_or("").to_string();
        let ts = root["ts"].as_str().unwrap_or("0").to_string();
        let latest_reply_ts = root["latest_reply"].as_str().map(|s| s.to_string());

        let mut local_cache = HashMap::new();
        let sender = if !user_id_str.is_empty() {
            resolve_user(&http, &creds, &user_id_str, &mut local_cache).await
        } else {
            // Bot messages use "username" instead of "user"
            root["username"].as_str().unwrap_or("unknown").to_string()
        };

        let clean_text = resolve_mentions_in_text(&text, &http, &creds, &mut local_cache).await;

        let sort_ts = latest_reply_ts.clone().unwrap_or_else(|| ts.clone());

        messages.push(SlackMessage {
            id: ts.clone(),
            channel: format!("#{}", channel_name),
            channel_id,
            sender,
            message: clean_text,
            timestamp: format_relative_time(&sort_ts),
            raw_ts: ts,
            permalink: String::new(),
            is_unread: false,
            reply_count,
            latest_reply_ts: Some(sort_ts.clone()),
        });
    }

    // Sort by latest activity descending
    messages.sort_by(|a, b| {
        let a_ts = a.latest_reply_ts.as_deref().unwrap_or(&a.raw_ts);
        let b_ts = b.latest_reply_ts.as_deref().unwrap_or(&b.raw_ts);
        b_ts.cmp(a_ts)
    });

    Ok(messages)
}

#[tauri::command]
pub async fn mark_as_read(channel_id: String, ts: String) -> Result<bool, String> {
    let creds = get_slack_creds()?;
    let http = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let result = slack_api(
        &http,
        &creds,
        "conversations.mark",
        &[("channel", &channel_id), ("ts", &ts)],
    )
    .await?;

    let ok = result["ok"].as_bool().unwrap_or(false);
    Ok(ok)
}

// ── Send Message ─────────────────────────────────────────────

#[tauri::command]
pub async fn send_slack_message(
    channel_id: String,
    text: String,
    thread_ts: Option<String>,
) -> Result<SlackMessage, String> {
    let creds = get_slack_creds()?;
    let http = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let mut body = serde_json::json!({
        "channel": channel_id,
        "text": text,
    });

    if let Some(ref ts) = thread_ts {
        body["thread_ts"] = serde_json::Value::String(ts.clone());
    }

    let result = slack_api_post(&http, &creds, "chat.postMessage", &body).await?;

    let msg = &result["message"];
    let ts_str = msg["ts"].as_str().unwrap_or("").to_string();

    Ok(SlackMessage {
        id: ts_str.clone(),
        channel: channel_id.clone(),
        channel_id: channel_id,
        sender: creds.user_name.clone(),
        message: text,
        timestamp: format_relative_time(&ts_str),
        raw_ts: ts_str,
        permalink: String::new(),
        is_unread: false,
        reply_count: 0,
        latest_reply_ts: None,
    })
}

// ── DM Conversations ─────────────────────────────────────────

#[derive(Debug, serde::Serialize)]
pub struct DmConversation {
    pub channel_id: String,
    pub user_id: String,
    pub user_name: String,
    pub last_message: Option<String>,
    pub last_message_ts: Option<String>,
    pub is_unread: bool,
}

#[tauri::command]
pub async fn get_dm_conversations() -> Result<Vec<DmConversation>, String> {
    let creds = get_slack_creds()?;
    let http = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch recent IM conversations
    let data = slack_api(
        &http,
        &creds,
        "conversations.list",
        &[("types", "im"), ("limit", "20"), ("exclude_archived", "true")],
    )
    .await?;

    let channels = data["channels"]
        .as_array()
        .ok_or("No channels in response")?;

    let mut user_cache: HashMap<String, String> = HashMap::new();
    let mut convos = Vec::new();

    for ch in channels {
        let channel_id = ch["id"].as_str().unwrap_or("").to_string();
        let user_id = ch["user"].as_str().unwrap_or("").to_string();

        if user_id.is_empty() || user_id == "USLACKBOT" {
            continue;
        }

        // Resolve user name
        let user_name = if let Some(name) = user_cache.get(&user_id) {
            name.clone()
        } else {
            let name = match slack_api(&http, &creds, "users.info", &[("user", &user_id)]).await {
                Ok(udata) => {
                    udata["user"]["profile"]["display_name_normalized"]
                        .as_str()
                        .filter(|s| !s.is_empty())
                        .or_else(|| udata["user"]["real_name"].as_str())
                        .unwrap_or(&user_id)
                        .to_string()
                }
                Err(_) => user_id.clone(),
            };
            user_cache.insert(user_id.clone(), name.clone());
            name
        };

        // Get last message from conversation
        let history = slack_api(
            &http,
            &creds,
            "conversations.history",
            &[("channel", &channel_id), ("limit", "1")],
        )
        .await;

        let (last_message, last_message_ts) = if let Ok(ref h) = history {
            if let Some(msgs) = h["messages"].as_array() {
                if let Some(m) = msgs.first() {
                    let text = m["text"].as_str().unwrap_or("").to_string();
                    let ts = m["ts"].as_str().unwrap_or("").to_string();
                    (Some(text), Some(ts))
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        // Check unread — compare last_read vs latest
        let is_unread = ch["is_open"].as_bool().unwrap_or(false)
            && last_message_ts.as_deref().unwrap_or("") > ch["last_read"].as_str().unwrap_or("999999999999.999999");

        convos.push(DmConversation {
            channel_id,
            user_id,
            user_name,
            last_message,
            last_message_ts,
            is_unread,
        });
    }

    // Sort by last message timestamp descending (most recent first)
    convos.sort_by(|a, b| {
        let a_ts = a.last_message_ts.as_deref().unwrap_or("");
        let b_ts = b.last_message_ts.as_deref().unwrap_or("");
        b_ts.cmp(a_ts)
    });

    Ok(convos)
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
