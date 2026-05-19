import React from "react";
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
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useRepoChangeListener, useRepoInfo } from "../hooks/useRepository";
import { useCommandLogStore } from "../store/commandLogStore";
import { useIpcEvent } from "../hooks/useIpcEvent";
import { useContinueRebase, useAbortRebase } from "../hooks/useBranches";
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

export function AppShell() {
  const { activeView, railCollapsed, commandLogOpen, commandLogHeight, activeDialog } = useUIStore();
  const pushEntry = useCommandLogStore((s) => s.pushEntry);
  const { data: repoInfo } = useRepoInfo();

  useRepoChangeListener();
  useIpcEvent<CommandLogEntry>("command-log", pushEntry);

  const isRebasing = repoInfo?.state === "rebase";

  return (
    <div className={`app-shell${railCollapsed ? " rail-collapsed" : ""}`} style={{ position: "relative" }}>
      {/* Left Rail */}
      <RepoRail />

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
        </div>
        <CommitBar />

        {/* Command Log Drawer */}
        {commandLogOpen && (
          <CommandLog height={commandLogHeight} />
        )}
      </div>

      {/* Right Context Panel */}
      <ContextPanel />

      {/* Dialogs */}
      {activeDialog === "branch-create" && <BranchCreateDialog />}
      {activeDialog === "merge" && <MergeDialog />}
      {activeDialog === "rebase" && <RebaseDialog />}
      {activeDialog === "stash-push" && <StashPushDialog />}
    </div>
  );
}
