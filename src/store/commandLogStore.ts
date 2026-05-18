import { create } from "zustand";
import type { CommandLogEntry } from "../types/git";

const MAX_ENTRIES = 500;

interface CommandLogStore {
  entries: CommandLogEntry[];
  pushEntry: (entry: CommandLogEntry) => void;
  clearLog: () => void;
}

export const useCommandLogStore = create<CommandLogStore>((set) => ({
  entries: [],

  pushEntry: (entry: CommandLogEntry) =>
    set((state) => ({
      entries:
        state.entries.length >= MAX_ENTRIES
          ? [...state.entries.slice(1), entry]
          : [...state.entries, entry],
    })),

  clearLog: () => set({ entries: [] }),
}));
