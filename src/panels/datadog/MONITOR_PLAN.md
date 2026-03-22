# Comms Monitoring Plan

## Existing Monitors — Add `#comms_alerts` Notification

These monitors are comms-related but don't notify `#comms_alerts`. Update each to add `@slack-comms_alerts` to the message.

| Monitor | ID | Current Notifications | Action |
|---------|-----|----------------------|--------|
| ~~Comms Mailer Success Rate <98%~~ | 228733413 | `#engineering` | ~~Add `@slack-comms_alerts`~~ Done 2026-03-22 |
| ~~Comms Mailer Success Rate <98% (Prod)~~ | 263979521 | `#engineering` | ~~Add `@slack-comms_alerts`~~ Done 2026-03-22 |
| ~~Comms SendGrid Event Processor <99.9%~~ | 229055816 | `#engineering`, `#devsecops-alerts` | ~~Add `@slack-comms_alerts`~~ Done 2026-03-22 |
| ~~Engage SendGrid Event Processor <99.9%~~ | 229050920 | `#engineering`, `#devsecops-alerts` | ~~Add `@slack-comms_alerts`~~ Done 2026-03-22 |
| Issues sending/delivering engage surveys | 227694275 | `#engage-monitors` | Add `@slack-comms_alerts` |
| Health: engage-sendgrid-event-monitor-prod errors | 236239087 | `#engage-monitors` | Add `@slack-comms_alerts` |

Already correct:
| Comm Got Stuck, Auto-Retrying | 263761606 | `#comms_alerts`, Keanna | No change needed |

---

## System Architecture Reference

Three services, six channels, two async Pub/Sub pipelines:

```
Scheduler (CronJob)
  ├─ Polls DB for READY / FAILED / STUCK schedules
  ├─ Publishes schedule IDs to COMMS_SCHEDULE_TOPIC
  └─ Exits after single run

Mailer (Long-lived subscriber)
  ├─ Consumes from COMMS_SCHEDULE_SUB
  ├─ Sends across channels:
  │   ├─ Email  → SendGrid  (50 concurrent, DeliveryLog: PENDING → webhook updates)
  │   ├─ SMS    → Twilio     (5 concurrent, DeliveryLog: SENT → webhook updates)
  │   ├─ Slack  → Slack API  (5 concurrent, DeliveryLog: DELIVERED on send)
  │   ├─ Teams  → MS Graph   (5 concurrent, DeliveryLog: DELIVERED on send)
  │   ├─ Push   → Firebase   (per-user, DeliveryLog on send)
  │   └─ WhatsApp → Twilio   (schema exists, not in critical path)
  └─ Graceful shutdown: 60s grace period, marks schedules FAILED for retry

SendGrid Event Processor (Long-lived subscriber)
  ├─ Consumes from COMMS_SENDGRID_EVENTS_SUB
  ├─ Updates DeliveryLog status (delivered, bounce, dropped)
  └─ Tracks opens/clicks in open_log / click_log
```

Key recovery mechanism: stuck schedules detected after 30 min, retried automatically.

---

## New Monitors to Create

### 1. Comms Scheduler Error Rate
- **Service:** `comms-scheduler`
- **Gap:** Zero monitors on this service. If scheduling fails, comms never get queued.
- **Type:** Log alert
- **Query:** `logs("service:comms-scheduler status:error").index("*").rollup("count").last("10m") > 5`
- **Thresholds:** Alert: >5 errors in 10m, Warning: >2
- **Tags:** `team:comms`, `env:production`, `service:comms-scheduler`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Comms Scheduler is throwing errors. Comms may not be getting queued. Check comms-scheduler logs for root cause."

### 2. Comms Scheduler Throughput Drop (Anomaly)
- **Service:** `comms-scheduler`
- **Gap:** No alert if scheduling volume drops to zero (silent pipeline break). Scheduler is a one-shot CronJob — if it stops running, nobody knows.
- **Type:** Anomaly detection
- **Query:** `avg(last_1h):anomalies(count:trace.express.request{service:comms-scheduler,env:prod}.as_count(), 'agile', 3, direction='below', interval=300, alert_window='last_30m', seasonality='weekly') >= 1`
- **Tags:** `team:comms`, `env:production`, `service:comms-scheduler`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Comms Scheduler throughput has dropped significantly below normal. The comms pipeline may be silently broken. Verify the CronJob is still running in the cluster."

### 3. SendGrid Bounce/Block Spike
- **Service:** `comms-sendgrid-event-processor`
- **Gap:** No deliverability monitoring. Bounces and blocks indicate sender reputation or bad recipient data.
- **Type:** Log alert
- **Query:** `logs("service:comms-sendgrid-event-processor (\"bounce\" OR \"blocked\" OR \"spam_report\" OR \"dropped\")").index("*").rollup("count").last("15m") > 20`
- **Thresholds:** Alert: >20 in 15m, Warning: >10
- **Tags:** `team:comms`, `env:production`, `service:comms-sendgrid-event-processor`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Spike in SendGrid bounces/blocks detected. This may indicate sender reputation issues or bad recipient data. Check the SendGrid event processor logs."

### 4. SMS Delivery Failures
- **Service:** `comms-mailer`
- **Gap:** Only engage survey SMS failures are monitored. General comms SMS failures are not.
- **Log pattern:** `"Failed to send SMS message to user"`
- **Type:** Log alert
- **Query:** `logs("service:comms-mailer \"Failed to send SMS message to user\" env:prod").index("*").rollup("count").last("10m") > 3`
- **Thresholds:** Alert: >3 in 10m
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`, `channel:sms`
- **Notify:** `@slack-comms_alerts`
- **Message:** "SMS delivery failures detected in Comms Mailer. Check logs for Twilio error codes and affected recipients."

### 5. Push Notification Failures
- **Service:** `comms-mailer`
- **Gap:** No monitoring on push notification delivery at all. FCM errors are logged but never alerted.
- **Log pattern:** Errors in `processRecognition()` / `batchSendPushNotifications()`
- **Type:** Log alert
- **Query:** `logs("service:comms-mailer (\"push\" OR \"recognition\" OR \"FCM\") (\"failed\" OR \"error\") env:prod").index("*").rollup("count").last("10m") > 3`
- **Thresholds:** Alert: >3 in 10m
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`, `channel:push`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Push notification delivery failures detected. Check logs for FCM/APNS errors and invalid device tokens."

### 6. Comms Volume Anomaly (Overall Send Rate)
- **Service:** `comms-mailer`
- **Gap:** If the whole comms pipeline silently stops sending, nobody notices until users complain about missing emails.
- **Type:** Anomaly detection
- **Query:** `avg(last_1h):anomalies(count:trace.express.request{service:comms-mailer,env:prod,resource_name:POST /send}.as_count(), 'agile', 3, direction='below', interval=300, alert_window='last_30m', seasonality='weekly') >= 1`
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Comms send volume has dropped significantly below normal patterns. The comms pipeline may be broken. Check comms-scheduler and comms-mailer health."

### 7. Comms Processing Duration (Slow Sends)
- **Service:** `comms-mailer`
- **Gap:** Existing "stuck comm" monitor only catches comms hitting auto-retry. Slow comms (e.g., 10 min instead of seconds) go unnoticed. If processing exceeds the 60s termination grace period, pods get killed mid-send.
- **Type:** APM metric
- **Query:** `avg(last_10m):avg:trace.express.request.duration{service:comms-mailer,env:prod} > 30`
- **Thresholds:** Alert: P99 >30s, Warning: P99 >15s
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Comms processing time is elevated. Comms are being sent but taking significantly longer than normal. Check for downstream service latency (SendGrid, database). If processing exceeds 60s, pods may be killed during graceful shutdown."

### 8. Slack/Teams DM Send Failures
- **Service:** `comms-mailer`
- **Gap:** Slack token revocations, rate limit exhaustion, and Teams auth failures are logged but never alerted. These channels fail silently.
- **Log patterns:** `"Failed to send Slack DM"`, `"Failed to send Teams message"`
- **Type:** Log alert
- **Query:** `logs("service:comms-mailer (\"Failed to send Slack DM\" OR \"Failed to send Teams message\") env:prod").index("*").rollup("count").last("10m") > 3`
- **Thresholds:** Alert: >3 in 10m, Warning: >1
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`, `channel:messaging`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Slack or Teams message delivery failures detected. Check for token revocations (Slack) or OAuth expiration (Teams). Affected users will not receive their communications on these channels."

### 9. Pub/Sub Subscription Message Backlog
- **Service:** `comms-mailer`
- **Gap:** If the mailer can't keep up with the scheduler's publish rate, messages pile up in the Pub/Sub subscription with no visibility.
- **Type:** Metric alert
- **Query:** `avg(last_10m):avg:gcp.pubsub.subscription.num_undelivered_messages{subscription_id:comms-schedule-sub} > 1000`
- **Thresholds:** Alert: >1000 pending messages, Warning: >500
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Comms Pub/Sub subscription has a growing message backlog. The mailer may be unable to keep up, or may be down. Check mailer pod health and Pub/Sub metrics."

### 10. Mailer Graceful Shutdown Timeout
- **Service:** `comms-mailer`
- **Gap:** When a pod is killed mid-processing and the 60s grace period expires, schedules are marked FAILED and retried after 30 min. This means partial sends with a 30-minute gap before remaining users get their comms.
- **Log pattern:** `"Timeout after maximum retries"`, `"Schedule marked FAILED due to SIGTERM timeout"`
- **Type:** Log alert
- **Query:** `logs("service:comms-mailer (\"Timeout after maximum retries\" OR \"SIGTERM timeout\") env:prod").index("*").rollup("count").last("15m") > 0`
- **Thresholds:** Alert: >0
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`
- **Notify:** `@slack-comms_alerts`
- **Message:** "A mailer pod was killed during active processing and hit the 60-second shutdown timeout. Affected schedules were marked FAILED and will retry in ~30 minutes. If this happens frequently during deploys, consider increasing the termination grace period or draining before deploy."

### 11. Translation Service Failures
- **Service:** `comms-mailer`
- **Gap:** When the translation API fails, the mailer silently falls back to English. Users who should receive comms in their language get English instead, with no alert.
- **Log pattern:** `"Error in translateCommsContent"`
- **Type:** Log alert
- **Query:** `logs("service:comms-mailer \"Error in translateCommsContent\" env:prod").index("*").rollup("count").last("15m") > 0`
- **Thresholds:** Alert: >0
- **Tags:** `team:comms`, `env:production`, `service:comms-mailer`, `feature:translation`
- **Notify:** `@slack-comms_alerts`
- **Message:** "Translation service is failing. Affected comms are being sent in English instead of the user's preferred language. Check the translation API (Google Translate) for outages or quota exhaustion."

### 12. Delivery Log Creation Failures
- **Service:** `comms-sendgrid-event-processor`
- **Gap:** When the event processor fails to create a delivery log record, analytics (delivery counts, open rates) drift from reality. These errors are caught and logged but never alerted.
- **Log pattern:** `"Failed to create delivery log record!"`
- **Type:** Log alert
- **Query:** `logs("service:comms-sendgrid-event-processor \"Failed to create delivery log record\" env:prod").index("*").rollup("count").last("10m") > 5`
- **Thresholds:** Alert: >5 in 10m, Warning: >1
- **Tags:** `team:comms`, `env:production`, `service:comms-sendgrid-event-processor`
- **Notify:** `@slack-comms_alerts`
- **Message:** "SendGrid event processor is failing to create delivery log records. Email delivery analytics (delivery counts, open rates) may be inaccurate. Check for database connectivity issues or malformed webhook headers (missing X-Communication-ID)."

---

## Priority Order

### Tier 1 — Immediate (zero coverage on critical paths)
1. ~~**Add `#comms_alerts` to existing monitors**~~ — 4/6 done, 2 remaining
2. **Comms Scheduler Error Rate** (#1) — Zero coverage on a critical service
3. **SendGrid Bounce/Block Spike** (#3) — Deliverability is business-critical
4. **Comms Volume Anomaly** (#6) — Catches silent pipeline failures
5. **Slack/Teams DM Send Failures** (#8) — These channels fail completely silently

### Tier 2 — High (channel-specific visibility)
6. **SMS Delivery Failures** (#4) — Channel-specific visibility
7. **Push Notification Failures** (#5) — Channel-specific visibility
8. **Pub/Sub Subscription Backlog** (#9) — Infrastructure-level pipeline health
9. **Mailer Graceful Shutdown Timeout** (#10) — Partial send detection

### Tier 3 — Medium (needs baseline data or threshold tuning)
10. **Comms Scheduler Throughput Drop** (#2) — Anomaly detection, needs 2+ weeks baseline
11. **Comms Processing Duration** (#7) — Needs threshold tuning
12. **Translation Service Failures** (#11) — Graceful degradation, low blast radius
13. **Delivery Log Creation Failures** (#12) — Analytics accuracy

---

## Notes

- All log queries are approximate — verify exact log formats by searching recent logs before creating monitors
- Anomaly detection monitors (#2, #6) need 2+ weeks of baseline data to be accurate
- The two Comms Mailer SLO monitors (228733413, 263979521) are currently in **Alert** — error budget is blown, investigate immediately
- Log patterns referenced above are from the actual codebase in `apps/comms/src/` — grep for exact strings before finalizing queries
- The `team:com` tag in existing monitors may be a typo — verify whether `team:comms` or `team:com` is the correct convention
- Pub/Sub subscription ID in monitor #9 needs to be verified against the actual GCP project config
