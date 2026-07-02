import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useUIStore } from "../store/uiStore";
import { useRepoStore } from "../store/repoStore";
import { useSettingsStore } from "../store/settingsStore";
import { useAIStore } from "../store/aiStore";
import { useToastStore } from "../store/toastStore";
import { useRepoInfo } from "./useRepository";
import { useBranches } from "./useBranches";
import { useFetch, usePush, usePull } from "./useRemote";
import { ipc } from "../lib/ipc";
import { setCommands, getCommands, matchesShortcut, isNativeMenuActive, isMac } from "../lib/commands";
import type { AppCommand } from "../lib/commands";

function applyZoom(factor: number) {
  const z = Math.round(Math.min(2, Math.max(0.5, factor)) * 10) / 10;
  try {
    getCurrentWebview().setZoom(z).catch(() => {});
  } catch {
    // not running inside Tauri (pnpm dev in a browser)
  }
  useSettingsStore.getState().patch({ zoomFactor: z });
}

/** Builds the app-wide command registry every render and installs the global
 *  shortcut listener + startup zoom once. Mounted a single time in AppShell. */
export function useAppCommands() {
  const { activeView, activeDialog, setActiveView, openDialog, closeDialog, toggleRail, toggleCommandLog, setDiffMode } = useUIStore();
  const { currentRepoPath, openRepository, closeRepository } = useRepoStore();
  const { codeEditor, terminalApp, zoomFactor } = useSettingsStore();
  const aiOpen = useAIStore((s) => s.open);
  const setAIOpen = useAIStore((s) => s.setOpen);
  const addToast = useToastStore((s) => s.addToast);
  const { refetch } = useRepoInfo();
  const { data: branches = [] } = useBranches();
  const fetch = useFetch();
  const push = usePush();
  const pull = usePull();

  const repoOpen = !!currentRepoPath;
  const currentBranch = branches.find((b) => b.is_head);

  const handleOpenRepo = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") openRepository(selected);
  };

  const commands: AppCommand[] = [
    { id: "open-repo", label: "Open Repository…", shortcut: "mod+o", enabled: true, run: handleOpenRepo },
    { id: "close-repo", label: "Close Repository", enabled: repoOpen, run: closeRepository },
    {
      id: "command-palette", label: "Command Palette", shortcut: "mod+k", enabled: true,
      run: () => (activeDialog === "command-palette" ? closeDialog() : openDialog("command-palette")),
    },
    {
      id: "settings", label: "Settings…", shortcut: "mod+,", enabled: true,
      run: () => setActiveView(activeView === "settings" ? "graph" : "settings"),
    },
    { id: "about", label: "About GitFlow Studio", enabled: true, run: () => openDialog("about") },

    { id: "view-graph", label: "Graph", shortcut: "mod+1", enabled: repoOpen, run: () => setActiveView("graph") },
    { id: "view-staging", label: "Staging", shortcut: "mod+2", enabled: repoOpen, run: () => setActiveView("staging") },
    { id: "view-stash", label: "Stashes", shortcut: "mod+3", enabled: repoOpen, run: () => setActiveView("stash") },
    { id: "view-prs", label: "Pull Requests", shortcut: "mod+4", enabled: repoOpen, run: () => setActiveView("pull-requests") },
    { id: "toggle-sidebar", label: "Toggle Sidebar", shortcut: "mod+b", enabled: true, run: toggleRail },
    { id: "toggle-command-log", label: "Toggle Command Log", shortcut: "mod+j", enabled: true, run: toggleCommandLog },
    { id: "toggle-ai", label: "Toggle AI Assistant", shortcut: "mod+l", enabled: true, run: () => setAIOpen(!aiOpen) },
    { id: "diff-unified", label: "Unified Diff", enabled: true, run: () => setDiffMode("unified") },
    { id: "diff-split", label: "Split Diff", enabled: true, run: () => setDiffMode("split") },
    { id: "zoom-in", label: "Zoom In", shortcut: "mod+=", enabled: true, run: () => applyZoom(zoomFactor + 0.1) },
    { id: "zoom-out", label: "Zoom Out", shortcut: "mod+-", enabled: true, run: () => applyZoom(zoomFactor - 0.1) },
    { id: "zoom-reset", label: "Actual Size", shortcut: "mod+0", enabled: true, run: () => applyZoom(1) },

    { id: "refresh", label: "Refresh", shortcut: "mod+r", enabled: repoOpen, run: () => refetch() },
    {
      id: "fetch", label: "Fetch", shortcut: "mod+shift+f", enabled: repoOpen,
      run: () => fetch.mutate(undefined, {
        onSuccess: () => addToast("Fetch complete", "success"),
        onError: () => addToast("Fetch failed", "error"),
      }),
    },
    {
      id: "push", label: "Push", shortcut: "mod+p", enabled: repoOpen,
      run: () => {
        if (!currentBranch) return addToast("No branch to push", "warning");
        if ((currentBranch.ahead ?? 0) === 0 && currentBranch.upstream) return addToast("Nothing to push", "info");
        push.mutate({ branch: currentBranch.name, setUpstream: !currentBranch.upstream }, {
          onSuccess: () => addToast("Push complete", "success"),
          onError: () => addToast("Push failed", "error"),
        });
      },
    },
    {
      id: "pull", label: "Pull", shortcut: "mod+shift+p", enabled: repoOpen,
      run: () => {
        if ((currentBranch?.behind ?? 0) === 0) return addToast("Already up to date", "info");
        pull.mutate(undefined, {
          onSuccess: () => addToast("Pull complete", "success"),
          onError: () => addToast("Pull failed", "error"),
        });
      },
    },

    { id: "new-branch", label: "New Branch…", shortcut: "mod+shift+n", enabled: repoOpen, run: () => openDialog("branch-create") },
    { id: "new-tag", label: "New Tag…", enabled: repoOpen, run: () => openDialog("tag-create", "HEAD") },
    { id: "stash-changes", label: "Stash Changes…", shortcut: "mod+shift+s", enabled: repoOpen, run: () => openDialog("stash-push") },

    { id: "open-vscode", label: "Open in VS Code", enabled: repoOpen, run: () => ipc.openInVscode("", codeEditor) },
    { id: "reveal-finder", label: "Reveal in Finder", enabled: repoOpen, run: () => ipc.revealInFinder("") },
    { id: "open-terminal", label: "Open in Terminal", enabled: repoOpen, run: () => ipc.openInTerminal("", terminalApp) },
  ];

  useEffect(() => setCommands(commands));

  // Global shortcut listener (once)
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const editing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      for (const c of getCommands()) {
        if (!c.shortcut || !matchesShortcut(e, c.shortcut)) continue;
        // Native macOS menu key equivalents fire first; don't double-run.
        if (isMac && isNativeMenuActive()) return;
        if (editing && !c.shortcut.includes("mod")) return;
        e.preventDefault();
        if (c.enabled) c.run();
        return;
      }
    };
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, []);

  // Apply persisted zoom on startup
  useEffect(() => {
    const z = useSettingsStore.getState().zoomFactor;
    if (z !== 1) applyZoom(z);
  }, []);
}
