import { useState, useCallback, useMemo } from "react";
import { MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { Panel } from "../../components/layout/Panel";
import { GlowCard } from "../../components/ui/GlowCard";
import { RetroLoader } from "../../components/ui/RetroLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { useSlackSections } from "../../hooks";
import type { SlackSection, SlackMessage } from "../../types/models";
import styles from "./SlackPanel.module.css";

function MessageCard({
  msg,
  isUnread,
  onRead,
}: {
  msg: SlackMessage;
  isUnread: boolean;
  onRead: () => void;
}) {
  const handleClick = () => {
    onRead();
    if (msg.permalink) open(msg.permalink);
  };

  return (
    <GlowCard
      urgent={isUnread}
      className={isUnread ? styles.unreadCard : undefined}
      onClick={handleClick}
    >
      <div className={styles.messageItem}>
        <div className={styles.messageHeader}>
          <span className={styles.sender}>{msg.sender}</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {isUnread && <span className={styles.unreadDot} />}
            <span className={styles.timestamp}>{msg.timestamp}</span>
          </div>
        </div>
        <span className={styles.message}>{msg.message}</span>
      </div>
    </GlowCard>
  );
}

function SectionView({
  section,
  readIds,
  onRead,
}: {
  section: SlackSection;
  readIds: Set<string>;
  onRead: (id: string) => void;
}) {
  const unreadCount = section.messages.filter(
    (m) => m.is_unread && !readIds.has(m.id),
  ).length;

  const [expanded, setExpanded] = useState(unreadCount > 0);

  const sectionColor =
    section.section_type === "mentions"
      ? styles.sectionMentions
      : section.section_type === "search"
        ? styles.sectionSearch
        : styles.sectionChannel;

  return (
    <div className={styles.section}>
      <button
        className={`${styles.sectionHeader} ${sectionColor}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={styles.chevron}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className={styles.sectionTitle}>{section.title}</span>
        {unreadCount > 0 && (
          <span className={styles.unreadBadge}>{unreadCount}</span>
        )}
      </button>
      {expanded && (
        <div className={styles.sectionMessages}>
          {section.messages.length === 0 && (
            <div className={styles.emptySection}>No messages</div>
          )}
          {section.messages.map((msg) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              isUnread={msg.is_unread && !readIds.has(msg.id)}
              onRead={() => onRead(msg.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SlackPanel() {
  const { data: sections, isLoading, isError, error, refetch } = useSlackSections();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  }, []);

  const totalUnread = useMemo(() => {
    if (!sections) return 0;
    return sections.reduce(
      (sum, s) =>
        sum + s.messages.filter((m) => m.is_unread && !readIds.has(m.id)).length,
      0,
    );
  }, [sections, readIds]);


  return (
    <Panel
      title="Slack"
      icon={MessageSquare}
      badge={totalUnread > 0 ? `${totalUnread} unread` : undefined}
      badgeVariant={totalUnread > 0 ? "green" : "default"}
    >
      {isLoading && <RetroLoader text="Loading Slack..." />}
      {isError && <ErrorState message={String(error)} onRetry={() => refetch()} />}
      {sections?.map((section) => (
        <SectionView
          key={section.title}
          section={section}
          readIds={readIds}
          onRead={markRead}
        />
      ))}
    </Panel>
  );
}
