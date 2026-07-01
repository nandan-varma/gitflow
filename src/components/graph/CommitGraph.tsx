import React, { useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCommitGraph } from "../../hooks/useCommitGraph";
import { useUIStore } from "../../store/uiStore";
import { CommitNode } from "./CommitNode";
import { BezierConnector } from "./BezierConnector";
import {
  LANE_WIDTH, ROW_HEIGHT, laneX, rowY, laneColor,
} from "../../lib/graphLayout";
import type { GraphNode, GraphEdge } from "../../types/graph";
import { useRepoStore } from "../../store/repoStore";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, GitBranch } from "lucide-react";

const RECENT_VISIBLE = 5;

function WelcomeScreen() {
  const { openRepository, recentRepos, isOpening } = useRepoStore();
  const [showAll, setShowAll] = useState(false);

  const handleOpen = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") openRepository(selected);
  };

  const displayed = showAll ? recentRepos : recentRepos.slice(0, RECENT_VISIBLE);
  const hiddenCount = recentRepos.length - RECENT_VISIBLE;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "var(--accent)", marginBottom: 10 }}>
          <GitBranch size={36} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>GitFlow Studio</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Git repository management</div>
      </div>

      {/* Open button */}
      <button
        onClick={handleOpen}
        disabled={isOpening}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 20px", borderRadius: 6,
          background: "var(--accent)", color: "#fff",
          fontSize: 13, fontWeight: 500,
          opacity: isOpening ? 0.7 : 1,
        }}
      >
        <FolderOpen size={14} />
        {isOpening ? "Opening…" : "Open Repository"}
      </button>

      {/* Recent repos */}
      {recentRepos.length > 0 && (
        <div style={{ width: 420 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 8 }}>
            RECENT REPOSITORIES
          </div>
          {displayed.map((p) => (
            <button
              key={p}
              onClick={() => openRepository(p)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", padding: "8px 10px", borderRadius: 5,
                textAlign: "left", color: "var(--text-primary)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <FolderOpen size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontWeight: 500, fontSize: 13, flexShrink: 0 }}>
                {p.split("/").pop()}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                {p}
              </span>
            </button>
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              style={{ marginTop: 4, padding: "6px 10px", fontSize: 12, color: "var(--text-muted)" }}
            >
              {hiddenCount} more…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CommitGraph() {
  const { data, fetchNextPage, hasNextPage, isFetching } = useCommitGraph();
  const { selectedCommitOid, selectCommit } = useUIStore();
  const { currentRepoPath } = useRepoStore();

  const parentRef = React.useRef<HTMLDivElement>(null);

  // Flatten pages
  const allNodes: GraphNode[] = useMemo(
    () => data?.pages.flatMap((p) => p.nodes) ?? [],
    [data]
  );
  const allEdges: GraphEdge[] = useMemo(
    () => data?.pages.flatMap((p) => p.edges) ?? [],
    [data]
  );

  const totalLanes = useMemo(
    () => data?.pages[0]?.total_lanes ?? 1,
    [data]
  );

  const virtualizer = useVirtualizer({
    count: allNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Build oid → row index map for edge rendering
  const oidToIndex = useMemo(() => {
    const map = new Map<string, number>();
    allNodes.forEach((n, i) => map.set(n.oid, i));
    return map;
  }, [allNodes]);

  // Only render edges that connect visible rows (with some buffer)
  const firstVisible = virtualItems[0]?.index ?? 0;
  const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? 0;
  const edgeBuffer = 50;

  const visibleEdges = useMemo(
    () =>
      allEdges.filter((e) => {
        const fromIdx = oidToIndex.get(e.from_oid) ?? -1;
        const toIdx = oidToIndex.get(e.to_oid) ?? -1;
        return (
          (fromIdx >= firstVisible - edgeBuffer && fromIdx <= lastVisible + edgeBuffer) ||
          (toIdx >= firstVisible - edgeBuffer && toIdx <= lastVisible + edgeBuffer)
        );
      }),
    [allEdges, oidToIndex, firstVisible, lastVisible]
  );

  const svgWidth = (totalLanes + 1) * LANE_WIDTH;
  const svgHeight = virtualizer.getTotalSize();

  // Load more when scrolled to bottom
  const handleScroll = () => {
    const el = parentRef.current;
    if (!el || isFetching || !hasNextPage) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - ROW_HEIGHT * 5) {
      fetchNextPage();
    }
  };

  if (!currentRepoPath) {
    return <WelcomeScreen />;
  }

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      style={{ height: "100%", overflow: "auto", position: "relative" }}
    >
      {/* SVG connector layer */}
      <svg
        className="graph-canvas"
        width={svgWidth}
        height={svgHeight}
        style={{ pointerEvents: "none" }}
      >
        {visibleEdges.map((edge, i) => {
          const fromIdx = oidToIndex.get(edge.from_oid);
          const toIdx = oidToIndex.get(edge.to_oid);
          if (fromIdx === undefined || toIdx === undefined) return null;
          return (
            <BezierConnector
              key={i}
              fromX={laneX(edge.from_lane)}
              fromY={rowY(fromIdx)}
              toX={laneX(edge.to_lane)}
              toY={rowY(toIdx)}
              color={laneColor(edge.color_index)}
            />
          );
        })}
      </svg>

      {/* Virtual rows */}
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const node = allNodes[virtualRow.index];
          if (!node) return null;
          return (
            <div
              key={node.oid}
              style={{
                position: "absolute",
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
              }}
            >
              <CommitNode
                node={node}
                selected={node.oid === selectedCommitOid}
                onSelect={() => selectCommit(node.oid)}
                laneOffset={svgWidth}
              />
            </div>
          );
        })}
      </div>

      {isFetching && (
        <div style={{ textAlign: "center", padding: 8, color: "var(--text-muted)", fontSize: 11 }}>
          Loading…
        </div>
      )}
    </div>
  );
}
