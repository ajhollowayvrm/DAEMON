import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import Markdown from "react-markdown";
import {
  LayoutDashboard,
  MessageSquare,
  GitMerge,
  LayoutList,
  CheckSquare,
  AlertTriangle,
  Filter,
  Pin,
  GripVertical,
  Bot,
  Target,
  Plus,
  ArrowLeft,
  Link,
  StickyNote,
  Clock,
  Check,
  X,
  ExternalLink,
  Trash2,
  Archive,
  CheckCircle,
  Loader,
  Copy,
  Activity,
} from "lucide-react";
import { Panel } from "../../components/layout/Panel";
import { useSlackSections } from "../../hooks/useSlackMentions";
import { useMergeRequests } from "../../hooks/useMergeRequests";
import { useLinearIssues } from "../../hooks/useLinearIssues";
import { useTodos } from "../../hooks/useTodos";
import { useLayoutStore } from "../../stores/layoutStore";
import type { PanelId } from "../../stores/layoutStore";
import { useFocusStore } from "../../stores/focusStore";
import type { FocusItem, FocusSource, FocusLink, FocusDispatch } from "../../stores/focusStore";
import { usePersonaStore } from "../../stores/personaStore";
import { useChatStore } from "../../stores/chatStore";
import { useDismissedUrgentStore } from "../../stores/dismissedUrgentStore";
import { DEFAULT_PERSONAS } from "../../config/personas";
import styles from "./HubPanel.module.css";

// ── Types ────────────────────────────────────────────────────
type FeedFilter = "all" | FocusSource;

interface FeedItem {
  id: string;
  source: FocusSource;
  title: string;
  subtitle?: string;
  urgent: boolean;
  priority: number;
  navigateTo: PanelId;
  timestamp?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourceBranch?: string;
  slackRef?: { channelId: string; threadTs: string };
}

// ── Constants ────────────────────────────────────────────────
const SOURCE_ICONS: Record<FocusSource, typeof MessageSquare> = {
  slack: MessageSquare,
  gitlab: GitMerge,
  linear: LayoutList,
  datadog: Activity,
  todos: CheckSquare,
};

const FILTER_TABS: { key: FeedFilter; label: string; accent: string }[] = [
  { key: "all", label: "All", accent: "white" },
  { key: "slack", label: "Slack", accent: "cyan" },
  { key: "gitlab", label: "GitLab", accent: "purple" },
  { key: "linear", label: "Linear", accent: "magenta" },
  { key: "todos", label: "To-Dos", accent: "green" },
];

const AGENT_SUGGESTIONS: { id: string; label: string }[] = [
  { id: "zexion", label: "Research" },
  { id: "geno", label: "Architect" },
  { id: "spike", label: "Code" },
  { id: "pikachu", label: "Quick Fix" },
  { id: "rei", label: "Review" },
  { id: "jet", label: "Debug" },
  { id: "sain", label: "Narrate" },
];

// ── Helpers ──────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function feedItemToLink(item: FeedItem): Omit<FocusLink, "id"> {
  return {
    source: item.source,
    label: item.title,
    subtitle: item.subtitle,
    url: item.sourceUrl,
    navigateTo: item.navigateTo,
    sourceId: item.sourceId,
    sourceBranch: item.sourceBranch,
    slackRef: item.slackRef,
  };
}

function buildAgentPrompt(item: FocusItem): string {
  const parts: string[] = [`Focus Item: "${item.title}"`];
  for (const link of item.links) {
    const icon = link.source === "gitlab" ? "MR" : link.source === "linear" ? "Ticket" : link.source === "slack" ? "Thread" : "Link";
    parts.push(`${icon}: ${link.label}${link.sourceId ? ` (${link.sourceId})` : ""}${link.url ? ` — ${link.url}` : ""}`);
  }
  if (item.tasks.length > 0) {
    parts.push("", "Tasks:");
    for (const t of item.tasks) {
      parts.push(`  ${t.done ? "✅" : "○"} ${t.title}`);
    }
  }
  if (item.notes.length > 0) {
    parts.push("", "Notes:");
    for (const n of item.notes) {
      parts.push(`  - ${n.text}`);
    }
  }

  // Include previous agent outputs so follow-up agents have full context
  if (item.dispatches.length > 0) {
    const personaStore = usePersonaStore.getState();
    const prevOutputs: string[] = [];
    for (const d of item.dispatches) {
      const persona = DEFAULT_PERSONAS.find((p) => p.id === d.personaId);
      const bgRun = personaStore.backgroundRuns.find((r) => r.id === d.taskId);
      const histRun = personaStore.singleRunHistory.find((r) => r.id === d.taskId);
      const output = bgRun?.output ?? histRun?.output ?? "";
      if (output.trim()) {
        prevOutputs.push(`--- Previous output from ${persona?.name ?? d.personaId} (${persona?.role ?? "Agent"}) ---\n${output.slice(0, 3000)}${output.length > 3000 ? "\n[...truncated]" : ""}`);
      }
    }
    if (prevOutputs.length > 0) {
      parts.push("", "## Previous Agent Work on This Focus Item", ...prevOutputs);
    }
  }

  return parts.join("\n");
}

// ── Agent run status hook ────────────────────────────────────
function useAgentRunStatus(taskId: string | undefined): "running" | "completed" | "failed" | null {
  const bgRun = usePersonaStore((s) => taskId ? s.backgroundRuns.find((r) => r.id === taskId) : undefined);
  const histRun = usePersonaStore((s) => taskId ? s.singleRunHistory.find((r) => r.id === taskId) : undefined);
  if (bgRun) return bgRun.status as "running" | "completed" | "failed";
  if (histRun) return histRun.status as "running" | "completed" | "failed";
  return taskId ? null : null;
}

// ── Stat Strip ───────────────────────────────────────────────
function StatStrip({
  stats,
  activeFilter,
}: {
  stats: { icon: typeof MessageSquare; value: number | string; accent: string; alert?: number; onClick: () => void }[];
  activeFilter?: string;
}) {
  const filterKeys = ["slack", "gitlab", "linear", "todos"];
  return (
    <div className={styles.statStrip}>
      {stats.map((s, i) => {
        const isActive = activeFilter === filterKeys[i];
        return (
          <button key={i} className={`${styles.statChip} ${styles[`chip_${s.accent}`]} ${isActive ? styles.chipActive : ""}`} onClick={s.onClick}>
            <s.icon size={11} />
            <span className={styles.chipValue}>{s.value}</span>
            {s.alert !== undefined && s.alert > 0 && (
              <span className={styles.chipAlert}><AlertTriangle size={8} />{s.alert}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Focus Card (collapsed, in left column) ───────────────────
function FocusCard({ item, isDragActive, isDropTarget }: { item: FocusItem; isDragActive: boolean; isDropTarget: boolean }) {
  const openItem = useFocusStore((s) => s.openItem);
  const doneCount = item.tasks.filter((t) => t.done).length;
  const totalTasks = item.tasks.length;
  const latestDispatch = item.dispatches[0];
  const persona = latestDispatch ? DEFAULT_PERSONAS.find((p) => p.id === latestDispatch.personaId) : undefined;
  const runStatus = useAgentRunStatus(latestDispatch?.taskId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.focusCard} ${isDropTarget ? styles.focusCardDropTarget : ""}`}
      onClick={() => !isDragActive && openItem(item.id)}
    >
      <div className={styles.cardDragHandle} {...attributes} {...listeners}>
        <GripVertical size={9} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{item.title}</span>
          {isDropTarget && (
            <span className={styles.cardDropHint}>
              <Link size={9} />
              attach
            </span>
          )}
          {!isDropTarget && totalTasks > 0 && (
            <span className={styles.cardTaskCount}>{doneCount}/{totalTasks}</span>
          )}
        </div>
        {/* Link icons */}
        {item.links.length > 0 && (
          <div className={styles.cardLinks}>
            {item.links.map((link) => {
              const Icon = SOURCE_ICONS[link.source] ?? Link;
              return <Icon key={link.id} size={10} className={styles[`cardLinkIcon_${link.source}`]} />;
            })}
            {item.notes.length > 0 && <StickyNote size={10} className={styles.cardNoteIcon} />}
            {item.reminders.filter((r) => !r.fired).length > 0 && <Clock size={10} className={styles.cardReminderIcon} />}
          </div>
        )}
        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className={styles.cardProgress}>
            <div className={styles.cardProgressFill} style={{ width: `${(doneCount / totalTasks) * 100}%` }} />
          </div>
        )}
        {/* Agent badge */}
        {persona && (
          <div className={`${styles.cardAgent} ${runStatus === "running" ? styles.cardAgentRunning : runStatus === "completed" ? styles.cardAgentDone : ""}`}>
            {runStatus === "running" ? <Loader size={8} className={styles.spinIcon} /> : <Bot size={8} />}
            <span>{persona.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent Dispatch Row (in detail view history) ──────────────
function AgentDispatchRow({ dispatch }: { dispatch: FocusDispatch }) {
  const persona = DEFAULT_PERSONAS.find((p) => p.id === dispatch.personaId);
  const runStatus = useAgentRunStatus(dispatch.taskId);
  const bgRun = usePersonaStore((s) => s.backgroundRuns.find((r) => r.id === dispatch.taskId));
  const histRun = usePersonaStore((s) => s.singleRunHistory.find((r) => r.id === dispatch.taskId));
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const conversations = useChatStore((s) => s.conversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const [expanded, setExpanded] = useState(false);

  if (!persona) return null;

  const output = bgRun?.output ?? histRun?.output ?? "";
  const hasOutput = output.length > 0;
  const hasConversation = !!conversations[dispatch.taskId];
  const statusLabel = runStatus === "running" ? "Running..." : runStatus === "completed" ? "Done" : runStatus === "failed" ? "Failed" : "Dispatched";

  const handleContinueChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConversation(dispatch.taskId);
    setActivePanel("agents");
  };

  return (
    <div className={styles.dispatchRow}>
      <div className={styles.dispatchHeader} onClick={() => hasOutput && setExpanded(!expanded)}>
        {persona.avatar ? (
          <img src={persona.avatar} alt={persona.name} className={styles.dispatchAvatar} />
        ) : (
          <Bot size={11} />
        )}
        <span className={styles.dispatchName} style={{ color: persona.color }}>{persona.name}</span>
        <span className={styles.dispatchRole}>{persona.role}</span>
        <span className={`${styles.dispatchStatus} ${runStatus === "running" ? styles.dispatchRunning : runStatus === "completed" ? styles.dispatchDone : runStatus === "failed" ? styles.dispatchFailed : ""}`}>
          {runStatus === "running" && <Loader size={8} className={styles.spinIcon} />}
          {statusLabel}
        </span>
        {hasConversation && (
          <button className={styles.dispatchChatBtn} onClick={handleContinueChat} title="Continue conversation">
            <MessageSquare size={9} />
          </button>
        )}
        <span className={styles.dispatchTime}>{relativeTime(dispatch.dispatchedAt)}</span>
      </div>
      <AnimatePresence>
        {expanded && hasOutput && (
          <motion.div
            className={styles.dispatchOutput}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <Markdown>{output}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Focus Detail View (right column) ─────────────────────────
function FocusDetailView({ item }: { item: FocusItem }) {
  const closeItem = useFocusStore((s) => s.closeItem);
  const renameItem = useFocusStore((s) => s.renameItem);
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const openSlackThread = useLayoutStore((s) => s.openSlackThread);
  const openMR = useLayoutStore((s) => s.openMR);
  const openLinearTicket = useLayoutStore((s) => s.openLinearTicket);
  const removeLink = useFocusStore((s) => s.removeLink);
  const addLinkToItem = useFocusStore((s) => s.addLink);
  const addTask = useFocusStore((s) => s.addTask);
  const toggleTask = useFocusStore((s) => s.toggleTask);
  const removeTask = useFocusStore((s) => s.removeTask);
  const addNote = useFocusStore((s) => s.addNote);
  const removeNote = useFocusStore((s) => s.removeNote);
  const addReminder = useFocusStore((s) => s.addReminder);
  const removeReminder = useFocusStore((s) => s.removeReminder);
  const archiveItem = useFocusStore((s) => s.archiveItem);
  const deleteItem = useFocusStore((s) => s.deleteItem);
  const addDispatch = useFocusStore((s) => s.addDispatch);
  const launchAgent = usePersonaStore((s) => s.launchAgent);

  const [newLink, setNewLink] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newReminder, setNewReminder] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [showAgents, setShowAgents] = useState(false);

  const doneCount = item.tasks.filter((t) => t.done).length;
  const latestDispatch = item.dispatches[0];
  const latestPersona = latestDispatch ? DEFAULT_PERSONAS.find((p) => p.id === latestDispatch.personaId) : undefined;
  const latestRunStatus = useAgentRunStatus(latestDispatch?.taskId);

  const handleDispatch = (personaId: string) => {
    const prompt = buildAgentPrompt(item);
    const taskId = launchAgent(personaId, prompt);
    if (taskId) addDispatch(item.id, personaId, taskId);
    setShowAgents(false);
  };

  return (
    <div className={styles.detailView}>
      {/* Toolbar */}
      <div className={styles.detailToolbar}>
        <button className={styles.detailBackBtn} onClick={closeItem}>
          <ArrowLeft size={12} />
          <span>Focus</span>
        </button>
        <div className={styles.detailActions}>
          {/* Agent dispatch */}
          <div className={styles.agentMenu}>
            {latestDispatch && latestPersona ? (
              <button
                className={`${styles.detailAgentBadge} ${latestRunStatus === "running" ? styles.agentRunning : latestRunStatus === "completed" ? styles.agentDone : latestRunStatus === "failed" ? styles.agentFailed : ""}`}
                onClick={() => setShowAgents(!showAgents)}
                title="Dispatch another agent"
              >
                {latestRunStatus === "running" ? <Loader size={9} className={styles.spinIcon} /> : latestRunStatus === "completed" ? <CheckCircle size={9} /> : <Bot size={9} />}
                <span>{latestPersona.name}</span>
              </button>
            ) : (
              <button className={styles.dispatchBtn} onClick={() => setShowAgents(!showAgents)} title="Dispatch agent">
                <Bot size={12} />
                <span>Agent</span>
              </button>
            )}
            <AnimatePresence>
              {showAgents && (
                <motion.div
                  className={styles.agentDropdown}
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.12 }}
                >
                  {AGENT_SUGGESTIONS.map((agent) => {
                    const p = DEFAULT_PERSONAS.find((pp) => pp.id === agent.id);
                    return (
                      <button key={agent.id} className={styles.agentOption} onClick={() => handleDispatch(agent.id)}>
                        {p?.avatar ? <img src={p.avatar} alt={p.name} className={styles.agentAvatar} /> : <Bot size={10} />}
                        <span className={styles.agentName}>{p?.name ?? agent.id}</span>
                        <span className={styles.agentRole}>{agent.label}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className={styles.detailActionBtn} onClick={() => archiveItem(item.id)} title="Archive">
            <Archive size={12} />
          </button>
          <button className={styles.detailActionBtn} onClick={() => { deleteItem(item.id); }} title="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className={styles.detailBody}>
        {/* Title */}
        <div className={styles.detailTitleSection}>
          {editingTitle ? (
            <div className={styles.titleEditRow}>
              <input
                className={styles.titleInput}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { renameItem(item.id, titleDraft.trim() || item.title); setEditingTitle(false); }
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                autoFocus
              />
              <button className={styles.titleSaveBtn} onClick={() => { renameItem(item.id, titleDraft.trim() || item.title); setEditingTitle(false); }}>
                <Check size={12} />
              </button>
            </div>
          ) : (
            <h2 className={styles.detailTitle} onClick={() => { setTitleDraft(item.title); setEditingTitle(true); }}>
              {item.title}
            </h2>
          )}
        </div>

        {/* Links */}
        <div className={styles.detailSection}>
          <div className={styles.detailSectionHeader}>
            <Link size={11} />
            <span>Links</span>
            <span className={styles.detailSectionCount}>{item.links.length}</span>
          </div>
          {item.links.map((link) => {
            const Icon = SOURCE_ICONS[link.source] ?? Link;
            return (
              <div
                key={link.id}
                className={styles.linkRow}
                onClick={() => {
                  if (link.source === "gitlab" && link.sourceId) {
                    openMR({ projectId: 0, iid: Number(link.sourceId) });
                  } else if (link.source === "slack" && link.slackRef) {
                    openSlackThread(link.slackRef);
                  } else if (link.source === "linear" && link.sourceId) {
                    openLinearTicket(link.sourceId);
                  } else if (link.navigateTo) {
                    setActivePanel(link.navigateTo);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
              >
                <Icon size={11} className={styles[`linkIcon_${link.source}`]} />
                <div className={styles.linkContent}>
                  <span className={styles.linkLabel}>{link.label}</span>
                  {link.subtitle && <span className={styles.linkSub}>{link.subtitle}</span>}
                </div>
                {link.url && (
                  <button className={styles.linkAction} onClick={(e) => { e.stopPropagation(); window.open(link.url, "_blank"); }} title="Open in browser"><ExternalLink size={10} /></button>
                )}
                {link.sourceBranch && (
                  <button className={styles.linkAction} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(link.sourceBranch!); }} title="Copy branch"><Copy size={10} /></button>
                )}
                <button className={styles.linkAction} onClick={(e) => { e.stopPropagation(); removeLink(item.id, link.id); }} title="Remove"><X size={10} /></button>
              </div>
            );
          })}
          <div className={styles.inlineAdd}>
            <input
              className={styles.inlineInput}
              placeholder="Add link: COM-123, !4521, or URL..."
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLink.trim()) {
                  const val = newLink.trim();
                  // Linear ticket: TEAM-123
                  const ticketMatch = val.match(/^([A-Z]{2,6}-\d{1,6})$/);
                  if (ticketMatch) {
                    addLinkToItem(item.id, { source: "linear", label: ticketMatch[1], navigateTo: "linear", sourceId: ticketMatch[1] });
                    setNewLink("");
                    return;
                  }
                  // GitLab MR: !1234
                  const mrMatch = val.match(/^!(\d+)$/);
                  if (mrMatch) {
                    addLinkToItem(item.id, { source: "gitlab", label: `MR !${mrMatch[1]}`, navigateTo: "gitlab", sourceId: mrMatch[1] });
                    setNewLink("");
                    return;
                  }
                  // URL
                  if (val.startsWith("http")) {
                    const isLinear = val.includes("linear.app");
                    const isGitlab = val.includes("gitlab.com");
                    const isSlack = val.includes("slack.com");
                    const source = isLinear ? "linear" : isGitlab ? "gitlab" : isSlack ? "slack" : "todos";
                    addLinkToItem(item.id, { source, label: val.slice(0, 60), url: val, navigateTo: source === "todos" ? "hub" : source as any });
                    setNewLink("");
                    return;
                  }
                  // Fallback: treat as a label
                  addLinkToItem(item.id, { source: "todos", label: val, navigateTo: "hub" });
                  setNewLink("");
                }
              }}
            />
          </div>
        </div>

        {/* Tasks */}
        <div className={styles.detailSection}>
          <div className={styles.detailSectionHeader}>
            <CheckSquare size={11} />
            <span>Tasks</span>
            {item.tasks.length > 0 && <span className={styles.detailSectionCount}>{doneCount}/{item.tasks.length}</span>}
          </div>
          {item.tasks.map((task) => (
            <div key={task.id} className={`${styles.taskRow} ${task.done ? styles.taskDone : ""}`}>
              <button className={`${styles.taskCheck} ${task.done ? styles.taskChecked : ""}`} onClick={() => toggleTask(item.id, task.id)}>
                {task.done ? <Check size={10} /> : null}
              </button>
              <span className={`${styles.taskLabel} ${task.done ? styles.taskLabelDone : ""}`}>{task.title}</span>
              <button className={styles.taskRemove} onClick={() => removeTask(item.id, task.id)}><X size={9} /></button>
            </div>
          ))}
          <div className={styles.inlineAdd}>
            <input
              className={styles.inlineInput}
              placeholder="Add a task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) { addTask(item.id, newTask.trim()); setNewTask(""); } }}
            />
            {newTask.trim() && (
              <button className={styles.inlineBtn} onClick={() => { addTask(item.id, newTask.trim()); setNewTask(""); }}>
                <Plus size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className={styles.detailSection}>
          <div className={styles.detailSectionHeader}>
            <StickyNote size={11} />
            <span>Notes</span>
            <span className={styles.detailSectionCount}>{item.notes.length}</span>
          </div>
          {item.notes.map((note) => (
            <div key={note.id} className={styles.noteRow}>
              <span className={styles.noteText}>{note.text}</span>
              <button className={styles.noteRemove} onClick={() => removeNote(item.id, note.id)}><X size={9} /></button>
            </div>
          ))}
          <div className={styles.inlineAdd}>
            <input
              className={styles.inlineInput}
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newNote.trim()) { addNote(item.id, newNote.trim()); setNewNote(""); } }}
            />
            {newNote.trim() && (
              <button className={styles.inlineBtn} onClick={() => { addNote(item.id, newNote.trim()); setNewNote(""); }}>
                <Plus size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Reminders */}
        <div className={styles.detailSection}>
          <div className={styles.detailSectionHeader}>
            <Clock size={11} />
            <span>Reminders</span>
            <span className={styles.detailSectionCount}>{item.reminders.filter((r) => !r.fired).length}</span>
          </div>
          {item.reminders.map((rem) => (
            <div key={rem.id} className={`${styles.reminderRow} ${rem.fired ? styles.reminderFired : ""}`}>
              <Clock size={10} className={styles.reminderIcon} />
              <span className={styles.reminderText}>{rem.text}</span>
              <span className={styles.reminderDue}>{relativeTime(rem.dueAt)}</span>
              <button className={styles.reminderRemove} onClick={() => removeReminder(item.id, rem.id)}><X size={9} /></button>
            </div>
          ))}
          <div className={styles.inlineAdd}>
            <input
              className={styles.inlineInput}
              placeholder="Remind me to..."
              value={newReminder}
              onChange={(e) => setNewReminder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newReminder.trim() && reminderDate) {
                  addReminder(item.id, newReminder.trim(), new Date(reminderDate).toISOString());
                  setNewReminder("");
                  setReminderDate("");
                }
              }}
            />
            <input
              type="datetime-local"
              className={styles.dateInput}
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
            />
            {newReminder.trim() && reminderDate && (
              <button className={styles.inlineBtn} onClick={() => {
                addReminder(item.id, newReminder.trim(), new Date(reminderDate).toISOString());
                setNewReminder("");
                setReminderDate("");
              }}>
                <Plus size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Agent History */}
        {item.dispatches.length > 0 && (
          <div className={styles.detailSection}>
            <div className={styles.detailSectionHeader}>
              <Bot size={11} />
              <span>Agent History</span>
              <span className={styles.detailSectionCount}>{item.dispatches.length}</span>
            </div>
            {item.dispatches.map((d) => (
              <AgentDispatchRow key={d.id} dispatch={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable Feed Row ───────────────────────────────────────
function DraggableFeedRow({
  item,
  isLinked,
  onNavigate,
  onPin,
  onDismissUrgent,
}: {
  item: FeedItem;
  isLinked: boolean;
  onNavigate: (id: PanelId) => void;
  onPin: (item: FeedItem) => void;
  onDismissUrgent?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `feed-${item.id}`,
    data: { type: "feed", item },
  });
  const Icon = SOURCE_ICONS[item.source];

  return (
    <div
      ref={setNodeRef}
      className={`${styles.feedRow} ${item.urgent ? styles.feedRowUrgent : ""} ${isLinked ? styles.feedRowLinked : ""} ${isDragging ? styles.feedRowDragging : ""}`}
    >
      <div className={styles.feedDragArea} {...attributes} {...listeners}>
        <Icon size={12} className={`${styles.feedIcon} ${styles[`feedIcon_${item.source}`]}`} />
        <div className={styles.feedContent} onClick={() => !isDragging && onNavigate(item.navigateTo)}>
          <span className={styles.feedTitle}>{item.title}</span>
          <div className={styles.feedMetaRow}>
            {item.subtitle && <span className={styles.feedSub}>{item.subtitle}</span>}
            {item.timestamp && <span className={styles.feedTime}>{relativeTime(item.timestamp)}</span>}
          </div>
        </div>
      </div>
      <div className={styles.feedActions}>
        {item.urgent && onDismissUrgent && (
          <button
            className={styles.feedDismissUrgent}
            onClick={(e) => { e.stopPropagation(); onDismissUrgent(item.id); }}
            title="Not critical"
          >
            <X size={9} />
          </button>
        )}
        {isLinked ? (
          <Pin size={10} className={styles.feedLinkedIcon} />
        ) : (
          <button className={styles.feedPinBtn} onClick={(e) => { e.stopPropagation(); onPin(item); }} title="Create Focus Item">
            <Target size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Drag overlay ghost ───────────────────────────────────────
function FeedDragOverlay({ item }: { item: FeedItem }) {
  const Icon = SOURCE_ICONS[item.source];
  return (
    <div className={styles.dragOverlay}>
      <Icon size={12} className={`${styles.feedIcon} ${styles[`feedIcon_${item.source}`]}`} />
      <div className={styles.feedContent}>
        <span className={styles.feedTitle}>{item.title}</span>
        {item.subtitle && <span className={styles.feedSub}>{item.subtitle}</span>}
      </div>
      <Target size={10} className={styles.dragOverlayPin} />
    </div>
  );
}

// ── Focus Drop Zone (wraps left column cards) ────────────────
function FocusDropZone({ children, isOver }: { children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: "focus-drop-zone" });
  return (
    <div ref={setNodeRef} className={`${styles.focusCards} ${isOver ? styles.focusCardsDropTarget : ""}`}>
      {children}
    </div>
  );
}

// ── Hub Panel ────────────────────────────────────────────────
export function HubPanel() {
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const nav = (id: PanelId) => setActivePanel(id);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [activeDrag, setActiveDrag] = useState<FeedItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");

  // Focus store
  const focusItems = useFocusStore((s) => s.items);
  const activeItemId = useFocusStore((s) => s.activeItemId);
  const allFocusItems = useFocusStore((s) => s.items);
  const dismissUrgent = useDismissedUrgentStore((s) => s.dismiss);
  const isUrgentDismissed = useDismissedUrgentStore((s) => s.isDismissed);
  const createItem = useFocusStore((s) => s.createItem);
  const pinFromFeed = useFocusStore((s) => s.pinFromFeed);
  const addLink = useFocusStore((s) => s.addLink);
  const reorderItems = useFocusStore((s) => s.reorderItems);
  const isLinked = useFocusStore((s) => s.isLinked);
  const getItem = useFocusStore((s) => s.getItem);

  const activeItem = activeItemId ? getItem(activeItemId) : undefined;
  const visibleItems = useMemo(() => allFocusItems.filter((i) => !i.archived), [allFocusItems]);


  // Data hooks
  const { data: slackSections, refetch: refetchSlack } = useSlackSections();
  const { data: mergeRequests, refetch: refetchMRs } = useMergeRequests();
  const { data: linearIssues, refetch: refetchLinear } = useLinearIssues();
  const { todos, criticalCount } = useTodos();

  // ── Metrics ──
  const totalUnread = useMemo(() => {
    if (!slackSections) return 0;
    return slackSections.reduce((sum, s) => sum + s.unread_count, 0);
  }, [slackSections]);

  const urgentSlackCount = useMemo(() => {
    if (!slackSections) return 0;
    let c = 0;
    for (const s of slackSections) { for (const m of s.messages) { if (m.is_unread) c++; } }
    return c;
  }, [slackSections]);

  const approvalCount = useMemo(() => {
    if (!mergeRequests) return 0;
    return mergeRequests.filter((mr) => mr.needs_your_approval).length;
  }, [mergeRequests]);

  const myIssueCount = useMemo(() => {
    if (!linearIssues) return 0;
    return linearIssues.filter((i) => i.assignee_is_me).length;
  }, [linearIssues]);

  // ── Build unified feed ──
  const feedItems: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];

    if (slackSections) {
      for (const s of slackSections) {
        for (const m of s.messages) {
          if (m.is_unread) {
            items.push({
              id: `slack-${m.id}`,
              source: "slack",
              title: `${m.sender}: ${m.message.slice(0, 60)}${m.message.length > 60 ? "…" : ""}`,
              subtitle: m.channel,
              urgent: true,
              priority: 0,
              navigateTo: "slack",
              timestamp: m.timestamp,
              sourceUrl: m.permalink,
              slackRef: { channelId: m.channel_id, threadTs: m.raw_ts },
            });
          }
        }
      }
    }

    if (mergeRequests) {
      for (const mr of mergeRequests.slice(0, 15)) {
        items.push({
          id: `gitlab-${mr.iid}`,
          source: "gitlab",
          title: mr.title,
          subtitle: `!${mr.iid} · ${mr.author}`,
          urgent: mr.needs_your_approval,
          priority: mr.needs_your_approval ? 1 : 3,
          navigateTo: "gitlab",
          timestamp: mr.updated_at,
          sourceId: String(mr.iid),
          sourceUrl: mr.web_url,
          sourceBranch: mr.source_branch,
        });
      }
    }

    if (linearIssues) {
      for (const i of linearIssues.filter((i) => i.assignee_is_me).slice(0, 15)) {
        items.push({
          id: `linear-${i.identifier}`,
          source: "linear",
          title: i.title,
          subtitle: `${i.identifier} · ${i.status}`,
          urgent: false,
          priority: 2,
          navigateTo: "linear",
          timestamp: i.updated_at,
          sourceId: i.identifier,
          sourceUrl: i.url,
        });
      }
    }

    for (const t of todos.slice(0, 10)) {
      items.push({
        id: `todo-${t.id}`,
        source: "todos",
        title: t.title,
        subtitle: t.subtitle,
        urgent: t.priority === "high",
        priority: t.priority === "high" ? 0 : t.priority === "medium" ? 2 : 4,
        navigateTo: "todos",
        timestamp: t.updatedAt,
        sourceUrl: t.url,
      });
    }

    // Apply urgent dismissals
    for (const item of items) {
      if (item.urgent && isUrgentDismissed(item.id)) {
        item.urgent = false;
        item.priority = Math.max(item.priority, 3); // demote
      }
    }

    items.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1));
    return items;
  }, [slackSections, mergeRequests, linearIssues, todos, isUrgentDismissed]);

  const filteredFeed = useMemo(() => {
    let items = feedFilter === "all" ? feedItems : feedItems.filter((i) => i.source === feedFilter);
    if (urgentOnly) items = items.filter((i) => i.urgent);
    return items;
  }, [feedItems, feedFilter, urgentOnly]);
  const filterCounts: Record<FeedFilter, number> = useMemo(() => ({
    all: feedItems.length,
    slack: feedItems.filter((i) => i.source === "slack").length,
    gitlab: feedItems.filter((i) => i.source === "gitlab").length,
    linear: feedItems.filter((i) => i.source === "linear").length,
    datadog: feedItems.filter((i) => i.source === "datadog").length,
    todos: feedItems.filter((i) => i.source === "todos").length,
  }), [feedItems]);

  // ── Handlers ──
  const handlePinFromFeed = useCallback((item: FeedItem) => {
    pinFromFeed(feedItemToLink(item), item.title);
  }, [pinFromFeed]);

  // ── Drag & Drop ──
  const [isOverFocus, setIsOverFocus] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const focusItemIds = useMemo(() => visibleItems.map((i) => i.id), [visibleItems]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "feed") setActiveDrag(data.item as FeedItem);
  }, []);

  const handleDragOver = useCallback((event: { over: { id: string | number } | null }) => {
    const overId = String(event.over?.id ?? "");
    setIsOverFocus(overId === "focus-drop-zone" || focusItemIds.includes(overId));
    setHoveredCardId(focusItemIds.includes(overId) ? overId : null);
  }, [focusItemIds]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDrag(null);
    setIsOverFocus(false);
    setHoveredCardId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    if (activeData?.type === "feed") {
      const item = activeData.item as FeedItem;
      const overId = String(over.id);
      // Dropped on a specific focus item → add as link to that item
      if (focusItemIds.includes(overId)) {
        addLink(overId, feedItemToLink(item));
      } else if (overId === "focus-drop-zone") {
        // Dropped on empty zone → create new focus item
        handlePinFromFeed(item);
      }
      return;
    }

    // Sortable reorder
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId !== overId && focusItemIds.includes(activeId) && focusItemIds.includes(overId)) {
      const oldIndex = focusItems.findIndex((i) => i.id === activeId);
      const newIndex = focusItems.findIndex((i) => i.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderItems(arrayMove(focusItems, oldIndex, newIndex));
      }
    }
  }, [focusItems, focusItemIds, handlePinFromFeed, addLink, reorderItems]);

  const handleDragCancel = useCallback(() => { setActiveDrag(null); setIsOverFocus(false); setHoveredCardId(null); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleCreate = () => {
    if (createTitle.trim()) {
      createItem(createTitle.trim());
      setCreateTitle("");
      setShowCreate(false);
    }
  };

  return (
    <Panel
      title="Hub"
      icon={LayoutDashboard}
      badge={criticalCount > 0 ? `${criticalCount} critical` : undefined}
      badgeVariant={criticalCount > 0 ? "default" : "green"}
      onBadgeClick={() => { setUrgentOnly(!urgentOnly); setFeedFilter("all"); }}
      onRefresh={() => { refetchSlack(); refetchMRs(); refetchLinear(); }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={activeDrag ? pointerWithin : closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={styles.hub}>
          {/* ── Left column: Focus Cards ── */}
          <div className={styles.leftCol}>
            <StatStrip
              stats={[
                { icon: MessageSquare, value: totalUnread, accent: "cyan", alert: urgentSlackCount, onClick: () => setFeedFilter(feedFilter === "slack" ? "all" : "slack") },
                { icon: GitMerge, value: mergeRequests?.length ?? "—", accent: "purple", alert: approvalCount, onClick: () => setFeedFilter(feedFilter === "gitlab" ? "all" : "gitlab") },
                { icon: LayoutList, value: myIssueCount, accent: "magenta", onClick: () => setFeedFilter(feedFilter === "linear" ? "all" : "linear") },
                { icon: CheckSquare, value: todos.length, accent: "green", alert: criticalCount, onClick: () => setFeedFilter(feedFilter === "todos" ? "all" : "todos") },
              ]}
              activeFilter={feedFilter}
            />

            {/* Create new */}
            {showCreate ? (
              <div className={styles.createCard}>
                <input
                  className={styles.createInput}
                  placeholder="What are you working on?"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
                  autoFocus
                />
                <div className={styles.createActions}>
                  <button className={styles.createBtn} onClick={handleCreate} disabled={!createTitle.trim()}>Create</button>
                  <button className={styles.createCancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className={styles.newFocusBtn} onClick={() => setShowCreate(true)}>
                <Plus size={12} />
                <span>New Focus Item</span>
              </button>
            )}

            {/* Cards */}
            <FocusDropZone isOver={isOverFocus}>
              {visibleItems.length === 0 && !activeDrag ? (
                <div className={styles.emptyFocus}>
                  <Target size={18} className={styles.emptyIcon} />
                  <span>No focus items yet</span>
                  <span className={styles.emptyHint}>Create one or drag from the feed</span>
                </div>
              ) : visibleItems.length === 0 && activeDrag ? (
                <div className={`${styles.emptyFocus} ${styles.emptyFocusDragHint}`}>
                  <Target size={20} className={styles.emptyIconActive} />
                  <span>Drop to create focus item</span>
                </div>
              ) : (
                <SortableContext items={focusItemIds} strategy={verticalListSortingStrategy}>
                  {visibleItems.map((item) => (
                    <FocusCard key={item.id} item={item} isDragActive={!!activeDrag} isDropTarget={hoveredCardId === item.id && !!activeDrag} />
                  ))}
                </SortableContext>
              )}
            </FocusDropZone>
          </div>

          {/* ── Right column: Detail View or Feed ── */}
          <div className={styles.rightCol}>
            <AnimatePresence mode="wait">
              {activeItem ? (
                <motion.div
                  key={`detail-${activeItem.id}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={styles.rightColInner}
                >
                  <FocusDetailView item={activeItem} />
                </motion.div>
              ) : (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={styles.rightColInner}
                >
                  <div className={styles.feedHeader}>
                    <div className={styles.feedHeaderLeft}>
                      <Filter size={12} className={styles.feedHeaderIcon} />
                      <span className={styles.feedHeaderLabel}>
                        {urgentOnly ? "Critical Only" : "Notifications"}
                      </span>
                      {urgentOnly && (
                        <button className={styles.clearUrgentBtn} onClick={() => setUrgentOnly(false)} title="Show all">
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    <div className={styles.feedTabs}>
                      {FILTER_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          className={`${styles.feedTab} ${feedFilter === tab.key ? styles.feedTabActive : ""} ${styles[`feedTab_${tab.accent}`]}`}
                          onClick={() => setFeedFilter(tab.key)}
                        >
                          {tab.label}
                          {filterCounts[tab.key] > 0 && <span className={styles.feedTabCount}>{filterCounts[tab.key]}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.feedList}>
                    {filteredFeed.length === 0 ? (
                      <div className={styles.emptyState}>All clear</div>
                    ) : (
                      filteredFeed.map((item) => (
                        <DraggableFeedRow
                          key={item.id}
                          item={item}
                          isLinked={item.sourceId ? isLinked(item.sourceId, item.source) : false}
                          onNavigate={nav}
                          onPin={handlePinFromFeed}
                          onDismissUrgent={dismissUrgent}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag && <FeedDragOverlay item={activeDrag} />}
        </DragOverlay>
      </DndContext>
    </Panel>
  );
}
