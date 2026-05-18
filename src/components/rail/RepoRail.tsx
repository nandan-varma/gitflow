import React from "react";
import {
  GitBranch, Tag, Archive, GitMerge, Layers,
  FolderOpen, ChevronDown, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { useUIStore } from "../../store/uiStore";
import { useRepoStore } from "../../store/repoStore";
import { BranchList } from "./BranchList";
import { StashList } from "./StashList";
import { TagList } from "./TagList";

export function RepoRail() {
  const { railCollapsed, activeView, setActiveView } = useUIStore();
  const { currentRepoPath } = useRepoStore();

  if (!currentRepoPath) {
    return (
      <aside
        style={{
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 12,
        }}
      >
        {!railCollapsed && <span>No repo open</span>}
      </aside>
    );
  }

  if (railCollapsed) {
    return (
      <aside
        style={{
          width: 48,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 0",
          gap: 4,
        }}
      >
        <NavIcon
          icon={<GitMerge size={16} />}
          active={activeView === "graph"}
          onClick={() => setActiveView("graph")}
          title="Commit Graph"
        />
        <NavIcon
          icon={<Layers size={16} />}
          active={activeView === "staging"}
          onClick={() => setActiveView("staging")}
          title="Staging"
        />
        <NavIcon
          icon={<Archive size={16} />}
          active={activeView === "stash"}
          onClick={() => setActiveView("stash")}
          title="Stashes"
        />
      </aside>
    );
  }

  return (
    <aside
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Navigation */}
      <section style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
        <NavItem
          icon={<GitMerge size={14} />}
          label="Commit Graph"
          active={activeView === "graph"}
          onClick={() => setActiveView("graph")}
        />
        <NavItem
          icon={<Layers size={14} />}
          label="Staging Area"
          active={activeView === "staging"}
          onClick={() => setActiveView("staging")}
        />
        <NavItem
          icon={<Archive size={14} />}
          label="Stashes"
          active={activeView === "stash"}
          onClick={() => setActiveView("stash")}
        />
      </section>

      {/* Branches */}
      <BranchList />

      {/* Tags */}
      <TagList />

      {/* Stashes */}
      <StashList />
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 12px",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        background: active ? "var(--bg-selected)" : "transparent",
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        borderRadius: 0,
      }}
    >
      <span style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>{icon}</span>
      {label}
    </button>
  );
}

function NavIcon({
  icon,
  active,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36,
        height: 36,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "var(--accent)" : "var(--text-muted)",
        background: active ? "var(--bg-selected)" : "transparent",
      }}
    >
      {icon}
    </button>
  );
}
