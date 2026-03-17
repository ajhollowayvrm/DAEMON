import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import styles from "./StatusBar.module.css";
import { useTheme } from "../../themes";

interface ServiceStatus {
  name: string;
  connected: boolean;
}

const services: ServiceStatus[] = [
  { name: "Slack", connected: true },
  { name: "GitLab", connected: true },
  { name: "Linear", connected: true },
  { name: "Agents", connected: true },
];

function useClockTime() {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);
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

export function StatusBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const time = useClockTime();
  const { theme } = useTheme();
  const { leftTag, rightTag, tickerMessages } = theme.statusBar;

  // Duplicate the ticker messages for seamless marquee looping
  const tickerLoop = [...tickerMessages, ...tickerMessages];

  const isLcars = theme.layoutStyle === "lcars";

  if (isLcars) {
    return (
      <div className={styles.statusBarLcars}>
        {/* Segmented colored bar — mirrors title bar pattern */}
        <div className={styles.lcarsStatusSegments}>
          {/* Pill-shaped left end */}
          <div className={styles.lcarsStatusSeg} style={{ background: "#9966cc", flex: "0 0 50px", borderRadius: "25px 0 0 25px" }} />
          <div className={styles.lcarsStatusSeg} style={{ background: "#9999ff", flex: "0 0 60px" }} />

          {/* Left tag inside a segment */}
          <div className={styles.lcarsStatusTagSeg} style={{ background: "#cc6699" }}>
            <span className={styles.lcarsStatusTagText}>{leftTag}</span>
          </div>

          {/* Service indicators as pill badges */}
          <div className={styles.lcarsStatusIndicators}>
            {services.map((service) => (
              <div
                key={service.name}
                className={`${styles.lcarsStatusPill} ${service.connected ? styles.lcarsStatusPillConnected : styles.lcarsStatusPillDisconnected}`}
              >
                <span className={styles.lcarsStatusPillDot} />
                <span>{service.name}</span>
              </div>
            ))}
          </div>

          {/* Ticker inside a fill segment */}
          <div className={styles.lcarsStatusFillSeg} style={{ background: "#ff9933" }}>
            <div className={styles.lcarsTickerMask}>
              <div className={styles.lcarsTickerInner}>
                {tickerLoop.map((msg, idx) => (
                  <span key={idx}>{msg}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right tag */}
          <div className={styles.lcarsStatusTagSeg} style={{ background: "#9966cc" }}>
            <span className={styles.lcarsStatusTagText}>{rightTag}</span>
          </div>

          {/* Time */}
          <div className={styles.lcarsStatusTagSeg} style={{ background: "#9999ff" }}>
            <span className={styles.lcarsStatusTagText}>{time}</span>
          </div>

          {/* Sync */}
          <div className={styles.lcarsStatusSeg} style={{ background: "#cc6699", flex: "0 0 80px" }}>
            <span className={styles.lcarsStatusSyncText}>Synced: 5s</span>
          </div>

          {/* Settings button */}
          <button className={styles.settingsBtnLcars} onClick={onOpenSettings}>
            <Settings size={14} />
          </button>

          {/* Curved elbow on the right */}
          <div className={styles.lcarsStatusElbow} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.statusBar}>
      <div className={styles.indicators}>
        <span className={styles.hudTag}>{leftTag}</span>
        {services.map((service) => (
          <div key={service.name} className={styles.indicator}>
            <span
              className={`${styles.dot} ${
                service.connected
                  ? styles.dotConnected
                  : styles.dotDisconnected
              }`}
            />
            <span>{service.name}</span>
          </div>
        ))}
      </div>
      {/* Data ticker marquee */}
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
        <span className={styles.syncTime}>Synced: 5s ago</span>
        <button className={styles.settingsBtn} onClick={onOpenSettings}>
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
