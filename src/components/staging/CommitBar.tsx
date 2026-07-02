import React from "react";
import { GitCommit, Layers } from "lucide-react";
import { useUIStore } from "../../store/uiStore";
import { useFileStatus } from "../../hooks/useFileStatus";
import { useRepoStore } from "../../store/repoStore";

export function CommitBar() {
  const { setActiveView, activeView } = useUIStore();
  const { data: status = [] } = useFileStatus();
  const { currentRepoPath } = useRepoStore();

  const staged = status.filter((f) => f.staged).length;
  const unstaged = status.filter((f) => f.unstaged && !f.staged).length;
  const conflicts = status.filter((f) => f.conflict).length;

  if (!currentRepoPath) return null;

  return (
    <div
      style={{
        height: "var(--commit-bar-height)",
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 12,
        userSelect: "none",
      }}
    >
      {conflicts > 0 && (
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 10,
            background: "rgba(244,67,54,0.2)",
            color: "var(--danger)",
            cursor: "pointer",
          }}
          onClick={() => setActiveView("conflicts")}
        >
          ⚠ {conflicts} conflict{conflicts !== 1 ? "s" : ""}
        </span>
      )}

      <button
        onClick={() => setActiveView("staging")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 4,
          background: activeView === "staging" ? "var(--bg-selected)" : "var(--bg-elevated)",
          color: staged > 0 ? "var(--success)" : "var(--text-muted)",
          fontSize: 12,
          border: "1px solid var(--border)",
        }}
      >
        <Layers size={13} />
        {staged} staged
      </button>

      {unstaged > 0 && (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {unstaged} unstaged
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button
        onClick={() => setActiveView("staging")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 14px",
          borderRadius: 5,
          background: staged > 0 ? "var(--accent)" : "var(--bg-elevated)",
          color: staged > 0 ? "#fff" : "var(--text-muted)",
          fontSize: 12,
          fontWeight: 500,
          border: `1px solid ${staged > 0 ? "transparent" : "var(--border)"}`,
        }}
      >
        <GitCommit size={13} />
        Commit
      </button>
    </div>
  );
}
