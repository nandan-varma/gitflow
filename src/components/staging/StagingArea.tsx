import React from "react";
import { useFileStatus } from "../../hooks/useFileStatus";
import { useUIStore } from "../../store/uiStore";
import { useDiffWorkdir, useDiffStaged } from "../../hooks/useDiff";
import { FileStatusList } from "./FileStatusList";
import { DiffView } from "../diff/DiffView";
import { CommitEditor } from "../commit/CommitEditor";
import { ipc } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";

export function StagingArea() {
  const { data: status = [] } = useFileStatus();
  const { selectedFilePath, selectedFileMode, selectFile } = useUIStore();

  const unstagedFiles = status.filter((f) => f.unstaged && !f.conflict);
  const stagedFiles = status.filter((f) => f.staged);

  const { data: workdirDiff } = useDiffWorkdir(selectedFilePath);
  const { data: stagedDiff } = useDiffStaged(selectedFilePath);

  const selectedFileStatus = status.find((f) => f.path === selectedFilePath);
  const hasStaged = selectedFileStatus?.staged && stagedDiff;
  const hasUnstaged = selectedFileStatus?.unstaged && workdirDiff;
  const hasBoth = hasStaged && hasUnstaged;

  const showMode: "staged" | "workdir" = selectedFileMode === "staged" || (selectedFileMode !== "workdir" && hasStaged)
    ? "staged"
    : "workdir";

  const stageAll = async () => {
    await ipc.stageFiles(unstagedFiles.map((f) => f.path));
    queryClient.invalidateQueries({ queryKey: ["status"] });
    queryClient.invalidateQueries({ queryKey: ["diff"] });
  };

  const unstageAll = async () => {
    await ipc.unstageFiles(stagedFiles.map((f) => f.path));
    queryClient.invalidateQueries({ queryKey: ["status"] });
    queryClient.invalidateQueries({ queryKey: ["diff"] });
  };

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* File lists */}
      <div
        style={{
          width: 240,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, borderBottom: "1px solid var(--border)", overflow: "hidden" }}>
          <FileStatusList files={unstagedFiles} staged={false} onStageAll={stageAll} />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <FileStatusList files={stagedFiles} staged={true} onUnstageAll={unstageAll} />
        </div>
      </div>

      {/* Diff + commit */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {selectedFilePath && hasBoth && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-surface)",
                flexShrink: 0,
                padding: "0 12px",
              }}
            >
              <button
                onClick={() => selectFile(selectedFilePath, "staged")}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: showMode === "staged" ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: showMode === "staged" ? "2px solid var(--accent)" : "2px solid transparent",
                  letterSpacing: "0.02em",
                }}
              >
                Staged
              </button>
              <button
                onClick={() => selectFile(selectedFilePath, "workdir")}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: showMode === "workdir" ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: showMode === "workdir" ? "2px solid var(--accent)" : "2px solid transparent",
                  letterSpacing: "0.02em",
                }}
              >
                Unstaged
              </button>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            {showMode === "staged" && hasStaged && (
              <DiffView diff={stagedDiff!} path={selectedFilePath!} mode="staged" />
            )}
            {showMode === "workdir" && hasUnstaged && (
              <DiffView diff={workdirDiff!} path={selectedFilePath!} mode="workdir" />
            )}
            {!selectedFilePath && (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Select a file to view diff
              </div>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <CommitEditor />
        </div>
      </div>
    </div>
  );
}
