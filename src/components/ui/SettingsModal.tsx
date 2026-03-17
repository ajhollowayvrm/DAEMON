import { useState, useEffect } from "react";
import { X, Check, AlertCircle, Loader2, Settings } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { NeonButton } from "./NeonButton";
import { useTheme, getAllThemes } from "../../themes";
import type { ThemeDefinition } from "../../themes/types";
import styles from "./SettingsModal.module.css";

interface AppSettings {
  gitlab_pat: string | null;
  linear_api_key: string | null;
  gitlab_group_id: string;
  linear_team_id: string;
}

type TestStatus = "idle" | "testing" | "success" | "error";

function CredentialRow({
  label,
  settingKey,
  currentValue,
  placeholder,
  testFn,
  onSaved,
}: {
  label: string;
  settingKey: string;
  currentValue: string | null;
  placeholder: string;
  testFn: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testResult, setTestResult] = useState("");

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await invoke("save_setting", { key: settingKey, value: value.trim() });
      setEditing(false);
      setValue("");
      onSaved();
      setTestStatus("idle");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestResult("");
    try {
      const result = await invoke<string>(testFn);
      setTestStatus("success");
      setTestResult(String(result));
    } catch (e) {
      setTestStatus("error");
      setTestResult(String(e));
    }
  };

  return (
    <div className={styles.credRow}>
      <div className={styles.credHeader}>
        <span className={styles.credLabel}>{label}</span>
        <div className={styles.credStatus}>
          {currentValue ? (
            <span className={styles.credConfigured}>
              <Check size={10} /> {currentValue}
            </span>
          ) : (
            <span className={styles.credMissing}>
              <AlertCircle size={10} /> Not configured
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div className={styles.credEdit}>
          <input
            className={styles.credInput}
            type="password"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <NeonButton onClick={handleSave} disabled={saving || !value.trim()}>
            {saving ? "..." : "Save"}
          </NeonButton>
          <button className={styles.cancelBtn} onClick={() => { setEditing(false); setValue(""); }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className={styles.credActions}>
          <NeonButton variant="purple" onClick={() => setEditing(true)}>
            {currentValue ? "Update" : "Configure"}
          </NeonButton>
          {currentValue && (
            <NeonButton variant="cyan" onClick={handleTest} disabled={testStatus === "testing"}>
              {testStatus === "testing" ? (
                <><Loader2 size={10} className={styles.spinIcon} /> Testing...</>
              ) : (
                "Test Connection"
              )}
            </NeonButton>
          )}
        </div>
      )}

      {testStatus === "success" && (
        <div className={styles.testSuccess}>
          <Check size={12} /> Connected: {testResult}
        </div>
      )}
      {testStatus === "error" && (
        <div className={styles.testError}>
          <AlertCircle size={12} /> {testResult}
        </div>
      )}
    </div>
  );
}

function BootSettings() {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("daemon_boot_enabled") !== "false";
  });
  const [duration, setDuration] = useState(() => {
    return parseInt(localStorage.getItem("daemon_boot_duration") ?? "5", 10);
  });

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("daemon_boot_enabled", String(next));
  };

  const handleDuration = (val: number) => {
    setDuration(val);
    localStorage.setItem("daemon_boot_duration", String(val));
  };

  return (
    <div className={styles.credRow}>
      <div className={styles.credHeader}>
        <span className={styles.credLabel}>Show boot animation on startup</span>
        <button
          className={`${styles.toggleBtn} ${enabled ? styles.toggleOn : styles.toggleOff}`}
          onClick={handleToggle}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
      {enabled && (
        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>Duration</span>
          <input
            type="range"
            min={3}
            max={15}
            value={duration}
            onChange={(e) => handleDuration(parseInt(e.target.value, 10))}
            className={styles.slider}
          />
          <span className={styles.sliderValue}>{duration}s</span>
        </div>
      )}
    </div>
  );
}

function ThemeSelector() {
  const { themeId, setThemeId } = useTheme();
  const allThemes: ThemeDefinition[] = getAllThemes();

  return (
    <div className={styles.themeGrid}>
      {allThemes.map((t) => {
        const isActive = t.id === themeId;
        return (
          <button
            key={t.id}
            className={`${styles.themeCard} ${isActive ? styles.themeCardActive : ""}`}
            onClick={() => setThemeId(t.id)}
          >
            <div className={styles.themeColorStrip}>
              {t.previewColors.map((color, i) => (
                <span
                  key={i}
                  className={styles.themeColorSwatch}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className={styles.themeCardInfo}>
              <span className={styles.themeCardName}>{t.name}</span>
              <span className={styles.themeCardDesc}>{t.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const loadSettings = async () => {
    try {
      const s = await invoke<AppSettings>("get_settings");
      setSettings(s);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <Settings size={16} className={styles.headerIcon} />
          <span className={styles.modalTitle}>System Configuration</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.sectionTitle}>Theme</div>
          <div className={styles.sectionDesc}>
            Choose a visual theme for the D.A.E.M.O.N. interface
          </div>
          <ThemeSelector />

          <div className={styles.sectionTitle} style={{ marginTop: "24px" }}>
            API Credentials
          </div>
          <div className={styles.sectionDesc}>
            Tokens are stored locally in ~/.config/neondash/credentials.json
          </div>

          {settings && (
            <>
              <CredentialRow
                label="GitLab Personal Access Token"
                settingKey="gitlab_pat"
                currentValue={settings.gitlab_pat}
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                testFn="test_gitlab_connection"
                onSaved={loadSettings}
              />
              <CredentialRow
                label="Linear API Key"
                settingKey="linear_api_key"
                currentValue={settings.linear_api_key}
                placeholder="lin_api_xxxxxxxxxxxxxxxxxxxx"
                testFn="test_linear_connection"
                onSaved={loadSettings}
              />
            </>
          )}

          <div className={styles.sectionTitle} style={{ marginTop: "24px" }}>
            Slack
          </div>
          <div className={styles.slackInfo}>
            <Check size={12} className={styles.slackCheck} />
            Credentials auto-extracted from Slack desktop app. No configuration needed.
          </div>

          <div className={styles.sectionTitle} style={{ marginTop: "24px" }}>
            Boot Sequence
          </div>
          <BootSettings />

          <div className={styles.sectionTitle} style={{ marginTop: "24px" }}>
            About
          </div>
          <div className={styles.aboutInfo}>
            <div>D.A.E.M.O.N. v0.1.0</div>
            <div className={styles.aboutSub}>
              Distributed Autonomous Engineering Management Orchestration Node
            </div>
            <div className={styles.aboutSub}>
              Built with Tauri v2 + React 18 + TypeScript + Rust
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
