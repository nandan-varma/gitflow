import { create } from "zustand";
import { ipc } from "../lib/ipc";

const LEGACY_SETTINGS_KEY = "gitflow:settings";

interface AiKeyStore {
  apiKey: string;
  loaded: boolean;
  setApiKey: (key: string) => void;
  load: () => Promise<void>;
}

/**
 * Pulls a legacy plaintext `aiApiKey` out of a serialized settings blob (if
 * present) and returns the key alongside the blob with that field removed.
 * Pure JSON logic, split out from the localStorage I/O below so it's
 * testable without a DOM environment.
 */
export function extractLegacyApiKey(rawSettingsJson: string | null): { legacy: string | null; scrubbedJson: string | null } {
  if (!rawSettingsJson) return { legacy: null, scrubbedJson: null };
  try {
    const parsed = JSON.parse(rawSettingsJson) as Record<string, unknown>;
    const legacy = parsed.aiApiKey;
    if (typeof legacy !== "string" || legacy === "") return { legacy: null, scrubbedJson: null };
    delete parsed.aiApiKey;
    return { legacy, scrubbedJson: JSON.stringify(parsed) };
  } catch {
    return { legacy: null, scrubbedJson: null };
  }
}

/**
 * One-time migration: earlier versions stored the AI API key in plaintext
 * inside localStorage's settings blob. Pull it out, hand it to the keychain,
 * and scrub it from localStorage so it doesn't linger there afterward.
 */
function takeLegacyApiKey(): string | null {
  const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
  const { legacy, scrubbedJson } = extractLegacyApiKey(raw);
  if (legacy && scrubbedJson) localStorage.setItem(LEGACY_SETTINGS_KEY, scrubbedJson);
  return legacy;
}

export const useAiKeyStore = create<AiKeyStore>((set) => ({
  apiKey: "",
  loaded: false,

  setApiKey: (key) => {
    // Optimistic: the input stays responsive while the keychain write
    // happens in the background.
    set({ apiKey: key });
    ipc.setAiApiKey(key).catch((e) => console.error("Failed to save AI API key:", e));
  },

  load: async () => {
    try {
      const stored = await ipc.getAiApiKey();
      if (stored) {
        set({ apiKey: stored, loaded: true });
        return;
      }
      const legacy = takeLegacyApiKey();
      if (legacy) {
        await ipc.setAiApiKey(legacy);
        set({ apiKey: legacy, loaded: true });
        return;
      }
      set({ loaded: true });
    } catch (e) {
      console.error("Failed to load AI API key:", e);
      set({ loaded: true });
    }
  },
}));
