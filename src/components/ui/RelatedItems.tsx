import { useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Link2,
  ChevronRight,
  MessageSquare,
  GitMerge,
  LayoutList,
  Activity,
  Target,
} from "lucide-react";
import {
  useCorrelationStore,
  type CorrelationEntity,
  type CorrelationSource,
} from "../../stores/correlationStore";
import { useLayoutStore } from "../../stores/layoutStore";
import styles from "./RelatedItems.module.css";

// ── Source icon mapping ──

const SOURCE_ICONS: Record<CorrelationSource, typeof MessageSquare> = {
  slack: MessageSquare,
  gitlab: GitMerge,
  linear: LayoutList,
  datadog: Activity,
  focus: Target,
};

// ── Navigation helper ──

function useNavigateToEntity() {
  const openMR = useLayoutStore((s) => s.openMR);
  const openLinearTicket = useLayoutStore((s) => s.openLinearTicket);
  const openSlackThread = useLayoutStore((s) => s.openSlackThread);
  const openMonitor = useLayoutStore((s) => s.openMonitor);
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);

  return useCallback(
    (entity: CorrelationEntity) => {
      if (!entity.nav) return;
      switch (entity.nav.type) {
        case "gitlab":
          openMR({ projectId: entity.nav.projectId, iid: entity.nav.iid });
          break;
        case "linear":
          openLinearTicket(entity.nav.identifier);
          break;
        case "slack":
          openSlackThread({
            channelId: entity.nav.channelId,
            threadTs: entity.nav.threadTs,
          });
          break;
        case "focus":
          setActivePanel("hub");
          break;
        case "datadog":
          openMonitor(entity.nav.monitorId);
          break;
      }
    },
    [openMR, openLinearTicket, openSlackThread, openMonitor, setActivePanel],
  );
}

// ── Group entities by source ──

function groupBySource(entities: CorrelationEntity[]) {
  const groups: Partial<Record<CorrelationSource, CorrelationEntity[]>> = {};
  for (const entity of entities) {
    if (!groups[entity.source]) groups[entity.source] = [];
    groups[entity.source]!.push(entity);
  }
  return groups;
}

// ── Hook: subscribe to revision + read related from getState() ──

function useRelated(entityId: string): CorrelationEntity[] {
  const revision = useCorrelationStore((s) => s.revision);
  return useMemo(
    () => useCorrelationStore.getState().getRelated(entityId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityId, revision],
  );
}

// ── Shared entity list renderer ──

function EntityList({
  entities,
  onNavigate,
}: {
  entities: CorrelationEntity[];
  onNavigate: (entity: CorrelationEntity) => void;
}) {
  const groups = groupBySource(entities);
  return (
    <>
      {Object.entries(groups).map(([source, items]) => {
        const Icon = SOURCE_ICONS[source as CorrelationSource];
        return (
          <div key={source} className={styles.sourceGroup}>
            {items!.map((entity) => (
              <div
                key={entity.id}
                className={styles.item}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(entity);
                }}
              >
                <Icon size={12} className={styles.itemIcon} />
                <div className={styles.itemContent}>
                  <span className={styles.itemLabel}>{entity.label}</span>
                  {entity.subtitle && (
                    <span className={styles.itemSubtitle}>
                      {entity.subtitle}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── Related Items Section (for detail views) ──

interface RelatedItemsProps {
  entityId: string;
}

export function RelatedItems({ entityId }: RelatedItemsProps) {
  const related = useRelated(entityId);
  const [open, setOpen] = useState(true);
  const navigate = useNavigateToEntity();

  if (related.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header} onClick={() => setOpen(!open)}>
        <ChevronRight
          size={10}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
        <Link2 size={10} className={styles.headerIcon} />
        Related
        <span className={styles.count}>{related.length}</span>
      </div>

      {open && (
        <div className={styles.list}>
          <EntityList entities={related} onNavigate={navigate} />
        </div>
      )}
    </div>
  );
}

// ── Correlation Badge (for toolbars and list cards) ──
// Uses hover + position:fixed popup to escape overflow clipping.

interface CorrelationBadgeProps {
  entityId: string;
}

export function CorrelationBadge({ entityId }: CorrelationBadgeProps) {
  const related = useRelated(entityId);
  const navigate = useNavigateToEntity();
  const [hovered, setHovered] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const showPopup = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPopupPos({
        top: rect.bottom + 6,
        left: Math.max(8, rect.right - 280),
      });
    }
    setHovered(true);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  if (related.length === 0) return null;

  return (
    <>
      <div
        ref={badgeRef}
        className={styles.badge}
        onMouseEnter={showPopup}
        onMouseLeave={scheduleHide}
        onClick={(e) => e.stopPropagation()}
      >
        <Link2 size={10} className={styles.badgeIcon} />
        {related.length}
      </div>

      {hovered &&
        createPortal(
          <div
            ref={popupRef}
            className={`${styles.popup} ${styles.popupVisible}`}
            style={{ top: popupPos.top, left: popupPos.left }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <div className={styles.popupTitle}>Related Items</div>
            <EntityList
              entities={related}
              onNavigate={(entity) => {
                setHovered(false);
                navigate(entity);
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
