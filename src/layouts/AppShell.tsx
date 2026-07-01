import React, { useRef, useEffect, useState, useCallback } from "react";
import { useUIStore } from "../store/uiStore";
import { RepoRail } from "../components/rail/RepoRail";
import { Toolbar } from "../components/toolbar/Toolbar";
import { CommitBar } from "../components/staging/CommitBar";
import { CommitGraph } from "../components/graph/CommitGraph";
import { StagingArea } from "../components/staging/StagingArea";
import { ContextPanel } from "../components/context/ContextPanel";
import { CommandLog } from "../components/commandlog/CommandLog";
import { ConflictEditor } from "../components/conflict/ConflictEditor";
import { StashManager } from "../components/stash/StashManager";
import { BranchCreateDialog } from "../components/branches/BranchCreateDialog";
import { MergeDialog } from "../components/branches/MergeDialog";
import { RebaseDialog } from "../components/branches/RebaseDialog";
import { StashPushDialog } from "../components/stash/StashPushDialog";
import { AboutDialog } from "../components/about/AboutDialog";
import { SettingsPage } from "../components/settings/SettingsPage";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useRepoChangeListener, useRepoInfo } from "../hooks/useRepository";
import { useCommandLogStore } from "../store/commandLogStore";
import { useIpcEvent } from "../hooks/useIpcEvent";
import { useContinueRebase, useAbortRebase } from "../hooks/useBranches";
import { useSettingsStore } from "../store/settingsStore";
import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import type { CommandLogEntry } from "../types/git";

function RebaseActionBar() {
  const { setActiveView } = useUIStore();
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
        onClick={() => abortRebase.mutate()}
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

export function AppShell() {
  const {
    activeView, railCollapsed, commandLogOpen, commandLogHeight,
    activeDialog, railWidth, contextPanelWidth, setRailWidth, setContextPanelWidth,
    setActiveView,
  } = useUIStore();
  const pushEntry = useCommandLogStore((s) => s.pushEntry);
  const { data: repoInfo } = useRepoInfo();

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

  // CSS vars drive width during drag (no React re-render per pixel)
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
    <div className="app-shell">
      {/* Left Rail */}
      <div style={{
        width: railCollapsed ? 48 : "var(--rail-dyn)",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        <RepoRail />
      </div>

      {/* Rail resize handle */}
      {!railCollapsed && <ResizeDivider onDelta={handleRailDelta} />}

      {/* Main Column */}
      <div className="main-area" style={{ position: "relative" }}>
        <Toolbar />
        <div style={{ overflow: "hidden", position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
          {activeView === "graph" && (
            <ErrorBoundary label="Graph error">
              <CommitGraph />
            </ErrorBoundary>
          )}
          {activeView === "staging" && (
            <ErrorBoundary label="Staging error">
              <StagingArea />
            </ErrorBoundary>
          )}
          {activeView === "conflicts" && (
            <ErrorBoundary label="Conflict editor error">
              <ConflictEditor />
              {isRebasing && <RebaseActionBar />}
            </ErrorBoundary>
          )}
          {activeView === "stash" && (
            <ErrorBoundary label="Stash error">
              <StashManager />
            </ErrorBoundary>
          )}
          {activeView === "settings" && <SettingsPage />}
        </div>
        <CommitBar />

        {commandLogOpen && <CommandLog height={commandLogHeight} />}
      </div>

      {/* Context resize handle */}
      <ResizeDivider onDelta={handleCtxDelta} />

      {/* Right Context Panel */}
      <div style={{
        width: "var(--ctx-dyn)",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        <ContextPanel />
      </div>

      {/* Dialogs */}
      {activeDialog === "branch-create" && <BranchCreateDialog />}
      {activeDialog === "merge" && <MergeDialog />}
      {activeDialog === "rebase" && <RebaseDialog />}
      {activeDialog === "stash-push" && <StashPushDialog />}
      {activeDialog === "about" && <AboutDialog />}
    </div>
  );
}
