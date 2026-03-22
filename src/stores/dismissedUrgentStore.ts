import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DismissedUrgentStore {
  /** Set of feed item IDs whose urgency has been dismissed */
  dismissedIds: Set<string>;
  dismiss: (id: string) => void;
  isDismissed: (id: string) => boolean;
  /** Clear old dismissals (call periodically) */
  clear: () => void;
}

export const useDismissedUrgentStore = create<DismissedUrgentStore>()(
  persist(
    (set, get) => ({
      dismissedIds: new Set(),
      dismiss: (id) =>
        set((s) => {
          const next = new Set(s.dismissedIds);
          next.add(id);
          return { dismissedIds: next };
        }),
      isDismissed: (id) => get().dismissedIds.has(id),
      clear: () => set({ dismissedIds: new Set() }),
    }),
    {
      name: "daemon-dismissed-urgent",
      partialize: (state) => ({ dismissedIds: [...state.dismissedIds] }),
      merge: (persisted: unknown, current) => {
        const p = persisted as { dismissedIds?: string[] } | undefined;
        return { ...current, dismissedIds: new Set(p?.dismissedIds ?? []) };
      },
    },
  ),
);
