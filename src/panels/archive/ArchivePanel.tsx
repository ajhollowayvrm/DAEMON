import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  Search,
  Undo2,
  Trash2,
  Link,
  CheckSquare,
  StickyNote,
  Clock,
  Bot,
  MessageSquare,
  GitMerge,
  LayoutList,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Panel } from "../../components/layout/Panel";
import { useFocusStore } from "../../stores/focusStore";
import type { FocusItem, FocusSource } from "../../stores/focusStore";
import { DEFAULT_PERSONAS } from "../../config/personas";
import styles from "./ArchivePanel.module.css";

const SOURCE_ICONS: Record<FocusSource, typeof MessageSquare> = {
  slack: MessageSquare,
  gitlab: GitMerge,
  linear: LayoutList,
  todos: CheckSquare,
};

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ArchivedCard({ item }: { item: FocusItem }) {
  const [expanded, setExpanded] = useState(false);
  const unarchiveItem = useFocusStore((s) => s.unarchiveItem);
  const deleteItem = useFocusStore((s) => s.deleteItem);

  const doneCount = item.tasks.filter((t) => t.done).length;
  const totalTasks = item.tasks.length;
  const latestDispatch = item.dispatches[0];
  const persona = latestDispatch ? DEFAULT_PERSONAS.find((p) => p.id === latestDispatch.personaId) : undefined;

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.cardChevron}>
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <div className={styles.cardTitleArea}>
          <span className={styles.cardTitle}>{item.title}</span>
          <div className={styles.cardMeta}>
            {item.archivedAt && <span className={styles.cardDate}>{relativeDate(item.archivedAt)}</span>}
            {item.links.length > 0 && (
              <span className={styles.cardLinkCount}>
                <Link size={9} /> {item.links.length}
              </span>
            )}
            {totalTasks > 0 && (
              <span className={styles.cardTaskMeta}>
                <CheckSquare size={9} /> {doneCount}/{totalTasks}
              </span>
            )}
            {persona && (
              <span className={styles.cardAgentMeta}>
                <Bot size={9} /> {persona.name}
              </span>
            )}
          </div>
        </div>
        <div className={styles.cardActions}>
          <button
            className={styles.cardActionBtn}
            onClick={(e) => { e.stopPropagation(); unarchiveItem(item.id); }}
            title="Restore to Focus"
          >
            <Undo2 size={11} />
          </button>
          <button
            className={`${styles.cardActionBtn} ${styles.deleteBtn}`}
            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
            title="Delete permanently"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className={styles.cardBody}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            {/* Links */}
            {item.links.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><Link size={9} /> Links</div>
                {item.links.map((link) => {
                  const Icon = SOURCE_ICONS[link.source] ?? Link;
                  return (
                    <div key={link.id} className={styles.linkRow}>
                      <Icon size={10} className={styles[`linkIcon_${link.source}`]} />
                      <span className={styles.linkLabel}>{link.label}</span>
                      {link.url && (
                        <button className={styles.linkOpen} onClick={() => window.open(link.url, "_blank")}>
                          <ExternalLink size={9} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tasks */}
            {item.tasks.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><CheckSquare size={9} /> Tasks</div>
                {item.tasks.map((task) => (
                  <div key={task.id} className={`${styles.taskRow} ${task.done ? styles.taskDone : ""}`}>
                    <span className={styles.taskCheck}>{task.done ? "✓" : "○"}</span>
                    <span className={styles.taskText}>{task.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            {item.notes.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><StickyNote size={9} /> Notes</div>
                {item.notes.map((note) => (
                  <div key={note.id} className={styles.noteRow}>{note.text}</div>
                ))}
              </div>
            )}

            {/* Reminders */}
            {item.reminders.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><Clock size={9} /> Reminders</div>
                {item.reminders.map((rem) => (
                  <div key={rem.id} className={styles.reminderRow}>
                    <span>{rem.text}</span>
                    <span className={styles.reminderDate}>{relativeDate(rem.dueAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ArchivePanel() {
  const allItems = useFocusStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.archived), [allItems]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      i.links.some((l) => l.label.toLowerCase().includes(q)) ||
      i.notes.some((n) => n.text.toLowerCase().includes(q))
    );
  }, [items, search]);

  // Sort newest archived first
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => (b.archivedAt ?? b.createdAt).localeCompare(a.archivedAt ?? a.createdAt)),
  [filtered]);

  return (
    <Panel
      title="Archive"
      icon={Archive}
      badge={items.length > 0 ? `${items.length} shipped` : undefined}
      badgeVariant="green"
    >
      <div className={styles.panel}>
        {/* Search */}
        <div className={styles.searchBar}>
          <Search size={12} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search archived items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        <div className={styles.list}>
          {sorted.length === 0 ? (
            <div className={styles.emptyState}>
              <Archive size={20} className={styles.emptyIcon} />
              <span>{search ? "No matches" : "Nothing archived yet"}</span>
              <span className={styles.emptyHint}>{search ? "Try a different search" : "Completed Focus Items appear here"}</span>
            </div>
          ) : (
            sorted.map((item) => (
              <ArchivedCard key={item.id} item={item} />
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}
