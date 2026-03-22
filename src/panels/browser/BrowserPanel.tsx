import { useState, useRef, useCallback } from "react";
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  X,
  Home,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { Panel } from "../../components/layout/Panel";
import styles from "./BrowserPanel.module.css";

const BOOKMARKS = [
  { label: "GitLab", url: "https://gitlab.com" },
  { label: "Linear", url: "https://linear.app" },
  { label: "Datadog", url: "https://app.datadoghq.com" },
  { label: "Figma", url: "https://figma.com" },
  { label: "Postman", url: "https://web.postman.co" },
  { label: "Confluence", url: "https://nectarhr.atlassian.net/wiki" },
  { label: "SendGrid", url: "https://app.sendgrid.com" },
];

const HOME_URL = "about:blank";

export function BrowserPanel() {
  const [url, setUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const navigate = useCallback((targetUrl: string) => {
    let normalized = targetUrl.trim();
    if (!normalized) return;
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://") && !normalized.startsWith("about:")) {
      if (normalized.includes(".") && !normalized.includes(" ")) {
        normalized = `https://${normalized}`;
      } else {
        normalized = `https://www.google.com/search?q=${encodeURIComponent(normalized)}`;
      }
    }
    setUrl(normalized);
    setInputUrl(normalized);
    setLoading(true);
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), normalized]);
    setHistoryIdx((prev) => prev + 1);
  }, [historyIdx]);

  const goBack = () => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      const target = history[newIdx];
      setUrl(target);
      setInputUrl(target);
    }
  };

  const goForward = () => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      const target = history[newIdx];
      setUrl(target);
      setInputUrl(target);
    }
  };

  const refresh = () => {
    if (iframeRef.current && url) {
      setLoading(true);
      iframeRef.current.src = url;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      navigate(inputUrl);
    }
  };

  return (
    <Panel title="Browser" icon={Globe}>
      <div className={styles.browser}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.navBtns}>
            <button
              className={styles.navBtn}
              onClick={goBack}
              disabled={historyIdx <= 0}
              title="Back"
            >
              <ArrowLeft size={12} />
            </button>
            <button
              className={styles.navBtn}
              onClick={goForward}
              disabled={historyIdx >= history.length - 1}
              title="Forward"
            >
              <ArrowRight size={12} />
            </button>
            <button className={styles.navBtn} onClick={refresh} title="Refresh">
              <RotateCw size={11} className={loading ? styles.spinning : ""} />
            </button>
            <button
              className={styles.navBtn}
              onClick={() => { setUrl(HOME_URL); setInputUrl(""); }}
              disabled={!url || url === HOME_URL}
              title="Home"
            >
              <Home size={11} />
            </button>
          </div>
          <div className={styles.urlBar}>
            <Globe size={10} className={styles.urlIcon} />
            <input
              className={styles.urlInput}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL or search..."
            />
            {url && (
              <button
                className={styles.urlClear}
                onClick={() => { setUrl(HOME_URL); setInputUrl(""); }}
                title="Clear"
              >
                <X size={10} />
              </button>
            )}
          </div>
          {url && url !== HOME_URL && (
            <button
              className={styles.externalBtn}
              onClick={() => open(url)}
              title="Open in system browser"
            >
              <ExternalLink size={11} />
            </button>
          )}
        </div>

        {/* Bookmarks */}
        {!url || url === HOME_URL ? (
          <div className={styles.homePage}>
            <div className={styles.homeTitle}>Reference Browser</div>
            <div className={styles.homeHint}>Open pages without leaving Daemon</div>
            <div className={styles.bookmarks}>
              {BOOKMARKS.map((bm) => (
                <button
                  key={bm.url}
                  className={styles.bookmark}
                  onClick={() => navigate(bm.url)}
                >
                  <Globe size={12} />
                  <span>{bm.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.iframeContainer}>
            <iframe
              ref={iframeRef}
              src={url}
              className={styles.iframe}
              onLoad={() => setLoading(false)}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              title="Reference Browser"
            />
            {loading && <div className={styles.loadingBar} />}
          </div>
        )}
      </div>
    </Panel>
  );
}
