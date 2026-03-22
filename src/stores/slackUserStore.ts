import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SlackUser {
  id: string;
  name: string;
  displayName: string;
  /** DM channel ID if we've seen one */
  dmChannelId?: string;
}

interface SlackUserStore {
  users: SlackUser[];
  lastFetched: string | null;

  setUsers: (users: SlackUser[]) => void;
  upsertUser: (user: SlackUser) => void;
  setDmChannel: (userId: string, channelId: string) => void;
  getByName: (query: string) => SlackUser[];
}

export const useSlackUserStore = create<SlackUserStore>()(
  persist(
    (set, get) => ({
      users: [],
      lastFetched: null,

      setUsers: (users) => set({ users, lastFetched: new Date().toISOString() }),

      upsertUser: (user) =>
        set((s) => {
          const existing = s.users.findIndex((u) => u.id === user.id);
          if (existing >= 0) {
            const next = [...s.users];
            next[existing] = { ...next[existing], ...user };
            return { users: next };
          }
          return { users: [...s.users, user] };
        }),

      setDmChannel: (userId, channelId) =>
        set((s) => ({
          users: s.users.map((u) =>
            u.id === userId ? { ...u, dmChannelId: channelId } : u,
          ),
        })),

      getByName: (query) => {
        if (!query.trim()) return get().users.slice(0, 10);
        const q = query.toLowerCase();
        return get().users
          .filter((u) =>
            u.name.toLowerCase().includes(q) ||
            u.displayName.toLowerCase().includes(q)
          )
          .slice(0, 8);
      },
    }),
    { name: "daemon-slack-users" },
  ),
);
