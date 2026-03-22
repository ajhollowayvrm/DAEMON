import { useState, useRef, useCallback, useEffect } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  GitMerge,
  Bot,
  LayoutList,
  Archive,
  Globe,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { SidebarNavItem } from "./SidebarNavItem";
import { useLayoutStore, type PanelId } from "../../stores/layoutStore";
import { useSlackSections } from "../../hooks";
import { useMergeRequests, useLinearIssues, useDatadogMonitors } from "../../hooks";
import { useTodos } from "../../hooks/useTodos";
import { usePersonaStore } from "../../stores/personaStore";
import { getPersonaById } from "../../config/personas";
import styles from "./Sidebar.module.css";

const NAV_ITEMS: {
  id: PanelId;
  label: string;
  icon: typeof MessageSquare;
}[] = [
  { id: "hub", label: "Hub", icon: LayoutDashboard },
  { id: "slack", label: "Slack", icon: MessageSquare },
  { id: "linear", label: "Linear", icon: LayoutList },
  { id: "gitlab", label: "GitLab", icon: GitMerge },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "datadog", label: "Monitors", icon: Activity },
  { id: "browser", label: "Browse", icon: Globe },
  { id: "archive", label: "Archive", icon: Archive },
];

/** Width of the proximity detection zone in pixels */
const APPROACH_ZONE = 120;

const sidebarTransition = {
  type: "spring" as const,
  stiffness: 340,
  damping: 30,
  mass: 0.9,
};

// Container for staggered nav items
const navContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.08,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

// Each nav item slides in from left with a slight spring bounce.
// Cast to Variants to satisfy framer-motion v12's strict index signature —
// the actual runtime shape is correct; the TS types are overly narrow for
// transition objects nested inside variant states.
const navItemVariants = {
  hidden: {
    opacity: 0,
    x: -28,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring" as const,
      stiffness: 380,
      damping: 24,
      mass: 0.7,
    },
  },
  exit: {
    opacity: 0,
    x: -18,
    filter: "blur(3px)",
    transition: { duration: 0.12, ease: "easeIn" as const },
  },
} satisfies Record<string, object>;

export function Sidebar() {
  const { activePanel, setActivePanel } = useLayoutStore();
  const booting = useLayoutStore((s) => s.booting);

  const [revealed, setRevealed] = useState(false);
  const [proximity, setProximity] = useState(0); // 0 = far, 1 = at edge
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Track cursor proximity to left edge globally
  useEffect(() => {
    if (revealed || booting) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX < APPROACH_ZONE) {
        const p = 1 - e.clientX / APPROACH_ZONE;
        setProximity(p);
      } else if (proximity > 0) {
        setProximity(0);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [revealed, proximity, booting]);

  const revealSidebar = useCallback(() => {
    if (booting) return;
    clearTimeout(hideTimer.current);
    setRevealed(true);
    setProximity(0);
  }, [booting]);

  const startHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setRevealed(false);
    }, 400);
  }, []);

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimer.current);
  }, []);

  // Badge data from hooks
  const { data: slackSections } = useSlackSections();
  const { data: mergeRequests } = useMergeRequests();
  const { data: linearIssues } = useLinearIssues();
  const { data: datadogMonitors } = useDatadogMonitors();
  const { todos, criticalCount } = useTodos();

  const slackUnread = slackSections
    ? slackSections.reduce(
        (sum, s) => sum + s.messages.filter((m) => m.is_unread).length,
        0,
      )
    : 0;
  const mrCount = mergeRequests?.filter((mr) => mr.needs_your_approval).length ?? 0;
  const ddAlertMonitors = datadogMonitors?.filter((m) => m.status === "Alert" || m.status === "Warn") ?? [];
  const ddAlertCount = ddAlertMonitors.length;
  const ddCommsAlertCount = ddAlertMonitors.filter((m) => m.tags.includes("team:comms")).length;
  const linearCount = linearIssues?.filter((i) => {
    if (!i.assignee_is_me) return false;
    if (i.status_type === "cancelled") return false;
    if (i.status_type === "backlog") return false;
    // Deployed/completed older than 7 days — stale, hide
    if (i.status_type === "completed" || i.status === "Deployed") {
      const age = Date.now() - new Date(i.updated_at).getTime();
      if (age > 7 * 86_400_000) return false;
    }
    return true;
  }).length ?? 0;
  const todoCount = todos.length;

  // Agent activity indicator
  const activeMission = usePersonaStore((s) => s.activeMission);
  const activeSingleRun = usePersonaStore((s) => s.activeSingleRun);

  const agentActivity = (() => {
    if (activeSingleRun?.status === "running") {
      const persona = getPersonaById(activeSingleRun.personaId);
      return {
        running: true,
        avatar: persona?.avatar,
        color: persona?.color?.startsWith("var(") ? undefined : persona?.color,
      };
    }
    if (activeMission?.status === "running") {
      const activeEntry = activeMission.timelineEntries.find((e) => e.status === "active");
      if (activeEntry) {
        const persona = getPersonaById(activeEntry.personaId);
        return {
          running: true,
          avatar: persona?.avatar,
          color: persona?.color?.startsWith("var(") ? undefined : persona?.color,
        };
      }
      return { running: true };
    }
    return undefined;
  })();

  // Background run completion badge
  const unseenCompletions = usePersonaStore((s) => s.unseenCompletions);
  const backgroundRunCount = usePersonaStore((s) => s.backgroundRuns.length);
  const clearUnseenCompletions = usePersonaStore((s) => s.clearUnseenCompletions);

  const getBadge = (id: PanelId): number | undefined => {
    switch (id) {
      case "hub":
        return criticalCount || undefined;
      case "todos":
        return todoCount || undefined;
      case "datadog":
        return ddAlertCount || undefined;
      case "archive":
        return undefined;
      case "browser":
        return undefined;
      case "slack":
        return slackUnread || undefined;
      case "gitlab":
        return mrCount || undefined;
      case "linear":
        return linearCount || undefined;
      case "agents":
        return (unseenCompletions + backgroundRunCount) || undefined;
      default:
        return undefined;
    }
  };

  const getSecondaryBadge = (id: PanelId): { count: number; label: string } | undefined => {
    if (id === "datadog" && ddCommsAlertCount > 0) {
      return { count: ddCommsAlertCount, label: `${ddCommsAlertCount} comms` };
    }
    return undefined;
  };

  // Compute sidebar width for the collapsed x offset
  // We use CSS custom property as the authoritative width, but for Framer we
  // need a concrete value. Pull it from the computed style on first render.
  const sidebarRef = useRef<HTMLElement>(null);

  const getCollapsedX = () => {
    if (sidebarRef.current) {
      const w = sidebarRef.current.offsetWidth;
      return -(w + 3);
    }
    // Fallback: enough to ensure it's off-screen
    return -260;
  };

  const baseClass = styles.sidebar;

  // Pulse edge: dynamic intensity based on proximity (when approaching)
  // or softened (when sidebar is fully revealed)
  const rgbColor = "0, 255, 245";
  const edgeIntensity = revealed ? 0.15 : proximity;
  const edgeStyle = {
    opacity: edgeIntensity > 0 ? 1 : 0,
    "--edge-intensity": edgeIntensity,
    "--edge-width": `${3 + edgeIntensity * 8}px`,
    "--edge-glow": `0 0 ${edgeIntensity * 30}px ${edgeIntensity * 12}px rgba(${rgbColor}, ${edgeIntensity * 0.5})`,
  } as React.CSSProperties;

  // Box shadow is driven by Framer animate prop (not CSS class) so it can
  // vary between collapsed (none) and revealed (full purple/cyan glow).
  const revealedBoxShadow = "4px 0 30px rgba(0, 0, 0, 0.7), 2px 0 15px rgba(176, 38, 255, 0.25), 0 0 60px rgba(0, 255, 245, 0.08)";

  // Don't render anything during boot — hot zone z-index is above boot overlay
  if (booting) return null;

  return (
    <>
      {/* Hot zone — invisible strip on left edge */}
      {!revealed && (
        <div
          className={styles.hotZone}
          onMouseEnter={revealSidebar}
        />
      )}

      {/* Sidebar drawer — spring slides in from left */}
      <motion.aside
        ref={sidebarRef}
        className={baseClass}
        // Drive x directly so Framer owns the translation (removes CSS
        // transform classes for revealed/collapsed).
        animate={{
          x: revealed ? 0 : getCollapsedX(),
          boxShadow: revealed ? revealedBoxShadow : "none",
          pointerEvents: revealed ? "auto" : "none",
        }}
        transition={sidebarTransition}
        // Ensure the element is never visually hidden — pointer-events are
        // toggled via animate above
        style={{ pointerEvents: revealed ? "auto" : "none" }}
        onMouseEnter={cancelHide}
        onMouseLeave={startHide}
      >
        <AnimatePresence mode="wait">
          {revealed && (
            <motion.nav
              key="nav"
              className={styles.nav}
              variants={navContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {NAV_ITEMS.map((item, index) => (
                <motion.div
                  key={item.id}
                  variants={navItemVariants as Variants}
                  // Cyberpunk whileHover: slide right, glow border flare
                  whileHover={{ x: 4, transition: { type: "spring" as const, stiffness: 500, damping: 20 } }}
                  whileTap={{
                    scale: 0.96,
                    x: 1,
                    transition: { type: "spring" as const, stiffness: 700, damping: 20 },
                  }}
                  // Slight delay cascade so items feel like they're loading in
                  custom={index}
                >
                  <SidebarNavItem
                    icon={item.icon}
                    label={item.label}
                    badge={getBadge(item.id)}
                    secondaryBadge={getSecondaryBadge(item.id)}
                    active={activePanel === item.id}
                    collapsed={false}
                    activity={item.id === "agents" ? agentActivity : undefined}
                    onClick={() => {
                      setActivePanel(item.id);
                      if (item.id === "agents" && unseenCompletions > 0) {
                        clearUnseenCompletions();
                      }
                    }}
                  />
                </motion.div>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>

        {/* Pulse edge — attached to sidebar's right edge, moves with it */}
        <div
          className={styles.pulseEdge}
          style={edgeStyle}
        />
      </motion.aside>
    </>
  );
}
