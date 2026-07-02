import React from "react";
import { Columns, AlignLeft } from "lucide-react";
import type { FileDiff } from "../../types/diff";
import { DiffHunk } from "./DiffHunk";
import { useUIStore } from "../../store/uiStore";

interface Props {
  diff: FileDiff;
  path: string;
  mode: "workdir" | "staged";
}

export function DiffView({ diff, path, mode }: Props) {
  const { diffMode, setDiffMode } = useUIStore();

  if (diff.is_binary) {
    return (
      <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>
        Binary file — no diff available
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>
        No changes
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "1px 5px",
              borderRadius: 3,
              background: mode === "staged" ? "rgba(255,193,7,0.15)" : "rgba(76,175,80,0.15)",
              color: mode === "staged" ? "var(--warning)" : "var(--success)",
            }}
          >
            {mode === "staged" ? "Staged" : "Unstaged"}
          </span>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
            {diff.old_path ? `${diff.old_path} → ${diff.path}` : diff.path}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--success)" }}>+{diff.stats.additions}</span>
          <span style={{ fontSize: 11, color: "var(--danger)" }}>-{diff.stats.deletions}</span>
          <div
            style={{
              display: "flex",
              background: "var(--bg-elevated)",
              borderRadius: 4,
              overflow: "hidden",
              border: "1px solid var(--border)",
              marginLeft: 4,
            }}
          >
            <button
              onClick={() => setDiffMode("unified")}
              title="Unified diff"
              style={{
                padding: "3px 6px",
                background: diffMode === "unified" ? "var(--bg-selected)" : "transparent",
                color: diffMode === "unified" ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <AlignLeft size={12} />
            </button>
            <button
              onClick={() => setDiffMode("split")}
              title="Split diff"
              style={{
                padding: "3px 6px",
                background: diffMode === "split" ? "var(--bg-selected)" : "transparent",
                color: diffMode === "split" ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <Columns size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Hunks */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {diff.hunks.map((hunk, i) => (
          <DiffHunk key={i} hunk={hunk} path={path} mode={mode} />
        ))}
      </div>
    </div>
  );
}
