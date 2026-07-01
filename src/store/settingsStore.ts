import { create } from "zustand";

interface Settings {
  defaultDiffMode: "unified" | "split";
  defaultBranchName: string;
  checkUpdatesOnStartup: boolean;
}

const KEY = "gitflow:settings";

const defaults: Settings = {
  defaultDiffMode: "unified",
  defaultBranchName: "main",
  checkUpdatesOnStartup: true,
};

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

interface SettingsStore extends Settings {
  patch: (values: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...load(),
  patch: (values) =>
    set((s) => {
      const next = { ...s, ...values };
      localStorage.setItem(KEY, JSON.stringify({
        defaultDiffMode: next.defaultDiffMode,
        defaultBranchName: next.defaultBranchName,
        checkUpdatesOnStartup: next.checkUpdatesOnStartup,
      }));
      return next;
    }),
}));
