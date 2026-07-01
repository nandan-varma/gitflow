import React from "react";
import { ChevronLeft, ChevronRight, GitBranch, RefreshCw, Settings, Terminal } from "lucide-react";
import { useRepoStore } from "../../store/repoStore";
import { useRepoInfo } from "../../hooks/useRepository";
import { useUIStore } from "../../store/uiStore";

export function Toolbar() {
  const { currentRepoPath } = useRepoStore();
  const { data: repoInfo, refetch } = useRepoInfo();
  const { toggleCommandLog, toggleRail, railCollapsed, activeView, setActiveView } = useUIStore();

  return (
    <div
      data-tauri-drag-region
      className="panel-header"
      style={{ background: "var(--bg-surface)", gap: 8 }}
    >
      <button
        onClick={toggleRail}
        title={railCollapsed ? "Expand rail" : "Collapse rail"}
        style={{ color: "var(--text-muted)", padding: "4px" }}
      >
        {railCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div data-tauri-drag-region style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        {currentRepoPath && (
          <>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {currentRepoPath.split("/").slice(-2).join("/")}
            </span>
            {repoInfo?.head_branch && (
              <>
                <span style={{ color: "var(--border)" }}>›</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  <GitBranch size={12} />
                  {repoInfo.head_branch}
                </span>
                <span style={{
                  fontSize: 11, padding: "1px 6px", borderRadius: 10,
                  background: repoInfo.state === "clean" ? "rgba(76,175,80,0.15)" : "rgba(255,152,0,0.15)",
                  color: repoInfo.state === "clean" ? "var(--success)" : "var(--warning)",
                }}>
                  {repoInfo.state}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {currentRepoPath && (
        <button onClick={() => refetch()} title="Refresh" style={{ color: "var(--text-muted)", padding: "4px" }}>
          <RefreshCw size={14} />
        </button>
      )}

      <button
        onClick={toggleCommandLog}
        title="Toggle command log"
        style={{ color: "var(--text-muted)", padding: "4px" }}
      >
        <Terminal size={14} />
      </button>

      <button
        onClick={() => setActiveView(activeView === "settings" ? "graph" : "settings")}
        title="Settings"
        style={{ color: activeView === "settings" ? "var(--accent)" : "var(--text-muted)", padding: "4px" }}
      >
        <Settings size={14} />
      </button>
    </div>
  );
}
