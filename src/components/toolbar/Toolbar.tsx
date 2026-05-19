import React from "react";
import { ChevronLeft, ChevronRight, GitBranch, RefreshCw, Terminal } from "lucide-react";
import { useRepoStore } from "../../store/repoStore";
import { useRepoInfo } from "../../hooks/useRepository";
import { useUIStore } from "../../store/uiStore";
import { RepoSelector } from "./RepoSelector";

export function Toolbar() {
  const { currentRepoPath } = useRepoStore();
  const { data: repoInfo, refetch } = useRepoInfo();
  const { toggleCommandLog, toggleRail, railCollapsed } = useUIStore();

  return (
    <div
      data-tauri-drag-region
      style={{
        height: "var(--toolbar-height)",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
        userSelect: "none",
      }}
    >
      <button
        onClick={toggleRail}
        title={railCollapsed ? "Expand rail" : "Collapse rail"}
        style={{ color: "var(--text-muted)", padding: "4px" }}
      >
        {railCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        {currentRepoPath ? (
          <>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {currentRepoPath.split("/").slice(-2).join("/")}
            </span>
            {repoInfo?.head_branch && (
              <>
                <span style={{ color: "var(--border)" }}>›</span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--accent)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  <GitBranch size={12} />
                  {repoInfo.head_branch}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background:
                      repoInfo.state === "clean"
                        ? "rgba(76,175,80,0.15)"
                        : "rgba(255,152,0,0.15)",
                    color:
                      repoInfo.state === "clean"
                        ? "var(--success)"
                        : "var(--warning)",
                  }}
                >
                  {repoInfo.state}
                </span>
              </>
            )}
          </>
        ) : (
          <RepoSelector />
        )}
      </div>

      <button
        onClick={() => refetch()}
        title="Refresh"
        style={{ color: "var(--text-muted)", padding: "4px" }}
      >
        <RefreshCw size={14} />
      </button>

      <button
        onClick={toggleCommandLog}
        title="Toggle command log"
        style={{ color: "var(--text-muted)", padding: "4px" }}
      >
        <Terminal size={14} />
      </button>
    </div>
  );
}
