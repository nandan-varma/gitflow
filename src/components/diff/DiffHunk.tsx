import React from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import type { DiffHunk as DiffHunkType, DiffLine } from "../../types/diff";
import { DiffLine as DiffLineComp } from "./DiffLine";
import { useStagingStore } from "../../store/stagingStore";
import { useDiscardLines } from "../../hooks/useDiff";
import { ipc } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";

interface Props {
  hunk: DiffHunkType;
  path: string;
  mode: "workdir" | "staged";
}

export function DiffHunk({ hunk, path, mode }: Props) {
  const { selectedLines, toggleLine, selectRange, clearSelection } = useStagingStore();
  const discardLines = useDiscardLines();

  const lineKeys = hunk.lines.map(
    (_, i) => `${path}:${hunk.header}:${i}`
  );

  const hunkLineKeys = lineKeys.filter((_, i) => {
    const l = hunk.lines[i];
    return l.origin === "+" || l.origin === "-";
  });

  const selectedPlusKeys = lineKeys.filter((k, i) => selectedLines.has(k) && hunk.lines[i].origin === "+");
  const hasSelectedPlus = selectedPlusKeys.length > 0;

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

  const handleDiscardSelected = () => {
    const selectedSet = new Set(selectedPlusKeys);
    // Build reversed patch lines: selected + → -, unselected + → context, context stays
    const patchLines: DiffLine[] = hunk.lines
      .map((line, i): DiffLine | null => {
        const key = lineKeys[i];
        if (line.origin === " ") {
          return { ...line, old_lineno: line.new_lineno, new_lineno: line.new_lineno };
        }
        if (line.origin === "+") {
          if (selectedSet.has(key)) {
            // Reverse: remove from workdir
            return { ...line, origin: "-", old_lineno: line.new_lineno, new_lineno: null };
          }
          // Keep in workdir: treat as context
          return { ...line, origin: " ", old_lineno: line.new_lineno, new_lineno: line.new_lineno };
        }
        return null; // skip - lines (deleted from workdir; don't handle here)
      })
      .filter((l): l is DiffLine => l !== null);

    discardLines.mutate({ path, lines: patchLines }, { onSuccess: () => clearSelection() });
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

        {mode === "workdir" && hasSelectedPlus && (
          <button
            onClick={handleDiscardSelected}
            title="Discard selected lines"
            style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 3, background: "rgba(244,67,54,0.15)", color: "var(--danger)", fontSize: 11 }}
          >
            <Trash2 size={10} />
            Discard Selected
          </button>
        )}
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
