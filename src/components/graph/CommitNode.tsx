import React from "react";
import { laneX, rowY, NODE_RADIUS, ROW_HEIGHT, LANE_WIDTH, laneColor } from "../../lib/graphLayout";
import { formatRelativeTime } from "../../lib/diffParser";
import type { LaidOutNode } from "../../lib/graphLayout";
import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useToastStore } from "../../store/toastStore";
import { ipc } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";
import { toErrMsg } from "../../lib/ipc";
import { rowProps } from "../../lib/a11y";

interface Props {
  node: LaidOutNode;
  selected: boolean;
  onSelect: () => void;
  laneOffset: number;
}

export function CommitNode({ node, selected, onSelect, laneOffset }: Props) {
  const x = laneX(node.lane);
  const midY = ROW_HEIGHT / 2;
  const color = laneColor(node.color_index);
  const { showContextMenu, openDialog, openBlame, setActiveView } = useUIStore();
  const { codeEditor } = useSettingsStore();
  const addToast = useToastStore((s) => s.addToast);

  return (
    <div
      onClick={onSelect}
      {...rowProps(onSelect)}
      tabIndex={-1}
      aria-label={`Commit ${node.oid.slice(0, 7)}: ${node.summary}`}
      aria-current={selected || undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          { label: "Copy SHA", action: () => { navigator.clipboard.writeText(node.oid).catch(() => {}); } },
          { label: `Copy Short SHA (${node.oid.slice(0, 7)})`, action: () => { navigator.clipboard.writeText(node.oid.slice(0, 7)).catch(() => {}); } },
          "separator",
          { label: "Create Branch from Here…", action: () => openDialog("branch-create", node.oid) },
          { label: "Create Tag Here…", action: () => openDialog("tag-create", node.oid) },
          { label: "Cherry-pick onto Current Branch", action: async () => {
            try {
              const outcome = await ipc.cherryPick(node.oid);
              if (outcome.type === "Conflicts") {
                setActiveView("conflicts");
                queryClient.invalidateQueries({ queryKey: ["repo"] });
              } else {
                queryClient.invalidateQueries({ queryKey: ["graph"] });
                queryClient.invalidateQueries({ queryKey: ["status"] });
                queryClient.invalidateQueries({ queryKey: ["branches"] });
              }
            } catch (e) { addToast(`Cherry-pick failed: ${toErrMsg(e)}`, "error"); }
          }},
          "separator",
          { label: "Open Repo in Editor", action: () => { ipc.openInVscode("", codeEditor).catch(() => {}); } },
        ]);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_HEIGHT,
        cursor: "pointer",
        background: selected ? "rgba(76,139,245,0.12)" : undefined,
        boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined,
      }}
    >
      {/* SVG node dot — positioned absolutely within the lane area */}
      <div
        style={{
          width: laneOffset,
          height: ROW_HEIGHT,
          flexShrink: 0,
          position: "relative",
        }}
      >
        <svg
          width={laneOffset}
          height={ROW_HEIGHT}
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          {node.is_merge ? (
            // Diamond shape for merge commits
            <polygon
              points={`${x},${midY - NODE_RADIUS} ${x + NODE_RADIUS},${midY} ${x},${midY + NODE_RADIUS} ${x - NODE_RADIUS},${midY}`}
              fill={color}
              stroke="var(--bg-base)"
              strokeWidth={1.5}
            />
          ) : (
            <circle
              cx={x}
              cy={midY}
              r={NODE_RADIUS}
              fill={color}
              stroke="var(--bg-base)"
              strokeWidth={1.5}
            />
          )}
        </svg>
      </div>

      {/* Commit info */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 12,
          minWidth: 0,
        }}
      >
        {/* Ref labels */}
        {node.refs.length > 0 && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {node.refs.slice(0, 3).map((ref) => (
              <span
                key={ref}
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: ref.includes("HEAD")
                    ? "rgba(76,175,80,0.2)"
                    : "rgba(76,139,245,0.2)",
                  color: ref.includes("HEAD") ? "var(--success)" : "var(--accent)",
                  border: `1px solid ${ref.includes("HEAD") ? "rgba(76,175,80,0.3)" : "rgba(76,139,245,0.3)"}`,
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "nowrap",
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        )}

        {/* Summary */}
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.summary}
        </span>

        {/* Author + time */}
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
          {node.author_name} · {formatRelativeTime(node.timestamp)}
        </span>

        {/* Short OID */}
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          {node.oid.slice(0, 7)}
        </span>
      </div>
    </div>
  );
}
