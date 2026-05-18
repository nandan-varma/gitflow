import { create } from "zustand";

interface StagingStore {
  selectedLines: Set<string>;
  toggleLine: (key: string) => void;
  selectRange: (keys: string[]) => void;
  clearSelection: () => void;
  isSelected: (key: string) => boolean;
}

export const useStagingStore = create<StagingStore>((set, get) => ({
  selectedLines: new Set(),

  toggleLine: (key: string) => {
    const next = new Set(get().selectedLines);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    set({ selectedLines: next });
  },

  selectRange: (keys: string[]) => {
    const next = new Set(get().selectedLines);
    keys.forEach((k) => next.add(k));
    set({ selectedLines: next });
  },

  clearSelection: () => set({ selectedLines: new Set() }),

  isSelected: (key: string) => get().selectedLines.has(key),
}));
