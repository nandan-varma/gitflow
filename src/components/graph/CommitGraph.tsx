import React, { useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCommitGraph } from "../../hooks/useCommitGraph";
import { useUIStore } from "../../store/uiStore";
import { CommitNode } from "./CommitNode";
import { BezierConnector } from "./BezierConnector";
import {
  LANE_WIDTH, ROW_HEIGHT, laneX, rowY, laneColor,
} from "../../lib/graphLayout";
import type { GraphNode, GraphEdge } from "../../types/graph";
import { RepoSelector } from "../toolbar/RepoSelector";
import { useRepoStore } from "../../store/repoStore";

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
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 16 }}>
        <span style={{ color: "var(--text-muted)" }}>Open a git repository to get started</span>
        <RepoSelector />
      </div>
    );
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
