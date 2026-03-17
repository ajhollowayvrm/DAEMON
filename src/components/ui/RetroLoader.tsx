import { useState, useEffect } from "react";
import styles from "./RetroLoader.module.css";

const SLACK_MESSAGES = [
  "Intercepting corporate communications...",
  "Decrypting xoxc tokens from Slack's cold storage...",
  "Bypassing OAuth like it's 2019...",
  "Resolving @mentions (why do people use Slack IDs?)...",
  "Counting unread messages you'll ignore...",
  "Loading passive-aggressive emoji reactions...",
];

const GITLAB_MESSAGES = [
  "Fetching MRs your team forgot to review...",
  "Checking pipeline status (spoiler: it's failing)...",
  "Loading merge conflicts you'll deal with 'later'...",
  "Counting approval rules no one understands...",
  "Parsing CODEOWNERS (it's always you)...",
  "Querying 50 MRs × 2 API calls each. GitLab rate limit says hi...",
];

const LINEAR_MESSAGES = [
  "Loading tickets from the backlog abyss...",
  "Counting 'In Progress' tickets from 3 sprints ago...",
  "Querying GraphQL (at least it's not REST)...",
  "Loading tech debt you've been meaning to address...",
  "Fetching tickets marked 'Ready' (optimistic, aren't we?)...",
  "Parsing Linear's response (it's actually pretty fast)...",
];

const GENERIC_MESSAGES = [
  "Reticulating splines...",
  "Consulting the blockchain...",
  "Asking ChatGPT for help (jk, we use Claude)...",
  "Loading... have you tried turning it off and on again?",
  "sudo loading --force...",
  "Waiting for DNS propagation...",
];

type LoaderType = "slack" | "gitlab" | "linear" | "generic";

const MESSAGE_MAP: Record<LoaderType, string[]> = {
  slack: SLACK_MESSAGES,
  gitlab: GITLAB_MESSAGES,
  linear: LINEAR_MESSAGES,
  generic: GENERIC_MESSAGES,
};

interface RetroLoaderProps {
  text?: string;
  type?: LoaderType;
}

export function RetroLoader({ text, type = "generic" }: RetroLoaderProps) {
  const messages = MESSAGE_MAP[type];
  const [msgIndex, setMsgIndex] = useState(() =>
    Math.floor(Math.random() * messages.length),
  );

  useEffect(() => {
    if (text) return; // Don't cycle if custom text is provided
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [text, messages]);

  return (
    <div className={styles.loader}>
      <div className={styles.spinner} />
      <span className={styles.loaderText}>{text ?? messages[msgIndex]}</span>
      <div className={styles.loaderSubtext}>
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className={styles.loaderDot} style={{ animationDelay: `${i * 0.2}s` }}>
            ▪
          </span>
        ))}
      </div>
    </div>
  );
}
