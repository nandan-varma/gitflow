import { create } from "zustand";

interface Settings {
  defaultDiffMode: "unified" | "split";
  defaultBranchName: string;
  checkUpdatesOnStartup: boolean;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
}

const KEY = "gitflow:settings";

const defaults: Settings = {
  defaultDiffMode: "unified",
  defaultBranchName: "main",
  checkUpdatesOnStartup: true,
  aiBaseUrl: "https://api.openai.com/v1",
  aiModel: "",
  aiApiKey: "",
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
        aiBaseUrl: next.aiBaseUrl,
        aiModel: next.aiModel,
        aiApiKey: next.aiApiKey,
      }));
      return next;
    }),
}));
