import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  GitCommit,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import { useShallow } from "zustand/react/shallow";
import { HoverTooltip } from "../../components/ui/HoverTooltip";
import { NeonButton } from "../../components/ui/NeonButton";
import { usePersonaStore } from "../../stores/personaStore";
import { useChatStore } from "../../stores/chatStore";
import { getPersonaById } from "../../config/personas";
import { PersonaPicker } from "./PersonaPicker";
import { AgentChat } from "./AgentChat";
import type { MissionTask, PersonaRunStatus } from "../../config/personaTypes";
import styles from "./MissionControl.module.css";

// ── Animation Variants ──

const fadeSlideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const springTransition = { type: "spring" as const, stiffness: 300, damping: 25 };

// ── Status Dot ──

function StatusDot({ status }: { status: PersonaRunStatus }) {
  const cls =
    status === "active"
      ? styles.dotActive
      : status === "done"
        ? styles.dotDone
        : status === "failed"
          ? styles.dotFailed
          : styles.dotWaiting;
  return <span className={`${styles.dot} ${cls}`} />;
}

// ── Verdict Tooltip helpers ──

type VerdictValue = "pass" | "fail" | "warn" | "unknown";

function verdictTooltipLabel(verdict: VerdictValue): string {
  if (verdict === "pass") return "QA: no bugs found";
  if (verdict === "fail") return "QA: critical bugs found — see timeline";
  if (verdict === "warn") return "QA: minor issues found — passed without retry";
  return "QA verdict unreadable — check output";
}

function verdictTooltipColor(verdict: VerdictValue): "cyan" | "magenta" | "yellow" {
  if (verdict === "pass") return "cyan";
  if (verdict === "fail") return "magenta";
  return "yellow";
}

// ── Mission Timeline (supports retries) ──

function PersonaTimeline({ mission }: { mission: MissionTask }) {
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});
  const activeOutputRef = useRef<HTMLDivElement>(null);
  const entries = mission.timelineEntries ?? [];
  const isLive = mission.status === "running";

  const activeEntryId = isLive
    ? entries.find((e) => e.status === "active")?.id ?? null
    : null;

  useEffect(() => {
    const el = activeOutputRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  });

  const isEntryExpanded = (entryId: string, status: PersonaRunStatus, hasOutput: boolean) => {
    if (entryId in manualOverrides) return manualOverrides[entryId];
    if (isLive && status === "active") return true;
    // When mission is done, expand entries that have output
    if (!isLive && hasOutput) return true;
    return false;
  };

  const toggleExpand = (id: string, currentlyExpanded: boolean) =>
    setManualOverrides((prev) => ({ ...prev, [id]: !currentlyExpanded }));

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineLabel}>
        Mission Timeline
        {mission.verdict && (
          <HoverTooltip
            label={verdictTooltipLabel(mission.verdict)}
            color={verdictTooltipColor(mission.verdict)}
            lineLength={80}
          >
            <motion.span
              className={`${styles.verdictBadge} ${
                mission.verdict === "pass"
                  ? styles.verdictPass
                  : mission.verdict === "fail"
                    ? styles.verdictFail
                    : mission.verdict === "warn"
                      ? styles.verdictWarn
                      : styles.verdictUnknown
              }`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              {mission.verdict === "unknown" ? "?" : mission.verdict.toUpperCase()}
            </motion.span>
          </HoverTooltip>
        )}
      </div>
      <AnimatePresence initial={false}>
        {entries.map((entry, idx) => {
          const isCommitStep = entry.personaId === "_commit";
          const persona = isCommitStep ? null : getPersonaById(entry.personaId);
          if (!persona && !isCommitStep) return null;
          const displayName = isCommitStep ? "Commit & Push" : persona!.name;
          const displayRole = isCommitStep ? "Git" : persona!.role;
          const displayColor = isCommitStep ? "var(--neon-green)" : persona!.color;
          const displayModel = isCommitStep ? "haiku" : persona!.model;
          const expanded = isEntryExpanded(entry.id, entry.status, !!entry.output);
          const isActive = entry.id === activeEntryId;

          return (
            <motion.div
              key={entry.id}
              className={styles.timelineItem}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springTransition, delay: idx * 0.08 }}
            >
              <div className={styles.timelineLeft}>
                <StatusDot status={entry.status} />
                {idx < entries.length - 1 && (
                  <div className={styles.timelineLine} />
                )}
              </div>
              <div className={styles.timelineContent}>
                <HoverTooltip
                  label={
                    entry.status === "active"
                      ? `${displayName} is working...`
                      : entry.status === "done" && entry.output
                        ? entry.output.replace(/[#*`\n]/g, " ").trim().slice(0, 120) + (entry.output.length > 120 ? "..." : "")
                        : entry.status === "failed"
                          ? `${displayName} failed`
                          : `${displayName} — waiting`
                  }
                  color={entry.status === "done" ? "cyan" : entry.status === "failed" ? "magenta" : "yellow"}
                  lineLength={100}
                >
                <button
                  className={styles.timelineHeader}
                  onClick={() => toggleExpand(entry.id, expanded)}
                >
                  {isCommitStep && <GitCommit size={12} style={{ color: displayColor, flexShrink: 0 }} />}
                  <span
                    className={styles.personaName}
                    style={{ color: displayColor }}
                  >
                    {displayName}
                  </span>
                  <span className={styles.personaRole}>{displayRole}</span>
                  <span
                    className={`${styles.modelBadge} ${
                      displayModel === "opus"
                        ? styles.modelOpus
                        : displayModel === "haiku"
                          ? styles.modelHaiku
                          : styles.modelSonnet
                    }`}
                  >
                    {displayModel}
                  </span>
                  {entry.isRetry && (
                    <span className={styles.retryBadge}>
                      <RotateCcw size={9} />
                      Retry {entry.retryNumber}
                    </span>
                  )}
                  {entry.output && (
                    <span className={styles.expandChevron}>
                      {expanded ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                    </span>
                  )}
                </button>
                </HoverTooltip>
                <AnimatePresence>
                  {expanded && (isActive || entry.output) && (
                    <motion.div
                      className={`${styles.timelineOutput} ${isActive ? styles.timelineOutputLive : ""}`}
                      ref={isActive ? activeOutputRef : undefined}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      {isActive && (
                        <div className={styles.liveIndicator}>
                          <span className={styles.liveDot} />
                          <span className={styles.liveLabel}>LIVE</span>
                        </div>
                      )}
                      {entry.output ? (
                        <div className={styles.timelineOutputInner}>
                          <Markdown>{entry.output}</Markdown>
                        </div>
                      ) : isActive ? (
                        <div className={styles.thinkingIndicator}>
                          <div className={styles.thinkingDots}>
                            <span />
                            <span />
                            <span />
                          </div>
                          <span className={styles.thinkingText}>
                            {displayName} is working...
                          </span>
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Quick Invoke (Single Agent Mode) ──

function QuickInvoke() {
  const squad = usePersonaStore((s) => s.squad);
  const startSingleAgent = usePersonaStore((s) => s.startSingleAgent);
  const launchAgent = usePersonaStore((s) => s.launchAgent);
  const [prompt, setPrompt] = useState("");

  const personaId = squad[0];
  const persona = getPersonaById(personaId);
  if (!persona) return null;

  const handleRun = () => {
    if (!prompt.trim()) return;
    startSingleAgent(prompt.trim());
    setPrompt("");
  };

  const handleBackground = () => {
    if (!prompt.trim()) return;
    launchAgent(personaId, prompt.trim());
    setPrompt("");
  };

  return (
    <motion.div
      className={styles.quickInvoke}
      {...fadeSlideUp}
      transition={springTransition}
      style={{ "--persona-color": persona.color } as React.CSSProperties}
    >
      {/* Accent border line */}
      <div className={styles.quickInvokeAccent} />

      <div className={styles.quickInvokeHeader}>
        {persona.avatar && (
          <motion.img
            src={persona.avatar}
            alt={persona.name}
            className={styles.quickInvokeAvatar}
            layoutId={`persona-avatar-${persona.id}`}
            transition={springTransition}
          />
        )}
        <div className={styles.quickInvokeInfo}>
          <motion.span
            className={styles.quickInvokeName}
            style={{ color: persona.color }}
            layoutId={`persona-name-${persona.id}`}
            transition={springTransition}
          >
            {persona.name}
          </motion.span>
          <span className={styles.quickInvokeRole}>{persona.role}</span>
        </div>
        <span
          className={`${styles.modelBadge} ${
            persona.model === "opus"
              ? styles.modelOpus
              : persona.model === "haiku"
                ? styles.modelHaiku
                : styles.modelSonnet
          }`}
        >
          {persona.model}
        </span>
      </div>
      <motion.div
        className={styles.quickInvokeInput}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.15 }}
      >
        <textarea
          className={styles.taskArea}
          placeholder={`Ask ${persona.name} anything...`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleRun();
            }
          }}
          rows={2}
          autoFocus
        />
        <div className={styles.quickInvokeActions}>
          <NeonButton
            variant="cyan"
            onClick={handleBackground}
            disabled={!prompt.trim()}
          >
            Background
          </NeonButton>
          <NeonButton
            variant="magenta"
            onClick={handleRun}
            disabled={!prompt.trim()}
          >
            Run
          </NeonButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Single Agent Output (with cancel) ──

function SingleAgentOutput() {
  const run = usePersonaStore((s) => s.activeSingleRun);
  const cancelSingleAgent = usePersonaStore((s) => s.cancelSingleAgent);
  const dismissSingleRun = usePersonaStore((s) => s.dismissSingleRun);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  });

  if (!run) return null;

  const persona = getPersonaById(run.personaId);
  if (!persona) return null;
  const isDone = run.status !== "running";

  return (
    <motion.div
      className={styles.singleOutput}
      {...fadeSlideUp}
      transition={springTransition}
    >
      <div
        className={styles.singleOutputHeader}
        style={{ "--persona-color": persona.color } as React.CSSProperties}
      >
        {isDone && (
          <motion.button
            className={styles.backBtn}
            onClick={dismissSingleRun}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={14} />
          </motion.button>
        )}
        {persona.avatar && (
          <img
            src={persona.avatar}
            alt={persona.name}
            className={styles.outputAvatar}
          />
        )}
        <StatusDot
          status={
            run.status === "running"
              ? "active"
              : run.status === "failed"
                ? "failed"
                : "done"
          }
        />
        <span style={{ color: persona.color }} className={styles.personaName}>
          {persona.name}
        </span>
        <span className={styles.personaRole}>{persona.role}</span>
        {run.status === "running" && (
          <motion.button
            className={styles.cancelBtn}
            onClick={cancelSingleAgent}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Square size={10} />
            Stop
          </motion.button>
        )}
      </div>
      {/* Error banner */}
      {run.error && (
        <motion.div
          className={styles.errorBanner}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={springTransition}
        >
          <span className={styles.errorLabel}>Error</span>
          <span className={styles.errorText}>{run.error}</span>
        </motion.div>
      )}

      <motion.div
        className={styles.singleOutputContent}
        ref={outputRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.1 }}
      >
        {run.output ? (
          <Markdown>{run.output}</Markdown>
        ) : run.status === "running" ? (
          <div className={styles.thinkingIndicator}>
            <div className={styles.thinkingDots}>
              <span />
              <span />
              <span />
            </div>
            <span className={styles.thinkingText}>
              {persona.name} is working...
            </span>
            <span className={styles.thinkingSubtext}>
              {persona.model === "opus" ? "Opus models may take 30-60s to start" : "Waiting for response"}
            </span>
          </div>
        ) : run.error ? (
          <div className={styles.thinkingIndicator}>
            <span className={styles.thinkingText} style={{ color: "var(--neon-red)" }}>
              {persona.name} failed
            </span>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

// ── Active Mission View (with cancel) ──

function ActiveMissionView() {
  const activeMission = usePersonaStore((s) => s.activeMission);
  const cancelMission = usePersonaStore((s) => s.cancelMission);
  if (!activeMission) return null;

  return (
    <motion.div className={styles.missionControl} {...fadeIn} transition={{ duration: 0.2 }}>
      <div className={styles.activeMissionHeader}>
        <PersonaTimeline mission={activeMission} />
        <motion.button
          className={styles.cancelBtn}
          onClick={cancelMission}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Square size={10} />
          Abort Mission
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── History Item Types ──

interface HistoryEntry {
  id: string;
  type: "mission" | "single";
  completedAt: string;
  data: unknown;
}

// ── Mission History (chronologically interleaved) ──

// ── Background Results ──

function BackgroundResults() {
  const completedUnseen = usePersonaStore((s) => s.completedUnseen);
  const dismissCompletedRun = usePersonaStore((s) => s.dismissCompletedRun);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const conversations = useChatStore((s) => s.conversations);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const openConversation = (runId: string) => {
    if (conversations[runId]) {
      setActiveConversation(runId);
      dismissCompletedRun(runId);
    }
  };

  if (completedUnseen.length === 0) return null;

  return (
    <motion.div
      className={styles.backgroundResults}
      {...fadeSlideUp}
      transition={springTransition}
    >
      <div className={styles.backgroundResultsHeader}>
        <span className={styles.backgroundResultsTitle}>Background Results</span>
        <span className={styles.backgroundResultsCount}>{completedUnseen.length}</span>
      </div>
      <AnimatePresence>
        {completedUnseen.map((run, i) => {
          const persona = getPersonaById(run.personaId);
          if (!persona) return null;
          const isExpanded = expanded[run.id] ?? true; // default expanded

          return (
            <motion.div
              key={run.id}
              className={styles.backgroundResultItem}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ ...springTransition, delay: i * 0.05 }}
              style={{ "--persona-color": persona.color } as React.CSSProperties}
            >
              <div
                className={styles.backgroundResultHeader}
                onClick={() => openConversation(run.id)}
                style={{ cursor: conversations[run.id] ? "pointer" : undefined }}
              >
                {persona.avatar && (
                  <img
                    src={persona.avatar}
                    alt={persona.name}
                    className={styles.backgroundResultAvatar}
                  />
                )}
                <StatusDot status={run.status === "failed" ? "failed" : "done"} />
                <span className={styles.personaName} style={{ color: persona.color }}>
                  {persona.name}
                </span>
                <span className={styles.personaRole}>{persona.role}</span>
                <button
                  className={styles.backgroundResultToggle}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((prev) => ({ ...prev, [run.id]: !prev[run.id] }));
                  }}
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <motion.button
                  className={styles.backgroundResultDismiss}
                  onClick={(e) => { e.stopPropagation(); dismissCompletedRun(run.id); }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  title="Dismiss"
                >
                  &times;
                </motion.button>
              </div>
              <div className={styles.backgroundResultPrompt}>
                {run.prompt}
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    className={styles.backgroundResultOutput}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    {run.error && (
                      <div className={styles.errorBanner}>
                        <span className={styles.errorLabel}>Error</span>
                        <span className={styles.errorText}>{run.error}</span>
                      </div>
                    )}
                    <Markdown>{run.output}</Markdown>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

function MissionHistory() {
  const missionHistory = usePersonaStore((s) => s.missionHistory);
  const singleRunHistory = usePersonaStore((s) => s.singleRunHistory);
  const clearHistory = usePersonaStore((s) => s.clearHistory);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(true);

  const sortedHistory = useMemo(() => {
    const entries: HistoryEntry[] = [
      ...missionHistory.map((m) => ({
        id: m.id,
        type: "mission" as const,
        completedAt: m.completedAt ?? m.startedAt ?? "",
        data: m,
      })),
      ...singleRunHistory.map((r) => ({
        id: r.id,
        type: "single" as const,
        completedAt: r.completedAt ?? r.startedAt,
        data: r,
      })),
    ];
    entries.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    return entries;
  }, [missionHistory, singleRunHistory]);

  if (sortedHistory.length === 0) return null;

  if (!showHistory) {
    return (
      <motion.button
        className={styles.historyToggle}
        onClick={() => setShowHistory(true)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <Clock size={12} />
        History ({sortedHistory.length})
      </motion.button>
    );
  }

  return (
    <motion.div
      className={styles.historySection}
      {...fadeSlideUp}
      transition={springTransition}
    >
      <div className={styles.historyHeader}>
        <span className={styles.historyTitle}>History</span>
        <div className={styles.historyActions}>
          <button className={styles.clearHistoryBtn} onClick={clearHistory}>
            <Trash2 size={10} />
            Clear
          </button>
          <button
            className={styles.historyToggle}
            onClick={() => setShowHistory(false)}
          >
            Hide
          </button>
        </div>
      </div>

      <div className={styles.historyList}>
        {sortedHistory.map((entry, i) => {
          const isExpanded = expanded[entry.id];
          const toggleExp = () =>
            setExpanded((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }));

          if (entry.type === "mission") {
            const mission = entry.data as MissionTask;
            return (
              <motion.div
                key={entry.id}
                className={styles.historyItem}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springTransition, delay: i * 0.04 }}
              >
                <button className={styles.historyItemHeader} onClick={toggleExp}>
                  <div className={styles.historyItemInfo}>
                    {mission.verdict && (
                      <HoverTooltip
                        label={verdictTooltipLabel(mission.verdict)}
                        color={verdictTooltipColor(mission.verdict)}
                        lineLength={80}
                      >
                        <span
                          className={`${styles.verdictBadge} ${
                            mission.verdict === "pass"
                              ? styles.verdictPass
                              : mission.verdict === "fail"
                                ? styles.verdictFail
                                : mission.verdict === "warn"
                                  ? styles.verdictWarn
                                  : styles.verdictUnknown
                          }`}
                        >
                          {mission.verdict === "unknown" ? "?" : mission.verdict.toUpperCase()}
                        </span>
                      </HoverTooltip>
                    )}
                    <span className={styles.historyDescription}>
                      {mission.description.slice(0, 60)}
                      {mission.description.length > 60 ? "..." : ""}
                    </span>
                  </div>
                  <div className={styles.historyItemMeta}>
                    <span className={styles.historySquad}>
                      {mission.squad.personas.map((id) => {
                        const p = getPersonaById(id);
                        return p ? (
                          <span key={id} style={{ color: p.color }}>
                            {p.name}
                          </span>
                        ) : null;
                      })}
                    </span>
                    {mission.completedAt && (
                      <span className={styles.historyTime}>
                        {new Date(mission.completedAt).toLocaleDateString()}
                      </span>
                    )}
                    <span className={styles.expandChevron}>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                  </div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden" }}
                    >
                      <PersonaTimeline mission={mission} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          }

          const run = entry.data as {
            personaId: string;
            prompt: string;
            output: string;
            completedAt?: string;
          };
          const persona = getPersonaById(run.personaId);
          if (!persona) return null;

          return (
            <motion.div
              key={entry.id}
              className={styles.historyItem}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springTransition, delay: i * 0.04 }}
            >
              <button className={styles.historyItemHeader} onClick={toggleExp}>
                <div className={styles.historyItemInfo}>
                  {persona.avatar && (
                    <img
                      src={persona.avatar}
                      alt={persona.name}
                      className={styles.historyAvatar}
                    />
                  )}
                  <span
                    className={styles.historySingleBadge}
                    style={{ color: persona.color }}
                  >
                    {persona.name}
                  </span>
                  <span className={styles.historyDescription}>
                    {run.prompt.slice(0, 80)}
                    {run.prompt.length > 80 ? "..." : ""}
                  </span>
                </div>
                <div className={styles.historyItemMeta}>
                  {run.completedAt && (
                    <span className={styles.historyTime}>
                      {new Date(run.completedAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className={styles.expandChevron}>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    className={styles.timelineOutput}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    <Markdown>{run.output}</Markdown>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Main Component ──

export function MissionControl() {
  const { squad, activeMission, activeSingleRun, viewingMission } = usePersonaStore(
    useShallow((s) => ({
      squad: s.squad,
      activeMission: s.activeMission,
      activeSingleRun: s.activeSingleRun,
      viewingMission: s.viewingMission,
    })),
  );
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const dismissSingleRun = usePersonaStore((s) => s.dismissSingleRun);
  const setViewingMission = usePersonaStore((s) => s.setViewingMission);
  const startMission = usePersonaStore((s) => s.startMission);
  const clearSquad = usePersonaStore((s) => s.clearSquad);
  const [taskDescription, setTaskDescription] = useState("");

  const handleStart = () => {
    if (!taskDescription.trim() || squad.length === 0) return;
    startMission(taskDescription.trim());
    setTaskDescription("");
  };

  // Determine if we should show AgentChat:
  // 1. Active single run with a chat conversation
  // 2. Active conversation navigated from StatusBar
  const chatRunId = activeSingleRun?.id && conversations[activeSingleRun.id]
    ? activeSingleRun.id
    : activeConversationId && conversations[activeConversationId]
      ? activeConversationId
      : null;

  const handleChatBack = () => {
    dismissSingleRun();
    useChatStore.getState().setActiveConversation(null);
  };

  return (
    <div className={styles.missionControl}>
      <AnimatePresence mode="wait">
        {chatRunId ? (
          <motion.div key="agent-chat" {...fadeSlideUp} transition={springTransition}>
            <AgentChat conversationId={chatRunId} onBack={handleChatBack} />
          </motion.div>
        ) : viewingMission ? (
          <motion.div key="viewing-mission" {...fadeIn} transition={{ duration: 0.2 }}>
            <div className={styles.missionControl}>
              <div className={styles.activeMissionHeader}>
                <PersonaTimeline mission={viewingMission} />
                <motion.button
                  className={styles.backBtn}
                  onClick={() => setViewingMission(null)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft size={14} />
                  Back
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : activeSingleRun ? (
          <motion.div key="single-output" {...fadeSlideUp} transition={springTransition}>
            <SingleAgentOutput />
          </motion.div>
        ) : activeMission ? (
          <motion.div key="active-mission" {...fadeIn} transition={{ duration: 0.2 }}>
            <ActiveMissionView />
          </motion.div>
        ) : (
          <motion.div key="picker" {...fadeIn} transition={{ duration: 0.2 }}>
            <PersonaPicker />

            {/* Squad strip */}
            <AnimatePresence>
              {squad.length > 0 && (
                <motion.div
                  className={styles.squadStrip}
                  {...fadeSlideUp}
                  transition={springTransition}
                >
                  <div className={styles.squadLabel}>Squad Order</div>
                  <div className={styles.squadList}>
                    {squad.map((id, idx) => {
                      const persona = getPersonaById(id);
                      if (!persona) return null;
                      return (
                        <motion.span
                          key={id}
                          className={styles.squadItem}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ ...springTransition, delay: idx * 0.05 }}
                        >
                          <span style={{ color: persona.color }}>{persona.name}</span>
                          {idx < squad.length - 1 && (
                            <ArrowRight size={12} className={styles.squadArrow} />
                          )}
                        </motion.span>
                      );
                    })}
                    <motion.button
                      className={styles.clearBtn}
                      onClick={clearSquad}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Clear
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Single-agent quick invoke vs full mission input */}
            <AnimatePresence mode="wait">
              {squad.length === 1 ? (
                <QuickInvoke key="quick-invoke" />
              ) : squad.length > 1 ? (
                <motion.div
                  key="mission-input"
                  className={styles.taskInput}
                  {...fadeSlideUp}
                  transition={springTransition}
                >
                  <textarea
                    className={styles.taskArea}
                    placeholder="Describe the mission..."
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleStart();
                      }
                    }}
                    rows={3}
                  />
                  <NeonButton
                    variant="magenta"
                    onClick={handleStart}
                    disabled={!taskDescription.trim() || squad.length === 0}
                  >
                    Start Mission
                  </NeonButton>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <BackgroundResults />
            <MissionHistory />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
