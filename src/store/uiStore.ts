import { create } from "zustand";

type ActiveView = "graph" | "staging" | "diff" | "conflicts" | "stash" | "settings";
type ActiveDialog = null | "branch-create" | "merge" | "rebase" | "stash-push" | "branch-delete" | "about";

interface UIStore {
  activeView: ActiveView;
  selectedCommitOid: string | null;
  selectedFilePath: string | null;
  diffMode: "unified" | "split";
  commandLogOpen: boolean;
  commandLogHeight: number;
  railWidth: number;
  contextPanelWidth: number;
  railCollapsed: boolean;
  activeDialog: ActiveDialog;
  dialogPayload: unknown;
  amending: boolean;

  setActiveView: (view: ActiveView) => void;
  selectCommit: (oid: string | null) => void;
  selectFile: (path: string | null) => void;
  setDiffMode: (mode: "unified" | "split") => void;
  toggleCommandLog: () => void;
  setCommandLogHeight: (h: number) => void;
  setRailWidth: (w: number) => void;
  setContextPanelWidth: (w: number) => void;
  toggleRail: () => void;
  openDialog: (dialog: ActiveDialog, payload?: unknown) => void;
  closeDialog: () => void;
  setAmending: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeView: "graph",
  selectedCommitOid: null,
  selectedFilePath: null,
  diffMode: "unified",
  commandLogOpen: false,
  commandLogHeight: 180,
  railWidth: 220,
  contextPanelWidth: 320,
  railCollapsed: false,
  activeDialog: null,
  dialogPayload: null,
  amending: false,

  setActiveView: (activeView) => set({ activeView }),
  selectCommit: (selectedCommitOid) => set({ selectedCommitOid }),
  selectFile: (selectedFilePath) => set({ selectedFilePath }),
  setDiffMode: (diffMode) => set({ diffMode }),
  toggleCommandLog: () => set((s) => ({ commandLogOpen: !s.commandLogOpen })),
  setCommandLogHeight: (commandLogHeight) => set({ commandLogHeight }),
  setRailWidth: (railWidth) => set({ railWidth }),
  setContextPanelWidth: (contextPanelWidth) => set({ contextPanelWidth }),
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  openDialog: (activeDialog, payload = null) => set({ activeDialog, dialogPayload: payload }),
  closeDialog: () => set({ activeDialog: null, dialogPayload: null }),
  setAmending: (amending) => set({ amending }),
}));
