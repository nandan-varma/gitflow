import { create } from "zustand";
import type OpenAI from "openai";

export interface ToolCallStatus {
  id: string;
  name: string;
  args: string;
  status: "pending" | "running" | "success" | "error";
  result?: string;
  error?: string;
  startedAt: number;
  durationMs?: number;
}

const HISTORY_KEY = "gitflow:ai:history";

function saveMessages(msgs: OpenAI.ChatCompletionMessageParam[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-100)));
  } catch {
    /* storage full — silently drop */
  }
}

function loadMessages(): OpenAI.ChatCompletionMessageParam[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

interface AIStore {
  open: boolean;
  setOpen: (v: boolean) => void;

  messages: OpenAI.ChatCompletionMessageParam[];
  streamText: string | null;
  toolCalls: ToolCallStatus[];
  busy: boolean;
  error: string | null;

  addMessage: (msg: OpenAI.ChatCompletionMessageParam) => void;
  updateStream: (text: string | null) => void;
  startToolCall: (id: string, name: string, args: string) => void;
  runToolCall: (id: string) => void;
  completeToolCall: (id: string, result: string) => void;
  failToolCall: (id: string, error: string) => void;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  clearChat: () => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),

  messages: loadMessages(),
  streamText: null,
  toolCalls: [],
  busy: false,
  error: null,

  addMessage: (msg) => {
    const next = [...get().messages, msg];
    set({ messages: next });
    saveMessages(next);
  },

  updateStream: (streamText) => set({ streamText }),

  startToolCall: (id, name, args) => {
    const call: ToolCallStatus = { id, name, args, status: "pending", startedAt: Date.now() };
    set((s) => ({ toolCalls: [...s.toolCalls, call] }));
  },

  runToolCall: (id) => {
    set((s) => ({
      toolCalls: s.toolCalls.map((c) =>
        c.id === id ? { ...c, status: "running" as const, startedAt: Date.now() } : c,
      ),
    }));
  },

  completeToolCall: (id, result) => {
    set((s) => ({
      toolCalls: s.toolCalls.map((c) =>
        c.id === id
          ? { ...c, status: "success" as const, result, durationMs: Date.now() - c.startedAt }
          : c,
      ),
    }));
  },

  failToolCall: (id, error) => {
    set((s) => ({
      toolCalls: s.toolCalls.map((c) =>
        c.id === id
          ? { ...c, status: "error" as const, error, durationMs: Date.now() - c.startedAt }
          : c,
      ),
    }));
  },

  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),

  clearChat: () => {
    set({ messages: [], toolCalls: [], streamText: null, error: null });
    saveMessages([]);
  },
}));
