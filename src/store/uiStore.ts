import { create } from "zustand";
import type { MenuItem } from "../types/contextMenu";

type ActiveView = "graph" | "staging" | "diff" | "conflicts" | "stash" | "settings" | "pull-requests" | "blame" | "file-history";
type ActiveDialog = null | "branch-create" | "merge" | "rebase" | "stash-push" | "branch-delete" | "about" | "tag-create" | "interactive-rebase";

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
  cherryPickInProgress: boolean;
  cherryPickOid: string | null;
  contextMenu: { x: number; y: number; items: MenuItem[] } | null;
  graphSearch: string;
  blameFilePath: string | null;
  fileHistoryPath: string | null;

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
  setCherryPickInProgress: (v: boolean, oid?: string | null) => void;
  showContextMenu: (x: number, y: number, items: MenuItem[]) => void;
  hideContextMenu: () => void;
  setGraphSearch: (q: string) => void;
  openBlame: (path: string) => void;
  openFileHistory: (path: string) => void;
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
  cherryPickInProgress: false,
  cherryPickOid: null,
  contextMenu: null,
  graphSearch: "",
  blameFilePath: null,
  fileHistoryPath: null,

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
  setCherryPickInProgress: (cherryPickInProgress, oid = null) => set({ cherryPickInProgress, cherryPickOid: oid }),
  showContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  hideContextMenu: () => set({ contextMenu: null }),
  setGraphSearch: (graphSearch) => set({ graphSearch }),
  openBlame: (blameFilePath) => set({ blameFilePath, activeView: "blame" }),
  openFileHistory: (fileHistoryPath) => set({ fileHistoryPath, activeView: "file-history" }),
}));
