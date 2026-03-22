import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Bell,
  BellOff,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  ListPlus,
  Inbox,
  AlertTriangle,
  Hash,
  MessagesSquare,
  Eye,
  Check,
  Send,
  Mail,
  X,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { Panel } from "../../components/layout/Panel";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { useSlackSections } from "../../hooks";
import { useThreadReplies } from "../../hooks/useThreadReplies";
import { useDmConversations } from "../../hooks/useDmConversations";
import { fetchThreadReplies, markAsRead, sendSlackMessage } from "../../services/tauri-bridge";
import { useThreadSubscriptionStore } from "../../stores/threadSubscriptionStore";
import { useSlackUserStore } from "../../stores/slackUserStore";
import { useWatchedThreads } from "../../hooks/useWatchedThreads";
import { useLayoutStore } from "../../stores/layoutStore";
import { ActionMenu } from "../../components/ai/ActionMenu";
import { AgentPromptBar } from "../../components/ai/AgentPromptBar";
import { CreateTodoModal } from "../../components/ui/CreateTodoModal";
import { AddToFocusButton } from "../../components/ui/AddToFocusButton";
import { CorrelationBadge } from "../../components/ui/RelatedItems";
import type { SlackSection, SlackMessage } from "../../types/models";
import styles from "./SlackPanel.module.css";

// ── Tab type ─────────────────────────────────────────────────
type SlackTab = "unread" | "alerts" | "channels" | "threads" | "dms";

// ── Framer Motion variants ───────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const threadRowVariants = {
  hidden: { opacity: 0, x: -20, filter: "blur(3px)" },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { delay: i * 0.04, duration: 0.25, ease: EASE_OUT },
  }),
  exit: {
    opacity: 0,
    x: -20,
    filter: "blur(4px)",
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 0,
    overflow: "hidden" as const,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
} satisfies Record<string, object>;

const replyVariants = {
  hidden: { opacity: 0, y: -10, scaleY: 0.92, filter: "brightness(2) blur(2px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scaleY: 1,
    filter: "brightness(1) blur(0px)",
    transition: { delay: i * 0.06, duration: 0.38, ease: EASE_OUT },
  }),
} satisfies Record<string, object>;

const expandVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.22, ease: "easeIn" as const } },
} satisfies Record<string, object>;

// ── Alert detection ──────────────────────────────────────────
function isAlertChannel(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("alert") || lower.includes("incident") || lower.includes("pagerduty");
}

function isAlertMessage(msg: SlackMessage): boolean {
  const sender = msg.sender.toLowerCase();
  return sender.includes("bot") || sender.includes("alert") || sender.includes("pagerduty")
    || sender.includes("datadog") || sender.includes("sentry") || sender.includes("opsgenie");
}

// ── Thread Loader ────────────────────────────────────────────
const THREAD_LOADING_LINES = [
  "Intercepting thread data stream...",
  "Decrypting conversation payload...",
  "Reconstructing message timeline...",
  "Tracing reply chains through the void...",
  "Downloading corporate banter...",
  "Parsing threaded discourse...",
];

function ThreadLoader() {
  const [lineIdx, setLineIdx] = useState(() => Math.floor(Math.random() * THREAD_LOADING_LINES.length));

  useEffect(() => {
    const iv = setInterval(() => setLineIdx((i) => (i + 1) % THREAD_LOADING_LINES.length), 2200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className={styles.threadLoader}>
      <div className={styles.threadLoaderBars}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.threadLoaderBar} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className={styles.threadLoaderText}>{THREAD_LOADING_LINES[lineIdx]}</div>
      <div className={styles.threadLoaderScanline} />
    </div>
  );
}

// ── Thread Detail View ───────────────────────────────────────
function ThreadDetailView({
  channelId,
  threadTs,
  onBack,
}: {
  channelId: string;
  threadTs: string;
  onBack: () => void;
}) {
  const { data: replies, isLoading } = useThreadReplies(channelId, threadTs, true);
  const { subscriptions, subscribe, unsubscribe } = useThreadSubscriptionStore();
  const [animating, setAnimating] = useState(false);
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const subId = `${channelId}:${threadTs}`;
  const isSubscribed = subscriptions.some((s) => s.id === subId);

  const sorted = useMemo(() => {
    if (!replies) return [];
    return [...replies].sort((a, b) => a.raw_ts.localeCompare(b.raw_ts));
  }, [replies]);

  const root = sorted[0];

  const handleWatch = () => {
    if (isSubscribed) {
      unsubscribe(subId);
    } else if (root) {
      setAnimating(true);
      subscribe({
        id: subId,
        channelId,
        channelName: root.channel,
        threadTs,
        label: root.message.slice(0, 60),
        summary: root.message.slice(0, 60),
        sender: root.sender,
        lastKnownReplyTs: sorted.length > 1 ? sorted[sorted.length - 1].raw_ts : null,
        latestReplyTs: sorted.length > 1 ? sorted[sorted.length - 1].raw_ts : null,
      });
      setTimeout(() => setAnimating(false), 800);
    }
  };

  return (
    <div className={styles.threadDetail}>
      <div className={styles.threadDetailToolbar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={12} />
          Back
        </button>
        {root && (
          <button
            className={`${styles.watchBtn} ${isSubscribed ? styles.watchBtnActive : ""} ${animating ? styles.watchBtnPop : ""}`}
            onClick={handleWatch}
            title={isSubscribed ? "Unwatch thread" : "Watch thread — shows on Hub"}
          >
            {isSubscribed ? <BellOff size={12} /> : <Bell size={12} />}
            <span>{isSubscribed ? "Watching" : "Watch"}</span>
          </button>
        )}
        {root && (
          <AddToFocusButton
            link={{
              source: "slack",
              label: `${root.sender}: ${root.message.slice(0, 60)}`,
              subtitle: root.channel,
              url: root.permalink,
              navigateTo: "slack",
              slackRef: { channelId, threadTs },
            }}
            title={`${root.sender}: ${root.message.slice(0, 50)}`}
          />
        )}
        {root && <CorrelationBadge entityId={`slack:${channelId}:${threadTs}`} />}
        {root && (
          <button
            className={styles.watchBtn}
            onClick={() => setShowCreateTodo(true)}
            title="Create To-Do from thread"
          >
            <ListPlus size={12} />
            <span>To-Do</span>
          </button>
        )}
        {root && (
          <ActionMenu
            source="slack"
            context={{
              message: root.message,
              sender: root.sender,
              channel: root.channel,
              channelId: root.channel_id,
              threadTs: root.raw_ts,
              permalink: root.permalink,
            }}
          />
        )}
      </div>
      {root && (
        <AgentPromptBar
          contextLabel={`Thread in ${root.channel}`}
          contextPrefix={[
            `Regarding Slack thread in ${root.channel}`,
            `Permalink: ${root.permalink}`,
            "",
            "## Thread",
            ...sorted.map((msg) => `**${msg.sender}**: ${msg.message}`),
          ].join("\n")}
        />
      )}
      {showCreateTodo && root && (
        <CreateTodoModal
          preset={{
            source: "slack",
            title: `${root.sender}: ${root.message.slice(0, 80)}`,
            subtitle: root.channel,
            url: root.permalink,
          }}
          onClose={() => setShowCreateTodo(false)}
        />
      )}
      <div className={styles.threadDetailMessages}>
        {isLoading && <ThreadLoader />}
        {sorted.map((msg, i) => (
          <motion.div
            key={msg.id}
            className={`${styles.replyRow} ${i === 0 ? styles.replyRowRoot : styles.replyRowIndent}`}
            custom={i}
            variants={replyVariants}
            initial="hidden"
            animate="visible"
          >
            <div className={styles.replyHeader}>
              <span className={styles.replySender}>{msg.sender}</span>
              <span className={styles.replyTimestamp}>{msg.timestamp}</span>
              {msg.permalink && (
                <button className={styles.openInSlackBtn} onClick={() => open(msg.permalink)}>
                  <ExternalLink size={10} />
                </button>
              )}
            </div>
            <p className={styles.replyBody}>{msg.message}</p>
          </motion.div>
        ))}
      </div>
      {/* Compose bar */}
      <div className={styles.composeBar}>
        <input
          className={styles.composeInput}
          placeholder="Reply in thread..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && !e.shiftKey && replyText.trim() && !sending) {
              e.preventDefault();
              setSending(true);
              try {
                await sendSlackMessage(channelId, replyText.trim(), threadTs);
                setReplyText("");
              } finally {
                setSending(false);
              }
            }
          }}
          disabled={sending}
        />
        <button
          className={styles.composeSendBtn}
          onClick={async () => {
            if (!replyText.trim() || sending) return;
            setSending(true);
            try {
              await sendSlackMessage(channelId, replyText.trim(), threadTs);
              setReplyText("");
            } finally {
              setSending(false);
            }
          }}
          disabled={!replyText.trim() || sending}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Message Row (shared by all tabs) ─────────────────────────
function MessageRow({
  msg,
  index,
  showChannel,
  isAlert,
  isSubscribed,
  onSubscribe,
  onUnsubscribe,
  onClick,
  onMarkRead,
  onDismiss,
}: {
  msg: SlackMessage;
  index: number;
  showChannel?: boolean;
  isAlert?: boolean;
  isSubscribed: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  onClick: () => void;
  onMarkRead?: () => void;
  onDismiss?: () => void;
}) {
  const [animating, setAnimating] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const preview = msg.message.length > 100
    ? msg.message.slice(0, 100) + "…"
    : msg.message;

  const handleWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSubscribed) {
      onUnsubscribe();
    } else {
      setAnimating(true);
      onSubscribe();
      setTimeout(() => setAnimating(false), 800);
    }
  };

  return (
    <motion.div
      className={`${styles.threadRow} ${msg.is_unread ? styles.threadRowUnread : ""} ${isAlert ? styles.threadRowAlert : ""}`}
      custom={index}
      variants={threadRowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <div
        className={styles.threadRowMain}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      >
        <div className={styles.threadRowHeader}>
          <span className={`${styles.sender} ${isAlert ? styles.senderAlert : ""}`}>{msg.sender}</span>
          {showChannel && <span className={styles.threadChannel}>{msg.channel}</span>}
          <span className={styles.timestamp}>{msg.timestamp}</span>
          {msg.reply_count > 0 && (
            <span className={styles.replyBadge}>
              {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
            </span>
          )}
          {isAlert && (
            <span className={styles.alertBadge}>
              <AlertTriangle size={9} />
              alert
            </span>
          )}
        </div>
        <p className={styles.threadPreview}>{preview}</p>
      </div>
      <div className={styles.threadRowActions}>
        {onDismiss && (
          <button
            className={styles.dismissAlertBtn}
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            title="Clear alert"
          >
            <X size={11} />
          </button>
        )}
        {msg.is_unread && onMarkRead && (
          <button
            className={styles.markReadSmBtn}
            onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
            title="Mark as read"
          >
            <Eye size={11} />
          </button>
        )}
        <AddToFocusButton
          compact
          link={{
            source: "slack",
            label: `${msg.sender}: ${msg.message.slice(0, 60)}`,
            subtitle: msg.channel,
            url: msg.permalink,
            navigateTo: "slack",
            slackRef: { channelId: msg.channel_id, threadTs: msg.raw_ts },
          }}
          title={`${msg.sender}: ${msg.message.slice(0, 50)}`}
        />
        <CorrelationBadge entityId={`slack:${msg.channel_id}:${msg.raw_ts}`} />
        <button
          className={`${styles.watchBtn} ${isSubscribed ? styles.watchBtnActive : ""} ${animating ? styles.watchBtnPop : ""}`}
          onClick={handleWatch}
          title={isSubscribed ? "Unwatch" : "Watch"}
        >
          {isSubscribed ? <BellOff size={11} /> : <Bell size={11} />}
        </button>
        <button
          className={styles.quickTodoBtn}
          onClick={(e) => { e.stopPropagation(); setShowTodoModal(true); }}
          title="Create To-Do"
        >
          <ListPlus size={11} />
        </button>
        <ActionMenu
          source="slack"
          context={{
            message: msg.message,
            sender: msg.sender,
            channel: msg.channel,
            channelId: msg.channel_id,
            threadTs: msg.raw_ts,
            permalink: msg.permalink,
          }}
        />
      </div>
      {showTodoModal && (
        <CreateTodoModal
          preset={{
            source: "slack",
            title: `${msg.sender}: ${msg.message.slice(0, 80)}`,
            subtitle: msg.channel,
            url: msg.permalink,
          }}
          onClose={() => setShowTodoModal(false)}
        />
      )}
    </motion.div>
  );
}

// ── Channel Section (for Channels tab) ───────────────────────
function ChannelSection({
  section,
  onThreadClick,
  onRefresh,
}: {
  section: SlackSection;
  onThreadClick: (msg: SlackMessage) => void;
  onRefresh: () => void;
}) {
  const isMyThreads = section.section_type === "my_threads";
  const [expanded, setExpanded] = useState(isMyThreads || section.unread_count > 0);
  const { subscriptions, subscribe, unsubscribe } = useThreadSubscriptionStore();
  const subscribedIds = useMemo(() => new Set(subscriptions.map((s) => s.id)), [subscriptions]);
  const channelName = section.title;

  const sectionColor =
    section.section_type === "my_threads" ? styles.sectionMyThreads
    : section.section_type === "search" ? styles.sectionSearch
    : isAlertChannel(section.title) ? styles.sectionAlert
    : styles.sectionChannel;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <button
          className={`${styles.sectionHeader} ${sectionColor}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={styles.chevron}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className={styles.sectionTitle}>{channelName}</span>
          {section.unread_count > 0 && (
            <span className={styles.unreadBadge}>{section.unread_count}</span>
          )}
          <span className={styles.sectionBadge}>{section.messages.length}</span>
        </button>
        {section.unread_count > 0 && section.messages.length > 0 && (
          <button
            className={styles.markReadBtn}
            onClick={async (e) => {
              e.stopPropagation();
              const latest = section.messages.reduce((a, b) => a.raw_ts > b.raw_ts ? a : b);
              await markAsRead(latest.channel_id, latest.raw_ts);
              onRefresh();
            }}
            title="Mark all as read"
          >
            <CheckCircle2 size={12} />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className={styles.sectionMessages}
            variants={expandVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ overflow: "hidden" }}
          >
            {section.messages.length === 0 && (
              <div className={styles.emptySection}>No messages</div>
            )}
            {section.messages.map((msg, i) => {
              const subId = `${msg.channel_id}:${msg.raw_ts}`;
              const threadChannelName = isMyThreads ? msg.channel : channelName;
              return (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  index={i}
                  showChannel={isMyThreads}
                  isAlert={isAlertChannel(section.title) || isAlertMessage(msg)}
                  isSubscribed={subscribedIds.has(subId)}
                  onSubscribe={() =>
                    subscribe({
                      id: subId,
                      channelId: msg.channel_id,
                      channelName: threadChannelName,
                      threadTs: msg.raw_ts,
                      label: msg.message.slice(0, 60),
                      summary: msg.message.slice(0, 60),
                      sender: msg.sender,
                      lastKnownReplyTs: msg.latest_reply_ts,
                      latestReplyTs: msg.latest_reply_ts,
                    })
                  }
                  onUnsubscribe={() => unsubscribe(subId)}
                  onClick={() => onThreadClick(msg)}
                  onMarkRead={async () => {
                    await markAsRead(msg.channel_id, msg.raw_ts);
                    onRefresh();
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Parse Slack thread URL ───────────────────────────────────
function parseSlackUrl(url: string): { channelId: string; threadTs: string } | null {
  const match = url.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/);
  if (!match) return null;
  const channelId = match[1];
  const raw = match[2];
  const threadTs = raw.slice(0, 10) + "." + raw.slice(10);
  return { channelId, threadTs };
}

// ── Watch Thread URL input ───────────────────────────────────
function WatchThreadInput({ onWatch }: { onWatch: (channelId: string, threadTs: string) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const { subscribe } = useThreadSubscriptionStore();
  const { data: sections } = useSlackSections();

  const handleSubmit = async () => {
    setError("");
    const parsed = parseSlackUrl(url.trim());
    if (!parsed) { setError("Paste a Slack thread URL"); return; }
    try {
      const replies = await fetchThreadReplies(parsed.channelId, parsed.threadTs);
      if (replies.length === 0) { setError("Thread not found"); return; }
      const root = replies[0];
      const channelName = sections?.flatMap(s => s.messages)
        .find(m => m.channel_id === parsed.channelId)?.channel ?? `#${parsed.channelId}`;
      const subId = `${parsed.channelId}:${parsed.threadTs}`;
      subscribe({
        id: subId,
        channelId: parsed.channelId,
        channelName,
        threadTs: parsed.threadTs,
        label: root.message.slice(0, 60),
        summary: root.message.slice(0, 60),
        sender: root.sender,
        lastKnownReplyTs: replies.length > 1 ? replies[replies.length - 1].raw_ts : null,
        latestReplyTs: replies.length > 1 ? replies[replies.length - 1].raw_ts : null,
      });
      setUrl("");
      onWatch(parsed.channelId, parsed.threadTs);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className={styles.watchInput}>
      <input
        className={styles.watchUrlField}
        placeholder="Paste Slack thread URL to watch..."
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
      />
      <button className={styles.watchUrlBtn} onClick={handleSubmit}>Watch</button>
      {error && <span className={styles.watchUrlError}>{error}</span>}
    </div>
  );
}

// ── Unread Tab ───────────────────────────────────────────────
function UnreadTab({
  sections,
  onThreadClick,
  onRefresh,
}: {
  sections: SlackSection[];
  onThreadClick: (msg: SlackMessage) => void;
  onRefresh: () => void;
}) {
  const { subscriptions, subscribe, unsubscribe } = useThreadSubscriptionStore();
  const subscribedIds = useMemo(() => new Set(subscriptions.map((s) => s.id)), [subscriptions]);

  // Collect all unread messages across all sections
  const unreadMessages = useMemo(() => {
    const msgs: (SlackMessage & { _sectionTitle: string })[] = [];
    for (const section of sections) {
      for (const msg of section.messages) {
        if (msg.is_unread) {
          msgs.push({ ...msg, _sectionTitle: section.title });
        }
      }
    }
    // Newest first
    msgs.sort((a, b) => b.raw_ts.localeCompare(a.raw_ts));
    return msgs;
  }, [sections]);

  const handleMarkAllRead = useCallback(async () => {
    for (const section of sections) {
      if (section.unread_count > 0 && section.messages.length > 0) {
        const latest = section.messages.reduce((a, b) => a.raw_ts > b.raw_ts ? a : b);
        await markAsRead(latest.channel_id, latest.raw_ts);
      }
    }
    onRefresh();
  }, [sections, onRefresh]);

  if (unreadMessages.length === 0) {
    return (
      <div className={styles.caughtUp}>
        <Check size={24} className={styles.caughtUpIcon} />
        <span className={styles.caughtUpText}>All caught up</span>
        <span className={styles.caughtUpHint}>No unread messages</span>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabToolbar}>
        <span className={styles.tabCount}>{unreadMessages.length} unread</span>
        <button className={styles.markAllReadBtn} onClick={handleMarkAllRead}>
          <CheckCircle2 size={11} />
          <span>Mark all read</span>
        </button>
      </div>
      <div className={styles.messageList}>
        <AnimatePresence>
          {unreadMessages.map((msg, i) => {
            const subId = `${msg.channel_id}:${msg.raw_ts}`;
            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                index={i}
                showChannel
                isAlert={isAlertChannel(msg._sectionTitle) || isAlertMessage(msg)}
                isSubscribed={subscribedIds.has(subId)}
                onSubscribe={() =>
                  subscribe({
                    id: subId,
                    channelId: msg.channel_id,
                    channelName: msg.channel,
                    threadTs: msg.raw_ts,
                    label: msg.message.slice(0, 60),
                    summary: msg.message.slice(0, 60),
                    sender: msg.sender,
                    lastKnownReplyTs: msg.latest_reply_ts,
                    latestReplyTs: msg.latest_reply_ts,
                  })
                }
                onUnsubscribe={() => unsubscribe(subId)}
                onClick={() => onThreadClick(msg)}
                onMarkRead={async () => {
                  await markAsRead(msg.channel_id, msg.raw_ts);
                  onRefresh();
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Alerts Tab ───────────────────────────────────────────────
function AlertsTab({
  sections,
  onThreadClick,
  onRefresh,
}: {
  sections: SlackSection[];
  onThreadClick: (msg: SlackMessage) => void;
  onRefresh: () => void;
}) {
  const { subscriptions, subscribe, unsubscribe } = useThreadSubscriptionStore();
  const subscribedIds = useMemo(() => new Set(subscriptions.map((s) => s.id)), [subscriptions]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const allAlerts = useMemo(() => {
    const msgs: SlackMessage[] = [];
    for (const section of sections) {
      if (isAlertChannel(section.title)) {
        msgs.push(...section.messages);
      } else {
        for (const msg of section.messages) {
          if (isAlertMessage(msg)) {
            msgs.push(msg);
          }
        }
      }
    }
    msgs.sort((a, b) => b.raw_ts.localeCompare(a.raw_ts));
    return msgs;
  }, [sections]);

  const alertMessages = useMemo(() => allAlerts.filter((m) => !dismissedIds.has(m.id)), [allAlerts, dismissedIds]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const handleClearAll = () => {
    setDismissedIds(new Set(allAlerts.map((m) => m.id)));
  };

  if (alertMessages.length === 0) {
    return (
      <div className={styles.caughtUp}>
        <Check size={24} className={styles.caughtUpIcon} />
        <span className={styles.caughtUpText}>{dismissedIds.size > 0 ? "All cleared" : "No alerts"}</span>
        <span className={styles.caughtUpHint}>{dismissedIds.size > 0 ? `${dismissedIds.size} dismissed` : "All systems quiet"}</span>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabToolbar}>
        <span className={styles.tabCountAlert}>{alertMessages.length} alerts</span>
        <button className={styles.clearAllAlertsBtn} onClick={handleClearAll}>
          <X size={10} />
          <span>Clear all</span>
        </button>
      </div>
      <div className={styles.messageList}>
        <AnimatePresence>
          {alertMessages.map((msg, i) => {
            const subId = `${msg.channel_id}:${msg.raw_ts}`;
            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                index={i}
                showChannel
                isAlert
                isSubscribed={subscribedIds.has(subId)}
                onSubscribe={() =>
                  subscribe({
                    id: subId,
                    channelId: msg.channel_id,
                    channelName: msg.channel,
                    threadTs: msg.raw_ts,
                    label: msg.message.slice(0, 60),
                    summary: msg.message.slice(0, 60),
                    sender: msg.sender,
                    lastKnownReplyTs: msg.latest_reply_ts,
                    latestReplyTs: msg.latest_reply_ts,
                  })
              }
              onUnsubscribe={() => unsubscribe(subId)}
              onClick={() => onThreadClick(msg)}
              onMarkRead={msg.is_unread ? async () => {
                await markAsRead(msg.channel_id, msg.raw_ts);
                onRefresh();
              } : undefined}
              onDismiss={() => handleDismiss(msg.id)}
            />
          );
        })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Threads Tab ──────────────────────────────────────────────
function ThreadsTab({
  sections,
  onThreadClick,
}: {
  sections: SlackSection[];
  onThreadClick: (msg: SlackMessage) => void;
  onRefresh: () => void;
}) {
  const { subscriptions, subscribe, unsubscribe } = useThreadSubscriptionStore();
  const subscribedIds = useMemo(() => new Set(subscriptions.map((s) => s.id)), [subscriptions]);
  const watchedThreads = useWatchedThreads();

  const myThreadsSection = sections.find((s) => s.section_type === "my_threads");

  return (
    <div className={styles.tabContent}>
      <WatchThreadInput onWatch={(channelId, threadTs) => onThreadClick({ channel_id: channelId, raw_ts: threadTs } as SlackMessage)} />

      {/* Watched threads */}
      {watchedThreads.length > 0 && (
        <div className={styles.threadGroup}>
          <div className={styles.threadGroupHeader}>
            <Bell size={11} className={styles.threadGroupIcon} />
            <span className={styles.threadGroupLabel}>Watched</span>
            <span className={styles.threadGroupCount}>{watchedThreads.length}</span>
          </div>
          {watchedThreads.map((sub, i) => (
            <motion.div
              key={sub.id}
              className={`${styles.watchedThreadRow} ${sub.hasNew ? styles.watchedThreadNew : ""}`}
              custom={i}
              variants={threadRowVariants}
              initial="hidden"
              animate="visible"
            >
              <div
                className={styles.threadRowMain}
                onClick={() => onThreadClick({ channel_id: sub.channelId, raw_ts: sub.threadTs } as SlackMessage)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onThreadClick({ channel_id: sub.channelId, raw_ts: sub.threadTs } as SlackMessage); }}
              >
                <div className={styles.threadRowHeader}>
                  <span className={styles.sender}>{sub.sender}</span>
                  <span className={styles.threadChannel}>{sub.channelName}</span>
                  {sub.hasNew && <span className={styles.newReplyBadge}>new</span>}
                </div>
                <p className={styles.threadPreview}>{sub.summary || sub.label}</p>
              </div>
              <button
                className={`${styles.watchBtn} ${styles.watchBtnActive}`}
                onClick={(e) => { e.stopPropagation(); unsubscribe(sub.id); }}
                title="Unwatch"
              >
                <BellOff size={11} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* My threads */}
      {myThreadsSection && myThreadsSection.messages.length > 0 && (
        <div className={styles.threadGroup}>
          <div className={styles.threadGroupHeader}>
            <MessagesSquare size={11} className={styles.threadGroupIcon} />
            <span className={styles.threadGroupLabel}>My Threads</span>
            <span className={styles.threadGroupCount}>{myThreadsSection.messages.length}</span>
          </div>
          {myThreadsSection.messages.map((msg, i) => {
            const subId = `${msg.channel_id}:${msg.raw_ts}`;
            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                index={i}
                showChannel
                isSubscribed={subscribedIds.has(subId)}
                onSubscribe={() =>
                  subscribe({
                    id: subId,
                    channelId: msg.channel_id,
                    channelName: msg.channel,
                    threadTs: msg.raw_ts,
                    label: msg.message.slice(0, 60),
                    summary: msg.message.slice(0, 60),
                    sender: msg.sender,
                    lastKnownReplyTs: msg.latest_reply_ts,
                    latestReplyTs: msg.latest_reply_ts,
                  })
                }
                onUnsubscribe={() => unsubscribe(subId)}
                onClick={() => onThreadClick(msg)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DMs Tab ──────────────────────────────────────────────────
function DmsTab({
  onThreadClick,
}: {
  onThreadClick: (msg: SlackMessage) => void;
}) {
  const { data: dms, isLoading } = useDmConversations();
  const getByName = useSlackUserStore((s) => s.getByName);
  const upsertUser = useSlackUserStore((s) => s.upsertUser);

  const [composeInput, setComposeInput] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; channelId?: string } | null>(null);

  // Cache DM users into the store when they arrive
  useEffect(() => {
    if (!dms) return;
    for (const dm of dms) {
      upsertUser({ id: dm.user_id, name: dm.user_name, displayName: dm.user_name, dmChannelId: dm.channel_id });
    }
  }, [dms, upsertUser]);

  // Parse "@name message" or just show suggestions
  const handleInputChange = (value: string) => {
    setComposeInput(value);
    if (!selectedUser && value.startsWith("@")) {
      setShowSuggestions(true);
    }
  };

  const handleSelectUser = (user: { id: string; name: string; dmChannelId?: string }) => {
    setSelectedUser({ id: user.id, name: user.name, channelId: user.dmChannelId });
    setComposeInput("");
    setShowSuggestions(false);
  };

  const handleSend = async () => {
    if (!selectedUser || !composeInput.trim() || composeSending) return;
    setComposeSending(true);
    try {
      const channelId = selectedUser.channelId ?? selectedUser.id;
      await sendSlackMessage(channelId, composeInput.trim());
      setComposeInput("");
      setSelectedUser(null);
    } finally {
      setComposeSending(false);
    }
  };

  const suggestions = useMemo(() => {
    if (!showSuggestions) return [];
    const query = composeInput.startsWith("@") ? composeInput.slice(1) : composeInput;
    return getByName(query);
  }, [showSuggestions, composeInput, getByName]);

  return (
    <div className={styles.tabContent}>
      {/* Compose */}
      <div className={styles.dmCompose}>
        {selectedUser ? (
          <div className={styles.dmComposeRow}>
            <span className={styles.dmComposeTo}>
              To: <strong>{selectedUser.name}</strong>
              <button className={styles.dmComposeClear} onClick={() => setSelectedUser(null)}><X size={9} /></button>
            </span>
            <input
              className={styles.dmComposeInput}
              placeholder="Type a message..."
              value={composeInput}
              onChange={(e) => setComposeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={composeSending}
              autoFocus
            />
            <button className={styles.dmComposeSend} onClick={handleSend} disabled={!composeInput.trim() || composeSending}>
              <Send size={11} />
            </button>
          </div>
        ) : (
          <div className={styles.dmComposeRow}>
            <input
              className={styles.dmComposeInput}
              placeholder="@name to start a message..."
              value={composeInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => { if (composeInput.startsWith("@")) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
          </div>
        )}
        {/* Autocomplete suggestions */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              className={styles.dmSuggestions}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              {suggestions.map((user) => (
                <button
                  key={user.id}
                  className={styles.dmSuggestionItem}
                  onMouseDown={(e) => { e.preventDefault(); handleSelectUser(user); }}
                >
                  <span className={styles.dmSuggestionName}>{user.displayName}</span>
                  {user.name !== user.displayName && <span className={styles.dmSuggestionHandle}>@{user.name}</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DM list */}
      {isLoading && <div className={styles.caughtUp}><span className={styles.caughtUpHint}>Loading conversations...</span></div>}
      {dms && dms.length === 0 && !isLoading && (
        <div className={styles.caughtUp}>
          <Mail size={20} className={styles.caughtUpIcon} />
          <span className={styles.caughtUpText}>No recent DMs</span>
        </div>
      )}
      <div className={styles.messageList}>
        {dms?.map((dm, i) => (
          <motion.div
            key={dm.channel_id}
            className={`${styles.dmRow} ${dm.is_unread ? styles.dmRowUnread : ""}`}
            custom={i}
            variants={threadRowVariants}
            initial="hidden"
            animate="visible"
            onClick={() => {
              if (dm.last_message_ts) {
                onThreadClick({ channel_id: dm.channel_id, raw_ts: dm.last_message_ts } as SlackMessage);
              }
            }}
          >
            <div className={styles.dmInfo}>
              <span className={styles.dmName}>{dm.user_name}</span>
              {dm.last_message && (
                <span className={styles.dmPreview}>
                  {dm.last_message.slice(0, 80)}{dm.last_message.length > 80 ? "…" : ""}
                </span>
              )}
            </div>
            {dm.is_unread && <span className={styles.dmUnreadDot} />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Channels Tab ─────────────────────────────────────────────
function ChannelsTab({
  sections,
  onThreadClick,
  onRefresh,
}: {
  sections: SlackSection[];
  onThreadClick: (msg: SlackMessage) => void;
  onRefresh: () => void;
}) {
  // Filter out my_threads — that's in the Threads tab
  const channelSections = sections.filter((s) => s.section_type !== "my_threads");

  return (
    <div className={styles.tabContent}>
      {channelSections.map((section) => (
        <ChannelSection
          key={section.title}
          section={section}
          onThreadClick={onThreadClick}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

// ── Slack Panel ──────────────────────────────────────────────
export function SlackPanel() {
  const { data: sections, isLoading, isError, error, refetch } = useSlackSections();
  const [activeThread, setActiveThread] = useState<{ channelId: string; threadTs: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SlackTab>("unread");
  const pendingThread = useLayoutStore((s) => s.pendingThread);
  const clearPendingThread = useLayoutStore((s) => s.clearPendingThread);

  useEffect(() => {
    if (pendingThread) {
      setActiveThread({ channelId: pendingThread.channelId, threadTs: pendingThread.threadTs });
      clearPendingThread();
    }
  }, [pendingThread, clearPendingThread]);

  const totalUnread = useMemo(() => {
    if (!sections) return 0;
    return sections.reduce((sum, s) => sum + s.unread_count, 0);
  }, [sections]);

  const alertCount = useMemo(() => {
    if (!sections) return 0;
    let count = 0;
    for (const s of sections) {
      if (isAlertChannel(s.title)) { count += s.messages.length; }
      else {
        for (const msg of s.messages) { if (isAlertMessage(msg)) count++; }
      }
    }
    return count;
  }, [sections]);

  const handleThreadClick = useCallback((msg: SlackMessage) => {
    setActiveThread({ channelId: msg.channel_id, threadTs: msg.raw_ts });
  }, []);

  const TABS: { key: SlackTab; label: string; icon: typeof Inbox; badge?: number; accent: string }[] = [
    { key: "unread", label: "Unread", icon: Inbox, badge: totalUnread || undefined, accent: "green" },
    { key: "alerts", label: "Alerts", icon: AlertTriangle, badge: alertCount || undefined, accent: "orange" },
    { key: "channels", label: "Channels", icon: Hash, accent: "cyan" },
    { key: "threads", label: "Threads", icon: MessagesSquare, accent: "purple" },
    { key: "dms", label: "DMs", icon: Mail, accent: "magenta" },
  ];

  return (
    <Panel
      title="Slack"
      icon={MessageSquare}
      badge={totalUnread > 0 ? `${totalUnread} unread` : undefined}
      badgeVariant={totalUnread > 0 ? "green" : "default"}
      onRefresh={() => refetch()}
    >
      {isLoading && <RetroLoader type="slack" />}
      {isError && <ErrorState message={String(error)} onRetry={() => refetch()} />}

      <AnimatePresence mode="wait">
        {activeThread ? (
          <motion.div
            key="thread-detail"
            initial={{ opacity: 0, x: 30, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.35, ease: EASE_OUT } }}
            exit={{ opacity: 0, x: 30, filter: "blur(6px)", transition: { duration: 0.2 } }}
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <ThreadDetailView
              channelId={activeThread.channelId}
              threadTs={activeThread.threadTs}
              onBack={() => setActiveThread(null)}
            />
          </motion.div>
        ) : sections ? (
          <motion.div
            key="tabs-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className={styles.panelBody}
          >
            {/* Tab bar */}
            <div className={styles.tabBar}>
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""} ${styles[`tab_${tab.accent}`]}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <tab.icon size={12} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`${styles.tabBadge} ${styles[`tabBadge_${tab.accent}`]}`}>{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className={styles.tabBody}>
              {activeTab === "unread" && (
                <UnreadTab sections={sections} onThreadClick={handleThreadClick} onRefresh={() => refetch()} />
              )}
              {activeTab === "alerts" && (
                <AlertsTab sections={sections} onThreadClick={handleThreadClick} onRefresh={() => refetch()} />
              )}
              {activeTab === "channels" && (
                <ChannelsTab sections={sections} onThreadClick={handleThreadClick} onRefresh={() => refetch()} />
              )}
              {activeTab === "threads" && (
                <ThreadsTab sections={sections} onThreadClick={handleThreadClick} onRefresh={() => refetch()} />
              )}
              {activeTab === "dms" && (
                <DmsTab onThreadClick={handleThreadClick} />
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Panel>
  );
}
