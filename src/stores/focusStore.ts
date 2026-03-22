import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PanelId } from "./layoutStore";

// ── Types ──

export type FocusSource = "slack" | "gitlab" | "linear" | "datadog" | "todos";

/** A linked resource attached to a Focus Item */
export interface FocusLink {
  id: string;
  source: FocusSource;
  label: string;
  subtitle?: string;
  url?: string;
  /** Internal navigation */
  navigateTo?: PanelId;
  /** MR iid or Linear identifier */
  sourceId?: string;
  /** Branch name (GitLab) */
  sourceBranch?: string;
  /** Slack thread ref */
  slackRef?: { channelId: string; threadTs: string };
}

/** A checkable sub-task within a Focus Item */
export interface FocusTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

/** A free-text note */
export interface FocusNote {
  id: string;
  text: string;
  createdAt: string;
}

/** A timed reminder */
export interface FocusReminder {
  id: string;
  text: string;
  dueAt: string;
  fired: boolean;
  createdAt: string;
}

/** Agent dispatch record */
export interface FocusDispatch {
  id: string;
  personaId: string;
  taskId: string;
  dispatchedAt: string;
}

/** A Focus Item — the core unit of work */
export interface FocusItem {
  id: string;
  title: string;
  /** Compact color accent for the card */
  color?: string;
  createdAt: string;
  /** Archived / completed */
  archived: boolean;
  archivedAt?: string;

  links: FocusLink[];
  tasks: FocusTask[];
  notes: FocusNote[];
  reminders: FocusReminder[];

  /** Agent dispatch history (newest first) */
  dispatches: FocusDispatch[];
}

// ── Helpers ──

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Store ──

interface FocusStore {
  items: FocusItem[];
  /** ID of the item currently open in detail view (null = show feed) */
  activeItemId: string | null;

  // ── Item CRUD ──
  createItem: (title: string) => string;
  deleteItem: (id: string) => void;
  archiveItem: (id: string) => void;
  unarchiveItem: (id: string) => void;
  renameItem: (id: string, title: string) => void;
  reorderItems: (items: FocusItem[]) => void;

  // ── Links ──
  addLink: (itemId: string, link: Omit<FocusLink, "id">) => void;
  removeLink: (itemId: string, linkId: string) => void;

  // ── Tasks ──
  addTask: (itemId: string, title: string) => void;
  toggleTask: (itemId: string, taskId: string) => void;
  removeTask: (itemId: string, taskId: string) => void;
  renameTask: (itemId: string, taskId: string, title: string) => void;

  // ── Notes ──
  addNote: (itemId: string, text: string) => void;
  updateNote: (itemId: string, noteId: string, text: string) => void;
  removeNote: (itemId: string, noteId: string) => void;

  // ── Reminders ──
  addReminder: (itemId: string, text: string, dueAt: string) => void;
  fireReminder: (itemId: string, reminderId: string) => void;
  removeReminder: (itemId: string, reminderId: string) => void;

  // ── Agent dispatch ──
  addDispatch: (itemId: string, personaId: string, taskId: string) => void;

  // ── Navigation ──
  openItem: (id: string) => void;
  closeItem: () => void;

  // ── Lookup ──
  /** Find the Focus Item that owns a given agent task ID */
  getItemByTaskId: (taskId: string) => FocusItem | undefined;

  // ── Quick pin from feed (creates item with one link) ──
  pinFromFeed: (link: Omit<FocusLink, "id">, title?: string) => string;

  // ── Check if a feed item is linked in any focus item ──
  isLinked: (sourceId: string, source: FocusSource) => boolean;

  // ── Computed ──
  getItem: (id: string) => FocusItem | undefined;
  activeItems: () => FocusItem[];
  archivedItems: () => FocusItem[];
}

// ── Helper to update a single item ──
function updateItem(
  items: FocusItem[],
  id: string,
  updater: (item: FocusItem) => FocusItem,
): FocusItem[] {
  return items.map((i) => (i.id === id ? updater(i) : i));
}

export const useFocusStore = create<FocusStore>()(
  persist(
    (set, get) => ({
      items: [],
      activeItemId: null,

      // ── Item CRUD ──

      createItem: (title) => {
        const id = genId("focus");
        const item: FocusItem = {
          id,
          title,
          createdAt: new Date().toISOString(),
          archived: false,
          links: [],
          tasks: [],
          notes: [],
          reminders: [],
          dispatches: [],
        };
        set((s) => ({ items: [item, ...s.items] }));
        return id;
      },

      deleteItem: (id) =>
        set((s) => ({
          items: s.items.filter((i) => i.id !== id),
          activeItemId: s.activeItemId === id ? null : s.activeItemId,
        })),

      archiveItem: (id) =>
        set((s) => ({
          items: updateItem(s.items, id, (i) => ({
            ...i,
            archived: true,
            archivedAt: new Date().toISOString(),
          })),
        })),

      unarchiveItem: (id) =>
        set((s) => ({
          items: updateItem(s.items, id, (i) => ({
            ...i,
            archived: false,
            archivedAt: undefined,
          })),
        })),

      renameItem: (id, title) =>
        set((s) => ({
          items: updateItem(s.items, id, (i) => ({ ...i, title })),
        })),

      reorderItems: (items) => set({ items }),

      // ── Links ──

      addLink: (itemId, link) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            links: [...i.links, { ...link, id: genId("link") }],
          })),
        })),

      removeLink: (itemId, linkId) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            links: i.links.filter((l) => l.id !== linkId),
          })),
        })),

      // ── Tasks ──

      addTask: (itemId, title) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            tasks: [
              ...i.tasks,
              { id: genId("task"), title, done: false, createdAt: new Date().toISOString() },
            ],
          })),
        })),

      toggleTask: (itemId, taskId) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            tasks: i.tasks.map((t) =>
              t.id === taskId
                ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined }
                : t,
            ),
          })),
        })),

      removeTask: (itemId, taskId) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            tasks: i.tasks.filter((t) => t.id !== taskId),
          })),
        })),

      renameTask: (itemId, taskId, title) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            tasks: i.tasks.map((t) => (t.id === taskId ? { ...t, title } : t)),
          })),
        })),

      // ── Notes ──

      addNote: (itemId, text) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            notes: [...i.notes, { id: genId("note"), text, createdAt: new Date().toISOString() }],
          })),
        })),

      updateNote: (itemId, noteId, text) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            notes: i.notes.map((n) => (n.id === noteId ? { ...n, text } : n)),
          })),
        })),

      removeNote: (itemId, noteId) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            notes: i.notes.filter((n) => n.id !== noteId),
          })),
        })),

      // ── Reminders ──

      addReminder: (itemId, text, dueAt) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            reminders: [
              ...i.reminders,
              { id: genId("rem"), text, dueAt, fired: false, createdAt: new Date().toISOString() },
            ],
          })),
        })),

      fireReminder: (itemId, reminderId) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            reminders: i.reminders.map((r) =>
              r.id === reminderId ? { ...r, fired: true } : r,
            ),
          })),
        })),

      removeReminder: (itemId, reminderId) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            reminders: i.reminders.filter((r) => r.id !== reminderId),
          })),
        })),

      // ── Agent dispatch ──

      addDispatch: (itemId, personaId, taskId) =>
        set((s) => ({
          items: updateItem(s.items, itemId, (i) => ({
            ...i,
            dispatches: [
              { id: genId("disp"), personaId, taskId, dispatchedAt: new Date().toISOString() },
              ...i.dispatches,
            ],
          })),
        })),

      // ── Navigation ──

      openItem: (id) => set({ activeItemId: id }),
      closeItem: () => set({ activeItemId: null }),

      // ── Quick pin from feed ──

      pinFromFeed: (link, title) => {
        const id = genId("focus");
        const item: FocusItem = {
          id,
          title: title ?? link.label,
          createdAt: new Date().toISOString(),
          archived: false,
          links: [{ ...link, id: genId("link") }],
          tasks: [],
          notes: [],
          reminders: [],
          dispatches: [],
        };
        set((s) => ({ items: [item, ...s.items] }));
        return id;
      },

      // ── Query helpers ──

      isLinked: (sourceId, source) => {
        return get().items.some((item) =>
          !item.archived && item.links.some((l) => l.sourceId === sourceId && l.source === source),
        );
      },

      getItem: (id) => get().items.find((i) => i.id === id),

      getItemByTaskId: (taskId) =>
        get().items.find((item) => item.dispatches.some((d) => d.taskId === taskId)),

      activeItems: () => get().items.filter((i) => !i.archived),

      archivedItems: () => get().items.filter((i) => i.archived),
    }),
    {
      name: "daemon-focus-v2",
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<{ items: unknown[] }> | undefined;
        const items = (p?.items ?? []) as (FocusItem & { dispatch?: { personaId: string; taskId: string; dispatchedAt: string } })[];
        // Migrate: ensure every item has `dispatches` array
        const migrated = items.map((item) => ({
          ...item,
          dispatches: item.dispatches ?? (item.dispatch ? [{ id: `migrated-${Date.now()}`, ...item.dispatch }] : []),
          links: item.links ?? [],
          tasks: item.tasks ?? [],
          notes: item.notes ?? [],
          reminders: item.reminders ?? [],
        }));
        return { ...current, items: migrated as FocusItem[] };
      },
    },
  ),
);
