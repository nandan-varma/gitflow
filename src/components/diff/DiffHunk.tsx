import React from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import type { DiffHunk as DiffHunkType, DiffLine } from "../../types/diff";
import { DiffLine as DiffLineComp } from "./DiffLine";
import { useStagingStore } from "../../store/stagingStore";
import { useConfirmStore } from "../../store/confirmStore";
import { useDiscardLines } from "../../hooks/useDiff";
import { ipc } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";

interface Props {
  hunk: DiffHunkType;
  path: string;
  mode: "workdir" | "staged" | "commit";
}

export function DiffHunk({ hunk, path, mode }: Props) {
  const readOnly = mode === "commit";
  const { selectedLines, toggleLine, selectRange, clearSelection } = useStagingStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
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
      {/* Hunk header — sticky so it stays at screen width while code scrolls */}
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

        {!readOnly && mode === "workdir" && hasSelectedPlus && (
          <button
            onClick={() => showConfirm({ title: "Discard Selected Lines", message: `Discard ${selectedPlusKeys.length} selected line(s) in "${path}"? This reverts these changes from the working directory.`, danger: true, confirmLabel: "Discard", onConfirm: handleDiscardSelected })}
            title="Discard selected lines"
            style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 3, background: "rgba(244,67,54,0.15)", color: "var(--danger)", fontSize: 11 }}
          >
            <Trash2 size={10} />
            Discard Selected
          </button>
        )}
        {!readOnly && (
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
        )}
      </div>

      {/* Lines scroll independently so the header above never moves */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ width: "max-content", minWidth: "100%" }}>
          {hunk.lines.map((line, i) => (
            <DiffLineComp
              key={i}
              line={line}
              lineKey={lineKeys[i]}
              selected={readOnly ? false : selectedLines.has(lineKeys[i])}
              onToggle={readOnly ? undefined : () => toggleLine(lineKeys[i])}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
