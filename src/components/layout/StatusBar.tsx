import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, RefreshCw, Settings, Link2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./StatusBar.module.css";
import { useTheme } from "../../themes";
import { usePersonaStore } from "../../stores/personaStore";
import { useChatStore } from "../../stores/chatStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { getPersonaById } from "../../config/personas";
import { useSlackSections, useMergeRequests, useLinearIssues, useDatadogMonitors } from "../../hooks";
import { useCorrelationStore } from "../../stores/correlationStore";
import type { MissionTask } from "../../config/personaTypes";

// ── Types ──

type ConnectionState = "connected" | "loading" | "error";

interface ServiceInfo {
  name: string;
  state: ConnectionState;
  lastUpdated: number | null;
  isRefetching: boolean;
  error?: string;
  refetch: () => void;
}

// ── Helpers ──

function useClockTime() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function queryToState(status: string, isRefetching: boolean): ConnectionState {
  if (status === "error") return "error";
  if (status === "pending" && !isRefetching) return "loading";
  return "connected";
}

// ── Correlation Engine Indicator ──

function CorrelationIndicator() {
  const revision = useCorrelationStore((s) => s.revision);
  const linkCount = useCorrelationStore((s) => Object.keys(s.index).length);

  return (
    <div className={styles.indicator}>
      <Link2 size={9} style={{ color: revision > 0 ? "var(--neon-cyan)" : "var(--text-muted)", opacity: 0.6 }} />
      <span>{linkCount > 0 ? linkCount : "..."}</span>

      <div className={styles.servicePopup}>
        <div className={styles.servicePopupHeader}>
          <span className={`${styles.servicePopupDot} ${revision > 0 ? styles.dotConnected : styles.dotLoading}`} />
          <span className={styles.servicePopupName}>Correlations</span>
          <span className={`${styles.servicePopupState} ${revision > 0 ? styles.servicePopupStateOk : styles.servicePopupStateLoad}`}>
            {revision > 0 ? "Active" : "Building..."}
          </span>
        </div>
        <div className={styles.servicePopupMeta}>
          <span>{linkCount} linked entities · rev {revision}</span>
        </div>
      </div>
    </div>
  );
}

// ── Datadog Alerts Badge ──

function AlertsBadge() {
  const { data: monitors } = useDatadogMonitors();
  const openMonitor = useLayoutStore((s) => s.openMonitor);
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const [hovered, setHovered] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const alerting = useMemo(
    () => monitors?.filter((m) => m.status === "Alert" || m.status === "Warn") ?? [],
    [monitors],
  );

  const showPopup = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.top - 8, left: Math.max(8, rect.right - 300) });
    }
    setHovered(true);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  if (alerting.length === 0) return null;

  const alertCount = alerting.filter((m) => m.status === "Alert").length;
  const warnCount = alerting.filter((m) => m.status === "Warn").length;

  return (
    <>
      <div
        ref={badgeRef}
        className={styles.alertsBadge}
        onMouseEnter={showPopup}
        onMouseLeave={scheduleHide}
        onClick={(e) => {
          e.stopPropagation();
          setActivePanel("datadog");
        }}
      >
        <AlertTriangle size={10} />
        <span>
          {alertCount > 0 && `${alertCount} alert${alertCount > 1 ? "s" : ""}`}
          {alertCount > 0 && warnCount > 0 && " · "}
          {warnCount > 0 && `${warnCount} warn`}
        </span>
      </div>

      {hovered &&
        createPortal(
          <div
            ref={popupRef}
            className={styles.alertsPopup}
            style={{ top: popupPos.top, left: popupPos.left, transform: "translateY(-100%)" }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <div className={styles.alertsPopupTitle}>Active Alerts</div>
            {alerting.map((m) => (
              <div
                key={m.id}
                className={styles.alertsPopupItem}
                onClick={() => {
                  setHovered(false);
                  openMonitor(m.id);
                }}
              >
                <span
                  className={`${styles.alertsPopupDot} ${
                    m.status === "Alert" ? styles.statusDotAlert : styles.statusDotWarn
                  }`}
                />
                <span className={styles.alertsPopupName}>{m.name}</span>
                <span className={`${styles.alertsPopupStatus} ${
                  m.status === "Alert" ? styles.alertsPopupStatusAlert : styles.alertsPopupStatusWarn
                }`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Service Indicator with Tooltip ──

function ServiceIndicator({ service }: { service: ServiceInfo }) {
  const dotClass =
    service.state === "connected"
      ? styles.dotConnected
      : service.state === "loading"
        ? styles.dotLoading
        : styles.dotError;

  return (
    <div className={styles.indicator}>
      <span className={`${styles.dot} ${dotClass}`} />
      <span>{service.name}</span>
      {service.isRefetching && (
        <RefreshCw size={8} className={styles.refetchingSpin} />
      )}

      {/* Hover popup */}
      <div className={styles.servicePopup}>
        <div className={styles.servicePopupHeader}>
          <span className={`${styles.servicePopupDot} ${dotClass}`} />
          <span className={styles.servicePopupName}>{service.name}</span>
          <span
            className={`${styles.servicePopupState} ${
              service.state === "connected"
                ? styles.servicePopupStateOk
                : service.state === "error"
                  ? styles.servicePopupStateErr
                  : styles.servicePopupStateLoad
            }`}
          >
            {service.state === "connected"
              ? "Connected"
              : service.state === "error"
                ? "Error"
                : "Loading..."}
          </span>
        </div>

        {service.error && (
          <div className={styles.servicePopupError}>{service.error}</div>
        )}

        <div className={styles.servicePopupMeta}>
          <span>
            Last polled:{" "}
            {service.lastUpdated ? timeAgo(service.lastUpdated) : "never"}
          </span>
        </div>

        <button
          className={styles.servicePopupRefresh}
          onClick={(e) => {
            e.stopPropagation();
            service.refetch();
          }}
        >
          <RefreshCw size={10} />
          Refresh now
        </button>
      </div>
    </div>
  );
}

// ── Agent Ticker ──

const agentSpring = { type: "spring" as const, stiffness: 400, damping: 25 };

interface TickerAgent {
  id: string;
  personaId: string;
  prompt: string;
  status: "running" | "completed" | "failed" | "question";
  questionId?: string;
  questionText?: string;
}

// ── Question Chip — handles its own answer state ──

interface QuestionChipProps {
  agent: TickerAgent & { questionId: string; questionText: string };
  persona: NonNullable<ReturnType<typeof getPersonaById>>;
}

function QuestionChip({ agent, persona }: QuestionChipProps) {
  const answerQuestion = usePersonaStore((s) => s.answerQuestion);
  const dismissQuestion = usePersonaStore((s) => s.dismissQuestion);
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const conversations = useChatStore((s) => s.conversations);
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Find the task ID associated with this question for chat navigation
  const question = usePersonaStore((s) =>
    s.pendingQuestions.find((q) => q.id === agent.questionId),
  );
  const taskId = question?.taskId;

  const handleNavigateToChat = useCallback(() => {
    if (taskId && conversations[taskId]) {
      useChatStore.getState().setActiveConversation(taskId);
      setActivePanel("agents");
    }
  }, [taskId, conversations, setActivePanel]);

  const handleSend = useCallback(() => {
    const trimmed = answer.trim();
    if (!trimmed) return;
    answerQuestion(agent.questionId, trimmed);
    setAnswer("");
  }, [answer, agent.questionId, answerQuestion]);

  const handleSkip = useCallback(() => {
    dismissQuestion(agent.questionId);
  }, [agent.questionId, dismissQuestion]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSend();
      if (e.key === "Escape") handleSkip();
      // Prevent event from bubbling up and closing the popup
      e.stopPropagation();
    },
    [handleSend, handleSkip],
  );

  return (
    <motion.div
      key={agent.id}
      className={`${styles.agentTickerItem} ${styles.agentTickerItemQuestion}`}
      initial={{ opacity: 0, scale: 0, width: 0 }}
      animate={{ opacity: 1, scale: 1, width: "auto" }}
      exit={{ opacity: 0, scale: 0, width: 0 }}
      transition={agentSpring}
      style={{ "--agent-color": persona.color } as React.CSSProperties}
      onClick={handleNavigateToChat}
    >
      {persona.avatar && (
        <img
          src={persona.avatar}
          alt={persona.name}
          className={styles.agentTickerAvatar}
        />
      )}
      <span className={styles.agentTickerQuestionBadge}>?</span>
      <span className={styles.agentTickerName}>{persona.name}</span>

      {/* Question popup */}
      <div
        className={styles.agentTickerPopup}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.agentTickerPopupHeader}>
          {persona.avatar && (
            <img
              src={persona.avatar}
              alt={persona.name}
              className={styles.agentTickerPopupAvatar}
            />
          )}
          <div>
            <span
              className={styles.agentTickerPopupName}
              style={{ color: persona.color }}
            >
              {persona.name}
            </span>
            <span className={styles.agentTickerPopupRole}>{persona.role}</span>
          </div>
          <span className={`${styles.servicePopupState} ${styles.servicePopupStateQuestion}`}>
            Needs input
          </span>
        </div>

        <div className={styles.agentTickerPopupPrompt}>
          {agent.questionText}
        </div>

        <div className={styles.agentTickerPopupAnswer}>
          <input
            ref={inputRef}
            type="text"
            className={styles.agentTickerAnswerInput}
            placeholder="Your answer..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
          <div className={styles.agentTickerAnswerActions}>
            <button
              className={styles.agentTickerAnswerSend}
              onClick={(e) => { e.stopPropagation(); handleSend(); }}
              disabled={!answer.trim()}
            >
              Send
            </button>
            <button
              className={styles.agentTickerAnswerSkip}
              onClick={(e) => { e.stopPropagation(); handleSkip(); }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Mission Chip — shows squad avatars with active/done/waiting states ──

function MissionChip({ mission, onClick }: { mission: MissionTask; onClick: () => void }) {
  const entries = mission.timelineEntries ?? [];
  const isRunning = mission.status === "running";
  const isDone = mission.status === "completed" || mission.status === "failed";

  return (
    <motion.div
      className={`${styles.agentTickerItem} ${styles.agentTickerItemMission} ${isDone ? styles.agentTickerItemDone : ""}`}
      initial={{ opacity: 0, scale: 0, width: 0 }}
      animate={{ opacity: 1, scale: 1, width: "auto" }}
      exit={{ opacity: 0, scale: 0, width: 0 }}
      transition={agentSpring}
      onClick={onClick}
    >
      <span className={styles.missionLabel}>MISSION</span>
      <div className={styles.missionAvatars}>
        {entries
          .filter((e) => !e.isRetry && e.personaId !== "_commit")
          .map((entry) => {
            const persona = getPersonaById(entry.personaId);
            if (!persona) return null;
            const isActive = entry.status === "active";
            const entryDone = entry.status === "done" || entry.status === "failed";
            return (
              <div
                key={entry.id}
                className={`${styles.missionAvatarWrapper} ${
                  isActive
                    ? styles.missionAvatarActive
                    : entryDone
                      ? styles.missionAvatarDone
                      : styles.missionAvatarWaiting
                }`}
              >
                {persona.avatar ? (
                  <img
                    src={persona.avatar}
                    alt={persona.name}
                    className={styles.missionAvatarImg}
                    style={isActive ? { borderColor: persona.color } : undefined}
                  />
                ) : (
                  <span
                    className={styles.missionAvatarFallback}
                    style={isActive ? { borderColor: persona.color, color: persona.color } : undefined}
                  >
                    {persona.name[0]}
                  </span>
                )}
                {isActive && <span className={styles.missionAvatarPulse} style={{ background: persona.color }} />}
              </div>
            );
          })}
      </div>
      {isDone && (
        <span className={`${styles.agentTickerCheck} ${mission.status === "failed" ? styles.agentTickerCheckFailed : ""}`}>
          <Check size={8} />
        </span>
      )}

      {/* Hover popup */}
      <div className={styles.agentTickerPopup}>
        <div className={styles.agentTickerPopupHeader}>
          <div>
            <span className={styles.agentTickerPopupName} style={{ color: "var(--neon-magenta)" }}>
              Mission
            </span>
            <span className={styles.agentTickerPopupRole}>
              {isRunning ? "In progress" : mission.status}
            </span>
          </div>
          {isDone && (
            <span className={`${styles.servicePopupState} ${
              mission.status === "completed" ? styles.servicePopupStateOk : styles.servicePopupStateErr
            }`}>
              {mission.status === "completed" ? "Done" : "Failed"}
            </span>
          )}
        </div>
        <div className={styles.agentTickerPopupPrompt}>
          {mission.description}
        </div>
        <div className={styles.agentTickerPopupHint}>
          Click to view timeline
        </div>
      </div>
    </motion.div>
  );
}

interface AcceptQuip {
  id: string;
  personaId: string;
  text: string;
}

function AgentTicker() {
  const backgroundRuns = usePersonaStore((s) => s.backgroundRuns);
  const activeSingleRun = usePersonaStore((s) => s.activeSingleRun);
  const [quips, setQuips] = useState<AcceptQuip[]>([]);
  const seenRunIds = useRef(new Set<string>());

  // Show acceptance quip when a new background run appears
  useEffect(() => {
    for (const run of backgroundRuns) {
      if (seenRunIds.current.has(run.id)) continue;
      seenRunIds.current.add(run.id);
      const persona = getPersonaById(run.personaId);
      if (!persona?.acceptQuips?.length) continue;
      const text = persona.acceptQuips[Math.floor(Math.random() * persona.acceptQuips.length)];
      const quipId = run.id;
      setQuips((prev) => [...prev, { id: quipId, personaId: run.personaId, text }]);
      setTimeout(() => {
        setQuips((prev) => prev.filter((q) => q.id !== quipId));
      }, 3000);
    }
  }, [backgroundRuns]);
  const activeMission = usePersonaStore((s) => s.activeMission);
  const lastCompletedMission = usePersonaStore((s) => s.lastCompletedMission);
  const completedUnseen = usePersonaStore((s) => s.completedUnseen);
  const pendingQuestions = usePersonaStore((s) => s.pendingQuestions);
  const dismissCompletedRun = usePersonaStore((s) => s.dismissCompletedRun);
  const setViewingMission = usePersonaStore((s) => s.setViewingMission);
  const dismissLastCompletedMission = usePersonaStore((s) => s.dismissLastCompletedMission);
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);
  const conversations = useChatStore((s) => s.conversations);

  // Build the set of task IDs that have pending (unanswered) questions so we
  // can suppress the normal "running" chip for those agents.
  const questionTaskIds = new Set(
    pendingQuestions.filter((q) => !q.answered).map((q) => q.taskId),
  );

  const agents: TickerAgent[] = [];

  // Pending questions — shown first (highest priority)
  for (const q of pendingQuestions) {
    if (q.answered) continue;
    agents.push({
      id: `q-${q.id}`,
      personaId: q.personaId,
      prompt: q.question,
      status: "question",
      questionId: q.id,
      questionText: q.question,
    });
  }

  // Running background agents (skip those with an active question)
  for (const run of backgroundRuns) {
    if (questionTaskIds.has(run.id)) continue;
    agents.push({ id: run.id, personaId: run.personaId, prompt: run.prompt, status: "running" });
  }
  // Focused single run (skip if has active question)
  if (activeSingleRun?.status === "running" && !questionTaskIds.has(activeSingleRun.id)) {
    agents.push({
      id: activeSingleRun.id,
      personaId: activeSingleRun.personaId,
      prompt: activeSingleRun.prompt,
      status: "running",
    });
  }
  // Completed but unseen
  for (const run of completedUnseen) {
    agents.push({
      id: run.id,
      personaId: run.personaId,
      prompt: run.prompt,
      status: run.status === "failed" ? "failed" : "completed",
    });
  }

  // Mission chip (active or just-completed)
  const missionToShow = activeMission ?? lastCompletedMission;

  if (agents.length === 0 && !missionToShow) return null;

  return (
    <div className={styles.agentTicker}>
      <AnimatePresence>
        {/* Mission chip */}
        {missionToShow && (
          <MissionChip
            key={`mission-${missionToShow.id}`}
            mission={missionToShow}
            onClick={() => {
              if (activeMission) {
                // Just navigate to agents panel — ActiveMissionView will show
                setActivePanel("agents");
              } else if (lastCompletedMission) {
                // Set viewingMission and navigate
                setViewingMission(lastCompletedMission);
                dismissLastCompletedMission();
                setActivePanel("agents");
              }
            }}
          />
        )}

        {agents.map((agent) => {
          const persona = getPersonaById(agent.personaId);
          if (!persona) return null;

          // Question state — dedicated component
          if (
            agent.status === "question" &&
            agent.questionId != null &&
            agent.questionText != null
          ) {
            return (
              <QuestionChip
                key={agent.id}
                agent={agent as TickerAgent & { questionId: string; questionText: string }}
                persona={persona}
              />
            );
          }

          const isDone = agent.status !== "running";

          return (
            <motion.div
              key={agent.id}
              className={`${styles.agentTickerItem} ${isDone ? styles.agentTickerItemDone : ""}`}
              initial={{ opacity: 0, scale: 0, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: "auto" }}
              exit={{ opacity: 0, scale: 0, width: 0 }}
              transition={agentSpring}
              style={{ "--agent-color": persona.color, cursor: "pointer" } as React.CSSProperties}
              onClick={() => {
                if (conversations[agent.id]) {
                  useChatStore.getState().setActiveConversation(agent.id);
                }
                setActivePanel("agents");
                if (isDone) {
                  dismissCompletedRun(agent.id);
                }
              }}
            >
              {persona.avatar && (
                <img
                  src={persona.avatar}
                  alt={persona.name}
                  className={styles.agentTickerAvatar}
                />
              )}
              {isDone ? (
                <span className={`${styles.agentTickerCheck} ${agent.status === "failed" ? styles.agentTickerCheckFailed : ""}`}>
                  <Check size={8} />
                </span>
              ) : (
                <span className={styles.agentTickerDot} />
              )}
              <span className={styles.agentTickerName}>{persona.name}</span>

              {/* Hover popup */}
              <div className={styles.agentTickerPopup}>
                <div className={styles.agentTickerPopupHeader}>
                  {persona.avatar && (
                    <img
                      src={persona.avatar}
                      alt={persona.name}
                      className={styles.agentTickerPopupAvatar}
                    />
                  )}
                  <div>
                    <span
                      className={styles.agentTickerPopupName}
                      style={{ color: persona.color }}
                    >
                      {persona.name}
                    </span>
                    <span className={styles.agentTickerPopupRole}>
                      {persona.role}
                    </span>
                  </div>
                  {isDone && (
                    <span className={`${styles.servicePopupState} ${
                      agent.status === "completed" ? styles.servicePopupStateOk : styles.servicePopupStateErr
                    }`}>
                      {agent.status === "completed" ? "Done" : "Failed"}
                    </span>
                  )}
                </div>
                <div className={styles.agentTickerPopupPrompt}>
                  {agent.prompt}
                </div>
                <div className={styles.agentTickerPopupHint}>
                  {isDone ? "Click to view output" : "Click to view live output"}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Acceptance quip toasts */}
      <AnimatePresence>
        {quips.map((quip) => {
          const qPersona = getPersonaById(quip.personaId);
          if (!qPersona) return null;
          return (
            <motion.div
              key={quip.id}
              className={styles.acceptQuip}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              style={{ "--agent-color": qPersona.color } as React.CSSProperties}
            >
              {qPersona.avatar && (
                <img
                  src={qPersona.avatar}
                  alt={qPersona.name}
                  className={styles.acceptQuipAvatar}
                />
              )}
              <span className={styles.acceptQuipText}>{quip.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Main StatusBar ──

export function StatusBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const time = useClockTime();
  const { theme } = useTheme();
  const { rightTag, tickerMessages } = theme.statusBar;
  const tickerLoop = [...tickerMessages, ...tickerMessages];

  // Live service status from TanStack Query
  const slack = useSlackSections();
  const gitlab = useMergeRequests();
  const linear = useLinearIssues();
  const datadog = useDatadogMonitors();

  const services: ServiceInfo[] = [
    {
      name: "Slack",
      state: queryToState(slack.status, slack.isRefetching),
      lastUpdated: slack.dataUpdatedAt || null,
      isRefetching: slack.isRefetching,
      error: slack.error?.message,
      refetch: () => slack.refetch(),
    },
    {
      name: "GitLab",
      state: queryToState(gitlab.status, gitlab.isRefetching),
      lastUpdated: gitlab.dataUpdatedAt || null,
      isRefetching: gitlab.isRefetching,
      error: gitlab.error?.message,
      refetch: () => gitlab.refetch(),
    },
    {
      name: "Linear",
      state: queryToState(linear.status, linear.isRefetching),
      lastUpdated: linear.dataUpdatedAt || null,
      isRefetching: linear.isRefetching,
      error: linear.error?.message,
      refetch: () => linear.refetch(),
    },
    {
      name: "Datadog",
      state: queryToState(datadog.status, datadog.isRefetching),
      lastUpdated: datadog.dataUpdatedAt || null,
      isRefetching: datadog.isRefetching,
      error: datadog.error?.message,
      refetch: () => datadog.refetch(),
    },
  ];

  return (
    <div className={styles.statusBar}>
      <div className={styles.indicators}>
        {services.map((service) => (
          <ServiceIndicator key={service.name} service={service} />
        ))}
        <CorrelationIndicator />
        <AlertsBadge />
      </div>
      <AgentTicker />
      <div className={styles.dataTicker}>
        <div className={styles.dataTickerInner}>
          {tickerLoop.map((msg, idx) => (
            <span key={idx}>{msg}</span>
          ))}
        </div>
      </div>
      <div className={styles.rightSection}>
        <span className={styles.hudTagAlt}>{rightTag}</span>
        <span className={styles.timestamp}>{time}</span>
        <button className={styles.settingsBtn} onClick={onOpenSettings}>
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
