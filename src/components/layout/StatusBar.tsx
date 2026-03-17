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
