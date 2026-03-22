import { useState, useEffect, useRef } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Play,
  X,
  Search,
  ArrowLeft,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Markdown from "react-markdown";
import { Panel } from "../../components/layout/Panel";
import { NeonButton } from "../../components/ui/NeonButton";
import { MissionControl } from "./MissionControl";
import { usePersonaStore } from "../../stores/personaStore";
import { useChatStore } from "../../stores/chatStore";
import styles from "./AgentsPanel.module.css";

interface Command {
  name: string;
  slash: string;
  description: string;
  argPlaceholder?: string;
}

interface Team {
  name: string;
  color: "cyan" | "magenta" | "purple" | "green" | "orange" | "yellow";
  commands: Command[];
}

const TEAMS: Team[] = [
  {
    name: "Ticket & Planning",
    color: "cyan",
    commands: [
      { name: "Create Ticket", slash: "/linear-create-ticket", description: "Create new Linear ticket", argPlaceholder: "Ticket description..." },
      { name: "Work on Ticket", slash: "/linear-work-on-ticket", description: "Branch → code → MR workflow", argPlaceholder: "COM-1234" },
      { name: "Enrich Ticket", slash: "/linear-enrich-ticket", description: "Add technical context from codebase", argPlaceholder: "COM-1234" },
      { name: "Draft Update", slash: "/linear-draft-project-update", description: "Draft project status update", argPlaceholder: "Project name..." },
      { name: "Tech Design", slash: "/linear-create-tech-design-from-project", description: "Create tech design from project", argPlaceholder: "Project name..." },
      { name: "Breakdown", slash: "/linear-breakdown-tech-design", description: "Break tech design into tickets", argPlaceholder: "Tech design URL or ID..." },
    ],
  },
  {
    name: "Code Review & QA",
    color: "magenta",
    commands: [
      { name: "Review MR", slash: "/gitlab-review-mr", description: "Comprehensive MR code review", argPlaceholder: "!1234 or MR URL" },
      { name: "Review Local", slash: "/review-local-changes", description: "Review uncommitted changes" },
      { name: "MR Feedback", slash: "/linear-add-comment-feedback", description: "Apply feedback from comments", argPlaceholder: "COM-1234" },
      { name: "Swarm Test", slash: "/linear-create-swarm-test", description: "Generate QA swarm test plan", argPlaceholder: "Project name..." },
      { name: "Review UI/UX", slash: "/review-ui-ux", description: "Compare against Figma designs", argPlaceholder: "Figma URL or component..." },
    ],
  },
  {
    name: "Pipeline & Deploy",
    color: "green",
    commands: [
      { name: "Manage Pipeline", slash: "/gitlab-manage-mr-ci-pipeline", description: "Trigger & troubleshoot CI jobs", argPlaceholder: "!1234 or MR URL" },
      { name: "Security Vulns", slash: "/gitlab-create-security-vuln-tickets", description: "Triage MR vulnerabilities", argPlaceholder: "!1234 or MR URL" },
      { name: "Ingest Feedback", slash: "/gitlab-ingest-mr-feedback", description: "Fetch reviewer feedback threads", argPlaceholder: "!1234 or MR URL" },
      { name: "Create MR", slash: "/gitlab-create-mr", description: "Create GitLab merge request" },
      { name: "Format & Push", slash: "/format-lint-commit-push", description: "Format, lint, commit, push" },
    ],
  },
  {
    name: "Code Quality",
    color: "purple",
    commands: [
      { name: "Optimize Query", slash: "/optimize-query", description: "EXPLAIN ANALYZE + suggestions", argPlaceholder: "SQL query or file path..." },
      { name: "Design System", slash: "/check-frontend-design-system", description: "Check design tokens & components" },
      { name: "Cursor Rule", slash: "/cursor-create-rule", description: "Generate .mdc rule file", argPlaceholder: "Rule description..." },
      { name: "Sync Rules", slash: "/sync-cursor-rules", description: "Sync Cursor rules to Claude Code" },
    ],
  },
  {
    name: "Dev Environment",
    color: "orange",
    commands: [
      { name: "Query DB", slash: "/pg-dev-db", description: "Query devenv PostgreSQL", argPlaceholder: "SQL query or question..." },
      { name: "Login Local", slash: "/login-to-local-env", description: "Generate JWT & authenticate" },
      { name: "Git Refresh", slash: "/git-refresh", description: "Pull repos & clean branches" },
      { name: "Resync DB", slash: "/gitlab-resync-mr-devenv-db", description: "Resync devenv database" },
    ],
  },
  {
    name: "Research & Bugs",
    color: "yellow",
    commands: [
      { name: "Query DB", slash: "/pg-dev-db", description: "Investigate via database", argPlaceholder: "SQL query or question..." },
      { name: "Enrich Ticket", slash: "/linear-enrich-ticket", description: "Pull code context into bug ticket", argPlaceholder: "COM-1234" },
      { name: "MR Context", slash: "/gitlab-ingest-mr-feedback", description: "Pull MR discussion context", argPlaceholder: "!1234 or MR URL" },
      { name: "Optimize Query", slash: "/optimize-query", description: "Analyze slow queries", argPlaceholder: "SQL query or file..." },
    ],
  },
];

interface AgentOutput {
  task_id: string;
  line: string;
  done: boolean;
}

interface RunningTask {
  id: string;
  command: string;
  args: string;
  output: string[];
  done: boolean;
}

function TaskOutputView({
  task,
  onBack,
}: {
  task: RunningTask;
  onBack: () => void;
}) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [task.output]);

  return (
    <div className={styles.outputView}>
      <div className={styles.outputToolbar}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} />
          Back
        </button>
        <span className={styles.outputCommand}>
          {task.command} {task.args}
        </span>
        {!task.done && <span className={styles.runningDot} />}
      </div>
      <div className={styles.outputContent} ref={outputRef}>
        <div className={styles.outputMarkdown}>
          <Markdown>{task.output.join("\n")}</Markdown>
        </div>
      </div>
    </div>
  );
}

function CommandRunner({
  command,
  onRun,
}: {
  command: Command;
  onRun: (slash: string, args: string) => void;
}) {
  const [args, setArgs] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleRun = () => {
    onRun(command.slash, args);
    setArgs("");
    setShowInput(false);
  };

  if (!showInput) {
    return (
      <button
        className={styles.commandItem}
        onClick={() => {
          if (command.argPlaceholder) {
            setShowInput(true);
          } else {
            onRun(command.slash, "");
          }
        }}
      >
        <div className={styles.commandInfo}>
          <span className={styles.commandName}>{command.name}</span>
          <span className={styles.commandSlash}>{command.slash}</span>
        </div>
        <Play size={12} className={styles.playIcon} />
      </button>
    );
  }

  return (
    <div className={styles.commandRunnerExpanded}>
      <div className={styles.commandRunnerHeader}>
        <span className={styles.commandName}>{command.name}</span>
        <button className={styles.closeBtn} onClick={() => setShowInput(false)}>
          <X size={12} />
        </button>
      </div>
      <div className={styles.commandRunnerInput}>
        <input
          className={styles.argInput}
          placeholder={command.argPlaceholder}
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          autoFocus
        />
        <NeonButton variant="magenta" onClick={handleRun}>
          Run
        </NeonButton>
      </div>
    </div>
  );
}

function TeamSection({
  team,
  onRun,
}: {
  team: Team;
  onRun: (slash: string, args: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colorVar = `var(--neon-${team.color})`;

  return (
    <div className={styles.teamSection}>
      <button
        className={styles.teamHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={styles.teamChevron}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className={styles.teamName} style={{ color: colorVar }}>
          {team.name}
        </span>
        <span className={styles.commandCount}>{team.commands.length}</span>
      </button>
      {expanded && (
        <div className={styles.commandList}>
          {team.commands.map((cmd) => (
            <CommandRunner key={cmd.slash + cmd.name} command={cmd} onRun={onRun} />
          ))}
        </div>
      )}
    </div>
  );
}

type AgentMode = "commands" | "personas";

let taskCounter = 0;

export function AgentsPanel() {
  const [mode, setMode] = useState<AgentMode>("personas");
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<RunningTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Detect if a chat/mission/single-run is active (tabs should hide)
  const activeSingleRun = usePersonaStore((s) => s.activeSingleRun);
  const activeMission = usePersonaStore((s) => s.activeMission);
  const viewingMission = usePersonaStore((s) => s.viewingMission);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const chatActive = !!(
    (activeSingleRun?.id && conversations[activeSingleRun.id]) ||
    (activeConversationId && conversations[activeConversationId]) ||
    activeSingleRun ||
    activeMission ||
    viewingMission
  );

  // Listen for agent output events
  useEffect(() => {
    const unlisten = listen<AgentOutput>("agent-output", (event) => {
      const { task_id, line, done } = event.payload;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task_id
            ? { ...t, output: [...t.output, line], done }
            : t,
        ),
      );
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const runCommand = (slash: string, args: string) => {
    const id = `task-${++taskCounter}`;
    const newTask: RunningTask = {
      id,
      command: slash,
      args,
      output: [`Running ${slash} ${args}`.trim(), ""],
      done: false,
    };
    setTasks((prev) => [newTask, ...prev]);
    setActiveTaskId(id);

    invoke("run_agent_command", {
      taskId: id,
      command: slash,
      args,
    }).catch((err) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, output: [...t.output, `Error: ${err}`], done: true }
            : t,
        ),
      );
    });
  };

  const handleResearch = () => {
    if (!query.trim()) return;
    runCommand("", query);
    setQuery("");
  };

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  if (activeTask) {
    return (
      <Panel title="Agent Teams" icon={Bot} badge={`${tasks.filter((t) => !t.done).length} running`}>
        <TaskOutputView
          task={activeTask}
          onBack={() => setActiveTaskId(null)}
        />
      </Panel>
    );
  }

  return (
    <Panel title="Agent Teams" icon={Bot} badge={`${TEAMS.length} teams`}>
      {/* Mode tabs — hidden when chat/mission is active */}
      {!chatActive && (
        <div className={styles.modeTabs}>
          <button
            className={`${styles.modeTab} ${mode === "personas" ? styles.modeTabActive : ""}`}
            onClick={() => setMode("personas")}
          >
            Personas
          </button>
          <button
            className={`${styles.modeTab} ${mode === "commands" ? styles.modeTabActive : ""}`}
            onClick={() => setMode("commands")}
          >
            Commands
          </button>
        </div>
      )}

      {mode === "personas" || chatActive ? (
        <MissionControl />
      ) : (
      <>
      <div className={styles.researchBox}>
        <div className={styles.researchHeader}>
          <Search size={12} className={styles.researchIcon} />
          <span className={styles.researchLabel}>Research & Ask</span>
        </div>
        <div className={styles.researchInput}>
          <textarea
            className={styles.queryInput}
            placeholder="Ask anything... investigate a bug, research a topic..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleResearch();
              }
            }}
            rows={2}
          />
          <NeonButton variant="magenta" onClick={handleResearch}>
            Run
          </NeonButton>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className={styles.recentTasks}>
          <div className={styles.recentTitle}>Recent</div>
          {tasks.slice(0, 5).map((task) => (
            <button
              key={task.id}
              className={styles.recentTask}
              onClick={() => setActiveTaskId(task.id)}
            >
              <span className={`${styles.taskDot} ${task.done ? styles.taskDone : styles.taskRunning}`} />
              <span className={styles.taskLabel}>
                {task.command || "Research"} {task.args.slice(0, 40)}
                {task.args.length > 40 ? "..." : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.teamsList}>
        {TEAMS.map((team) => (
          <TeamSection key={team.name} team={team} onRun={runCommand} />
        ))}
      </div>
      </>
      )}
    </Panel>
  );
}
