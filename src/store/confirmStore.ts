import { create } from "zustand";

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmStore {
  dialog: ConfirmDialogState | null;
  showConfirm: (opts: Omit<ConfirmDialogState, "open">) => void;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmStore>((set) => ({
  dialog: null,
  showConfirm: (opts) =>
    set({ dialog: { ...opts, open: true } }),
  closeConfirm: () =>
    set({ dialog: null }),
}));
