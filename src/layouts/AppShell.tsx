import React, { useRef, useEffect, useState, useCallback } from "react";
import { useUIStore } from "../store/uiStore";
import { useConfirmStore } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import { RepoRail } from "../components/rail/RepoRail";
import { Toolbar } from "../components/toolbar/Toolbar";
import { CommitBar } from "../components/staging/CommitBar";
import { CommitGraph } from "../components/graph/CommitGraph";
import { StagingArea } from "../components/staging/StagingArea";
import { ContextPanel } from "../components/context/ContextPanel";
import { CommandLog } from "../components/commandlog/CommandLog";
import { ConflictEditor } from "../components/conflict/ConflictEditor";
import { StashManager } from "../components/stash/StashManager";
import { PullRequestsView } from "../components/pullrequests/PullRequestsView";
import { BranchCreateDialog } from "../components/branches/BranchCreateDialog";
import { MergeDialog } from "../components/branches/MergeDialog";
import { RebaseDialog } from "../components/branches/RebaseDialog";
import { CreateTagDialog } from "../components/branches/CreateTagDialog";
import { InteractiveRebaseDialog } from "../components/branches/InteractiveRebaseDialog";
import { StashPushDialog } from "../components/stash/StashPushDialog";
import { AboutDialog } from "../components/about/AboutDialog";
import { BlameView } from "../components/blame/BlameView";
import { FileHistoryView } from "../components/graph/FileHistoryView";
import { SettingsPage } from "../components/settings/SettingsPage";
import { ContextMenu } from "../components/ContextMenu";
import { AIChat } from "../components/ai/AIChat";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useRepoChangeListener, useRepoInfo } from "../hooks/useRepository";
import { useCommandLogStore } from "../store/commandLogStore";
import { useIpcEvent } from "../hooks/useIpcEvent";
import { useContinueRebase, useAbortRebase } from "../hooks/useBranches";
import { ipc, toErrMsg } from "../lib/ipc";
import { queryClient } from "../lib/queryClient";
import { useSettingsStore } from "../store/settingsStore";
import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import type { CommandLogEntry } from "../types/git";

function RebaseActionBar() {
  const { setActiveView } = useUIStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const continueRebase = useContinueRebase();
  const abortRebase = useAbortRebase();

  return (
    <div style={{
      padding: "6px 12px",
      background: "rgba(255,152,0,0.08)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: "var(--warning)", flex: 1 }}>
        Rebase in progress — resolve conflicts, then continue
      </span>
      <button
        onClick={() => showConfirm({ title: "Abort Rebase", message: "Abort the current rebase? All changes made during the rebase will be discarded.", danger: true, confirmLabel: "Abort", onConfirm: () => abortRebase.mutate() })}
        disabled={abortRebase.isPending}
        style={{ padding: "4px 10px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
      >
        Abort
      </button>
      <button
        onClick={() => continueRebase.mutate(undefined, { onSuccess: (o) => { if (o.type === "Success") setActiveView("graph"); } })}
        disabled={continueRebase.isPending}
        style={{ padding: "4px 10px", fontSize: 11, borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 500 }}
      >
        {continueRebase.isPending ? "Continuing…" : "Continue Rebase"}
      </button>
    </div>
  );
}

function CherryPickActionBar() {
  const { setActiveView } = useUIStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const addToast = useToastStore((s) => s.addToast);
  const [aborting, setAborting] = useState(false);
  const [continuing, setContinuing] = useState(false);

  const handleAbort = async () => {
    setAborting(true);
    try {
      await ipc.cherryPickAbort();
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["repo"] });
      setActiveView("graph");
    } catch {
      setAborting(false);
    }
  };

  const handleContinue = async () => {
    setContinuing(true);
    try {
      const outcome = await ipc.cherryPickContinue();
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["repo"] });
      if (outcome.type === "Success") setActiveView("graph");
    } catch (e) {
      setContinuing(false);
      addToast(`Cherry-pick continue failed: ${toErrMsg(e)}`, "error");
    }
  };

  return (
    <div style={{
      padding: "6px 12px",
      background: "rgba(255,152,0,0.08)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: "var(--warning)", flex: 1 }}>
        Cherry-pick in progress — resolve conflicts, then continue, or abort
      </span>
      <button
        onClick={() => showConfirm({ title: "Abort Cherry-Pick", message: "Abort the current cherry-pick? All changes made during the cherry-pick will be discarded.", danger: true, confirmLabel: "Abort", onConfirm: handleAbort })}
        disabled={aborting}
        style={{ padding: "4px 10px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
      >
        {aborting ? "Aborting…" : "Abort"}
      </button>
      <button
        onClick={handleContinue}
        disabled={continuing}
        style={{ padding: "4px 10px", fontSize: 11, borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 500 }}
      >
        {continuing ? "Continuing…" : "Continue Cherry-Pick"}
      </button>
    </div>
  );
}

function ResizeDivider({ onDelta }: { onDelta: (dx: number, done?: boolean) => void }) {
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    let last = e.clientX;
    const onMove = (ev: MouseEvent) => {
      onDelta(ev.clientX - last);
      last = ev.clientX;
    };
    const onUp = () => {
      setDragging(false);
      onDelta(0, true);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [onDelta]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`resize-divider${dragging ? " dragging" : ""}`}
    />
  );
}

function ViewSwitch({ activeView }: { activeView: string }) {
  switch (activeView) {
    case "graph":
      return (
        <ErrorBoundary label="Graph error">
          <CommitGraph />
        </ErrorBoundary>
      );
    case "staging":
      return (
        <ErrorBoundary label="Staging error">
          <StagingArea />
        </ErrorBoundary>
      );
    case "conflicts":
      return (
        <ErrorBoundary label="Conflict editor error">
          <ConflictEditor />
        </ErrorBoundary>
      );
    case "stash":
      return (
        <ErrorBoundary label="Stash error">
          <StashManager />
        </ErrorBoundary>
      );
    case "pull-requests":
      return (
        <ErrorBoundary label="Pull requests error">
          <PullRequestsView />
        </ErrorBoundary>
      );
    case "blame":
      return <BlameView />;
    case "file-history":
      return <FileHistoryView />;
    case "settings":
      return <SettingsPage />;
    default:
      return null;
  }
}

export function AppShell() {
  const {
    activeView, railCollapsed, commandLogOpen, commandLogHeight,
    activeDialog, railWidth, contextPanelWidth, setRailWidth, setContextPanelWidth,
    setActiveView,
  } = useUIStore();
  const pushEntry = useCommandLogStore((s) => s.pushEntry);
  const { data: repoInfo } = useRepoInfo();

  const isCherryPicking = repoInfo?.state === "cherry-pick";

  useRepoChangeListener();
  useIpcEvent<CommandLogEntry>("command-log", pushEntry);

  const checkUpdatesOnStartup = useSettingsStore((s) => s.checkUpdatesOnStartup);
  const updateChecked = useRef(false);
  useEffect(() => {
    if (!checkUpdatesOnStartup || updateChecked.current) return;
    updateChecked.current = true;
    checkUpdate().then((u) => { if (u) setActiveView("settings"); }).catch(() => {});
  }, []);

  const isRebasing = repoInfo?.state === "rebase";

  const railRef = useRef(railWidth);
  const ctxRef = useRef(contextPanelWidth);

  useEffect(() => {
    document.documentElement.style.setProperty("--rail-dyn", `${railWidth}px`);
    railRef.current = railWidth;
  }, [railWidth]);

  useEffect(() => {
    document.documentElement.style.setProperty("--ctx-dyn", `${contextPanelWidth}px`);
    ctxRef.current = contextPanelWidth;
  }, [contextPanelWidth]);

  const handleRailDelta = useCallback((dx: number, done?: boolean) => {
    railRef.current = Math.max(160, Math.min(420, railRef.current + dx));
    document.documentElement.style.setProperty("--rail-dyn", `${railRef.current}px`);
    if (done) setRailWidth(railRef.current);
  }, [setRailWidth]);

  const handleCtxDelta = useCallback((dx: number, done?: boolean) => {
    ctxRef.current = Math.max(200, Math.min(600, ctxRef.current - dx));
    document.documentElement.style.setProperty("--ctx-dyn", `${ctxRef.current}px`);
    if (done) setContextPanelWidth(ctxRef.current);
  }, [setContextPanelWidth]);

  return (
    <div className="app-shell" onContextMenu={(e) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea") e.preventDefault();
    }}>
      {/* Left Rail */}
      <div style={{
        width: railCollapsed ? 48 : "var(--rail-dyn)",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
      }}>
        <RepoRail />
      </div>

      {!railCollapsed && <ResizeDivider onDelta={handleRailDelta} />}

      {/* Main Column */}
      <div className="main-area" style={{ position: "relative" }}>
        {/* Progress bar at top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 100, pointerEvents: "none" }} />

        <Toolbar />
        <div style={{ overflow: "hidden", position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
          <div key={activeView} className="view-enter" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <ViewSwitch activeView={activeView} />
            {activeView === "conflicts" && isRebasing && <RebaseActionBar />}
            {activeView === "conflicts" && isCherryPicking && <CherryPickActionBar />}
          </div>
        </div>
        {activeView !== "staging" && activeView !== "settings" && <CommitBar />}

        {commandLogOpen && <CommandLog height={commandLogHeight} />}
      </div>

      {/* Context resize handle + panel */}
      {activeView === "graph" && (
        <>
          <ResizeDivider onDelta={handleCtxDelta} />
          <div style={{
            width: "var(--ctx-dyn)",
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}>
            <ContextPanel />
          </div>
        </>
      )}

      {/* Dialogs */}
      {activeDialog === "branch-create" && <BranchCreateDialog />}
      {activeDialog === "merge" && <MergeDialog />}
      {activeDialog === "rebase" && <RebaseDialog />}
      {activeDialog === "tag-create" && <CreateTagDialog />}
      {activeDialog === "interactive-rebase" && <InteractiveRebaseDialog />}
      {activeDialog === "stash-push" && <StashPushDialog />}
      {activeDialog === "about" && <AboutDialog />}
      <ContextMenu />
      <AIChat />
      <ConfirmDialog />
    </div>
  );
}
