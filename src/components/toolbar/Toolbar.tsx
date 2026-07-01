import React from "react";
import { ChevronLeft, ChevronRight, GitBranch, RefreshCw, Settings, Terminal, ArrowUp, ArrowDown, Download } from "lucide-react";
import { useRepoStore } from "../../store/repoStore";
import { useRepoInfo } from "../../hooks/useRepository";
import { useUIStore } from "../../store/uiStore";
import { useBranches } from "../../hooks/useBranches";
import { useFetch, usePush, usePull } from "../../hooks/useRemote";

export function Toolbar() {
  const { currentRepoPath } = useRepoStore();
  const { data: repoInfo, refetch } = useRepoInfo();
  const { toggleCommandLog, toggleRail, railCollapsed, activeView, setActiveView } = useUIStore();

  const { data: branches = [] } = useBranches();
  const fetch = useFetch();
  const push = usePush();
  const pull = usePull();

  const currentBranch = branches.find((b) => b.is_head);
  const hasUpstream = !!currentBranch?.upstream;
  const ahead = currentBranch?.ahead ?? 0;
  const behind = currentBranch?.behind ?? 0;

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

      {currentBranch && (
        <>
          <button
            onClick={() => fetch.mutate()}
            disabled={fetch.isPending}
            title="Fetch from remote"
            style={{ color: "var(--text-muted)", padding: "4px", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}
          >
            <Download size={13} />
            {behind > 0 && <span style={{ color: "var(--warning)" }}>↓{behind}</span>}
          </button>

          <button
            onClick={() => push.mutate({ branch: currentBranch.name, setUpstream: !hasUpstream })}
            disabled={push.isPending || ahead === 0}
            title={hasUpstream ? "Push" : "Push and set upstream"}
            style={{ color: ahead > 0 ? "var(--accent)" : "var(--text-muted)", padding: "4px", display: "flex", alignItems: "center", gap: 3, fontSize: 11, opacity: ahead === 0 ? 0.5 : 1 }}
          >
            <ArrowUp size={13} />
            {ahead > 0 && <span>{ahead}</span>}
          </button>

          {behind > 0 && (
            <button
              onClick={() => pull.mutate()}
              disabled={pull.isPending}
              title="Pull (rebase)"
              style={{ color: "var(--warning)", padding: "4px", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}
            >
              <ArrowDown size={13} />
              <span>{behind}</span>
            </button>
          )}
        </>
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
