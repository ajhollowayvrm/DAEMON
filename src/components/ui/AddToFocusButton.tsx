import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Target, Plus, ChevronDown } from "lucide-react";
import { useFocusStore } from "../../stores/focusStore";
import type { FocusLink } from "../../stores/focusStore";
import { useLayoutStore } from "../../stores/layoutStore";
import styles from "./AddToFocusButton.module.css";

interface AddToFocusButtonProps {
  link: Omit<FocusLink, "id">;
  title?: string;
  compact?: boolean;
}

export function AddToFocusButton({ link, title, compact }: AddToFocusButtonProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const items = useFocusStore((s) => s.items);
  const activeItems = items.filter((i) => !i.archived);
  const pinFromFeed = useFocusStore((s) => s.pinFromFeed);
  const addLink = useFocusStore((s) => s.addLink);
  const openItem = useFocusStore((s) => s.openItem);
  const isLinked = useFocusStore((s) => s.isLinked);
  const setActivePanel = useLayoutStore((s) => s.setActivePanel);

  const alreadyLinked = link.sourceId ? isLinked(link.sourceId, link.source) : false;

  // Position dropdown relative to button
  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) updatePos();
    setOpen(!open);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePos();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, updatePos]);

  const handleNewItem = () => {
    const id = pinFromFeed(link, title ?? link.label);
    setOpen(false);
    setActivePanel("hub");
    openItem(id);
  };

  const handleAttach = (itemId: string) => {
    addLink(itemId, link);
    setOpen(false);
    setActivePanel("hub");
    openItem(itemId);
  };

  if (alreadyLinked) {
    const linkedItem = items.find((i) => !i.archived && i.links.some((l) => l.sourceId === link.sourceId && l.source === link.source));
    return (
      <button
        className={`${styles.btn} ${styles.linked}`}
        title="Go to Focus Item"
        onClick={(e) => {
          e.stopPropagation();
          if (linkedItem) {
            setActivePanel("hub");
            openItem(linkedItem.id);
          }
        }}
      >
        <Target size={compact ? 11 : 12} />
        {!compact && <span>Focused</span>}
      </button>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        className={styles.btn}
        onClick={handleToggle}
        title="Add to Focus"
      >
        <Target size={compact ? 11 : 12} />
        {!compact && <span>Focus</span>}
        {activeItems.length > 0 && <ChevronDown size={8} />}
      </button>
      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: pos.top, left: pos.left }}
        >
          <button className={styles.newItem} onClick={handleNewItem}>
            <Plus size={10} />
            <span>New Focus Item</span>
          </button>
          {activeItems.length > 0 && (
            <>
              <div className={styles.divider} />
              <div className={styles.dropdownLabel}>Attach to existing</div>
              {activeItems.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  className={styles.existingItem}
                  onClick={() => handleAttach(item.id)}
                >
                  <span className={styles.existingTitle}>{item.title}</span>
                  <span className={styles.existingCount}>{item.links.length} links</span>
                </button>
              ))}
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
