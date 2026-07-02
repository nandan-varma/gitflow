import { create } from "zustand";

export type ToastType = "info" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
  exiting: boolean;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, durationMs?: number) => void;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (message, type = "info", durationMs = 4000) => {
    const id = `toast_${nextId++}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, durationMs, exiting: false }] }));
    setTimeout(() => get().dismissToast(id), durationMs);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t)) }));
    setTimeout(() => get().removeToast(id), 200);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
