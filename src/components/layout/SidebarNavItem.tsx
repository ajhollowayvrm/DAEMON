import { type LucideIcon } from "lucide-react";
import styles from "./SidebarNavItem.module.css";

interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  badge?: number;
  /** Optional secondary count shown as a separate chip (e.g. comms alerts) */
  secondaryBadge?: { count: number; label: string };
  active: boolean;
  collapsed: boolean;
  activity?: { running: boolean; avatar?: string; color?: string };
  onClick: () => void;
}

export function SidebarNavItem({
  icon: Icon,
  label,
  badge,
  secondaryBadge,
  active,
  collapsed,
  activity,
  onClick,
}: SidebarNavItemProps) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.navItemActive : ""} ${collapsed ? styles.collapsed : ""}`}
      onClick={onClick}
      title={label}
    >
      <div className={styles.iconWrap}>
        <Icon size={18} className={styles.icon} />
        {activity?.running && (
          <span
            className={styles.activityDot}
            style={activity.color ? { background: activity.color } : undefined}
          />
        )}
      </div>
      {!collapsed && (
        <>
          <span className={styles.label}>{label}</span>
          {activity?.running && activity.avatar && (
            <img
              src={activity.avatar}
              alt=""
              className={styles.activityAvatar}
            />
          )}
          {secondaryBadge && secondaryBadge.count > 0 && (
            <span className={styles.badgeSecondary} title={secondaryBadge.label}>
              {secondaryBadge.count}
            </span>
          )}
          {badge !== undefined && badge > 0 && (
            <span className={styles.badge}>{badge}</span>
          )}
        </>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className={styles.badgeCollapsed}>{badge}</span>
      )}
    </button>
  );
}
