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
  const { selectedFilePath } = useUIStore();

  const unstagedFiles = status.filter((f) => f.unstaged && !f.conflict);
  const stagedFiles = status.filter((f) => f.staged);

  const { data: workdirDiff } = useDiffWorkdir(selectedFilePath);
  const { data: stagedDiff } = useDiffStaged(selectedFilePath);

  const selectedFileStatus = status.find((f) => f.path === selectedFilePath);
  const showWorkdirDiff = selectedFileStatus?.unstaged && workdirDiff;
  const showStagedDiff = selectedFileStatus?.staged && stagedDiff;

  const stageAll = async () => {
    await Promise.all(unstagedFiles.map((f) => ipc.stageFile(f.path)));
    queryClient.invalidateQueries({ queryKey: ["status"] });
    queryClient.invalidateQueries({ queryKey: ["diff"] });
  };

  const unstageAll = async () => {
    await Promise.all(stagedFiles.map((f) => ipc.unstageFile(f.path)));
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
        <div style={{ flex: 1, overflow: "hidden" }}>
          {showWorkdirDiff && <DiffView diff={workdirDiff} path={selectedFilePath!} mode="workdir" />}
          {showStagedDiff && !showWorkdirDiff && <DiffView diff={stagedDiff} path={selectedFilePath!} mode="staged" />}
          {!selectedFilePath && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Select a file to view diff
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          <CommitEditor />
        </div>
      </div>
    </div>
  );
}
