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
import { StashPushDialog } from "../components/stash/StashPushDialog";
import { useRepoChangeListener } from "../hooks/useRepository";
import { useCommandLogStore } from "../store/commandLogStore";
import { useIpcEvent } from "../hooks/useIpcEvent";
import type { CommandLogEntry } from "../types/git";

export function AppShell() {
  const { activeView, railCollapsed, commandLogOpen, commandLogHeight, activeDialog } = useUIStore();
  const pushEntry = useCommandLogStore((s) => s.pushEntry);

  useRepoChangeListener();
  useIpcEvent<CommandLogEntry>("command-log", pushEntry);

  return (
    <div className={`app-shell${railCollapsed ? " rail-collapsed" : ""}`} style={{ position: "relative" }}>
      {/* Left Rail */}
      <RepoRail />

      {/* Main Column */}
      <div className="main-area" style={{ position: "relative" }}>
        <Toolbar />
        <div style={{ overflow: "hidden", position: "relative" }}>
          {activeView === "graph" && <CommitGraph />}
          {activeView === "staging" && <StagingArea />}
          {activeView === "conflicts" && <ConflictEditor />}
          {activeView === "stash" && <StashManager />}
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
      {activeDialog === "stash-push" && <StashPushDialog />}
    </div>
  );
}
