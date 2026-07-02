import { create } from "zustand";

interface Settings {
  theme: "system" | "light" | "dark";
  defaultDiffMode: "unified" | "split";
  defaultBranchName: string;
  checkUpdatesOnStartup: boolean;
  autoFetchEnabled: boolean;
  autoFetchMinutes: number;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  codeEditor: string;
  terminalApp: string;
  zoomFactor: number;
}

const KEY = "gitflow:settings";

const defaults: Settings = {
  theme: "system",
  defaultDiffMode: "unified",
  defaultBranchName: "main",
  checkUpdatesOnStartup: true,
  autoFetchEnabled: false,
  autoFetchMinutes: 10,
  aiBaseUrl: "https://api.openai.com/v1",
  aiModel: "",
  aiApiKey: "",
  codeEditor: "code",
  terminalApp: "Terminal",
  zoomFactor: 1,
};

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

function persist(s: Settings) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(defaults) as (keyof Settings)[]) out[k] = s[k];
  localStorage.setItem(KEY, JSON.stringify(out));
}

interface SettingsStore extends Settings {
  patch: (values: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...load(),
  patch: (values) =>
    set((s) => {
      const next = { ...s, ...values };
      persist(next);
      return next;
    }),
  reset: () =>
    set((s) => {
      const next = { ...s, ...defaults };
      persist(next);
      return next;
    }),
}));
