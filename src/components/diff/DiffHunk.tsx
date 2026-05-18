import React from "react";
import { Plus, Minus } from "lucide-react";
import type { DiffHunk as DiffHunkType, DiffLine } from "../../types/diff";
import { DiffLine as DiffLineComp } from "./DiffLine";
import { useStagingStore } from "../../store/stagingStore";
import { ipc } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";

interface Props {
  hunk: DiffHunkType;
  path: string;
  mode: "workdir" | "staged";
}

export function DiffHunk({ hunk, path, mode }: Props) {
  const { selectedLines, toggleLine, selectRange, clearSelection } = useStagingStore();

  const lineKeys = hunk.lines.map(
    (_, i) => `${path}:${hunk.header}:${i}`
  );

  const hunkLineKeys = lineKeys.filter((_, i) => {
    const l = hunk.lines[i];
    return l.origin === "+" || l.origin === "-";
  });

  const allSelected = hunkLineKeys.every((k) => selectedLines.has(k));

  const handleStageHunk = async () => {
    try {
      if (mode === "workdir") {
        await ipc.stageHunk(path, hunk.lines as DiffLine[]);
      } else {
        await ipc.unstageHunk(path, hunk.lines as DiffLine[]);
      }
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["diff"] });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Hunk header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "2px 8px",
          gap: 8,
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          {hunk.header}
        </span>

        <button
          onClick={handleStageHunk}
          title={mode === "workdir" ? "Stage hunk" : "Unstage hunk"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 8px",
            borderRadius: 3,
            background: mode === "workdir" ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)",
            color: mode === "workdir" ? "var(--success)" : "var(--danger)",
            fontSize: 11,
          }}
        >
          {mode === "workdir" ? <Plus size={10} /> : <Minus size={10} />}
          {mode === "workdir" ? "Stage" : "Unstage"}
        </button>
      </div>

      {/* Lines */}
      {hunk.lines.map((line, i) => (
        <DiffLineComp
          key={i}
          line={line}
          lineKey={lineKeys[i]}
          selected={selectedLines.has(lineKeys[i])}
          onToggle={() => toggleLine(lineKeys[i])}
        />
      ))}
    </div>
  );
}
