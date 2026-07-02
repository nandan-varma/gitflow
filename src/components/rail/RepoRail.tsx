import React from "react";
import { GitMerge, Layers, Archive, GitPullRequest } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUIStore } from "../../store/uiStore";
import { useRepoStore } from "../../store/repoStore";
import { BranchList } from "./BranchList";
import { StashList } from "./StashList";
import { TagList } from "./TagList";

function TrafficLights() {
  return (
    <div className="traffic-lights">
      <button className="traffic-light close" title="Close" aria-label="Close window" onClick={() => getCurrentWindow().close()} />
      <button className="traffic-light min"   title="Minimize" aria-label="Minimize window" onClick={() => getCurrentWindow().minimize()} />
      <button className="traffic-light max"   title="Maximize" aria-label="Maximize window" onClick={() => getCurrentWindow().toggleMaximize()} />
    </div>
  );
}

export function RepoRail() {
  const { railCollapsed, activeView, setActiveView } = useUIStore();
  const { currentRepoPath } = useRepoStore();

  if (railCollapsed) {
    return (
      <aside style={{ background: "var(--bg-surface)", display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
        <div data-tauri-drag-region className="panel-header" style={{ width: "100%", paddingLeft: 8, paddingRight: 0 }}>
          <TrafficLights />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 4 }}>
          <NavIcon icon={<GitMerge size={16} />} active={activeView === "graph"} onClick={() => setActiveView("graph")} title="Commit Graph" />
          <NavIcon icon={<Layers size={16} />}   active={activeView === "staging"} onClick={() => setActiveView("staging")} title="Staging" />
          <NavIcon icon={<Archive size={16} />}  active={activeView === "stash"} onClick={() => setActiveView("stash")} title="Stashes" />
          <NavIcon icon={<GitPullRequest size={16} />} active={activeView === "pull-requests"} onClick={() => setActiveView("pull-requests")} title="Pull Requests" />
        </div>
      </aside>
    );
  }

  return (
    <aside style={{ background: "var(--bg-surface)", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Drag region header with traffic lights */}
      <div data-tauri-drag-region className="panel-header">
        <TrafficLights />
        {!currentRepoPath && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No repo open</span>}
      </div>

      {/* Navigation */}
      <section style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <NavItem icon={<GitMerge size={14} />} label="Commit Graph" active={activeView === "graph"} onClick={() => setActiveView("graph")} />
        <NavItem icon={<Layers size={14} />}   label="Staging Area" active={activeView === "staging"} onClick={() => setActiveView("staging")} />
        <NavItem icon={<Archive size={14} />}  label="Stashes"      active={activeView === "stash"} onClick={() => setActiveView("stash")} />
        <NavItem icon={<GitPullRequest size={14} />} label="Pull Requests" active={activeView === "pull-requests"} onClick={() => setActiveView("pull-requests")} />
      </section>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <BranchList />
        <TagList />
        <StashList />
      </div>
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
      aria-label={title}
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
