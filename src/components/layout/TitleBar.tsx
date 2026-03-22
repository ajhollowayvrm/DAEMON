import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";
import { useTheme } from "../../themes";
import styles from "./TitleBar.module.css";

export function TitleBar() {
  const { theme } = useTheme();
  const { goBack, goForward, canGoBack, canGoForward } = useLayoutStore();

  return (
    <div className={styles.titleBar} data-tauri-drag-region>
      {/* Nav buttons — left side after traffic lights */}
      <div className={styles.navButtons}>
        <button
          className={styles.navBtn}
          onClick={goBack}
          disabled={!canGoBack}
          title="Go back"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className={styles.navBtn}
          onClick={goForward}
          disabled={!canGoForward}
          title="Go forward"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Logo — right side */}
      <div className={styles.logoSection}>
        <img
          src={theme.bootSequence.logoPath}
          alt="D.A.E.M.O.N."
          className={styles.logoImg}
        />
      </div>
    </div>
  );
}
