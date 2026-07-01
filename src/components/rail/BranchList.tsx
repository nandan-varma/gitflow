import React, { useState } from "react";
import { GitBranch, ChevronDown, ChevronRight, Plus, Trash2, Merge } from "lucide-react";
import { useBranches, useSwitchBranch, useDeleteBranch } from "../../hooks/useBranches";
import { usePullRequests } from "../../hooks/useGitHub";
import { useUIStore } from "../../store/uiStore";
import type { BranchInfo } from "../../types/git";
import type { PullRequest } from "../../types/github";

export function BranchList() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: branches = [] } = useBranches();
  const { data: prs = [] } = usePullRequests();
  const { openDialog } = useUIStore();

  const prByBranch = Object.fromEntries(prs.map((pr) => [pr.headRefName, pr]));
  const local = branches.filter((b) => !b.is_remote);
  const remote = branches.filter((b) => b.is_remote);

  return (
    <section>
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "6px 12px",
          color: "var(--text-muted)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          Branches
          <span style={{ fontSize: 10, background: "var(--bg-elevated)", padding: "0 4px", borderRadius: 8, color: "var(--text-muted)" }}>
            {local.length}
          </span>
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); openDialog("branch-create"); }}
          style={{ color: "var(--text-muted)", padding: 2 }}
          title="Create branch"
        >
          <Plus size={12} />
        </button>
      </button>

      {!collapsed && (
        <div>
          {local.map((b) => (
            <BranchItem key={b.name} branch={b} pr={prByBranch[b.name]} />
          ))}
          {remote.length > 0 && (
            <div style={{ padding: "4px 12px 2px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Remote
            </div>
          )}
          {remote.map((b) => (
            <BranchItem key={b.name} branch={b} isRemote />
          ))}
        </div>
      )}
    </section>
  );
}

function BranchItem({ branch, isRemote = false, pr }: { branch: BranchInfo; isRemote?: boolean; pr?: PullRequest }) {
  const switchBranch = useSwitchBranch();
  const deleteBranch = useDeleteBranch();
  const { openDialog } = useUIStore();
  const [hovering, setHovering] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px 4px 24px",
        background: branch.is_head ? "rgba(76,139,245,0.1)" : hovering ? "var(--bg-hover)" : "transparent",
        cursor: "pointer",
      }}
      onClick={() => !branch.is_head && !isRemote && switchBranch.mutate(branch.name)}
    >
      <GitBranch
        size={12}
        style={{ color: branch.is_head ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}
      />
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: branch.is_head ? "var(--text-primary)" : "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: branch.is_head ? 500 : 400,
        }}
      >
        {branch.name}
      </span>
      {(branch.ahead > 0 || branch.behind > 0) && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
          {branch.ahead > 0 && `↑${branch.ahead}`}
          {branch.behind > 0 && ` ↓${branch.behind}`}
        </span>
      )}
      {pr && !hovering && (
        <span style={{
          fontSize: 9, padding: "0 4px", borderRadius: 8, flexShrink: 0,
          background: pr.reviewDecision === "APPROVED" ? "rgba(76,175,80,0.2)" : "rgba(76,139,245,0.2)",
          color: pr.reviewDecision === "APPROVED" ? "var(--success)" : "var(--accent)",
        }}>
          #{pr.number}
        </span>
      )}
      {hovering && !branch.is_head && !isRemote && (
        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={(e) => { e.stopPropagation(); openDialog("merge", branch.name); }}
            title="Merge into current"
            style={{ color: "var(--text-muted)", padding: 2 }}
          >
            <Merge size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteBranch.mutate({ name: branch.name, force: false }); }}
            title="Delete branch"
            style={{ color: "var(--text-muted)", padding: 2 }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
