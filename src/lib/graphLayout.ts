import type { GraphNode } from "../types/graph";

export const LANE_WIDTH = 20;
export const ROW_HEIGHT = 28;
export const NODE_RADIUS = 5;

export function laneX(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2;
}

export function rowY(index: number): number {
  return index * ROW_HEIGHT + ROW_HEIGHT / 2;
}

export function bezierPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): string {
  const midY = (fromY + toY) / 2;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

export const LANE_COLORS = [
  "#4CAF50", // green
  "#2196F3", // blue
  "#FF9800", // orange
  "#E91E63", // pink
  "#9C27B0", // purple
  "#00BCD4", // cyan
  "#FF5722", // deep orange
  "#607D8B", // blue grey
  "#8BC34A", // light green
  "#FFC107", // amber
  "#3F51B5", // indigo
  "#009688", // teal
];

export function laneColor(colorIndex: number): string {
  return LANE_COLORS[colorIndex % LANE_COLORS.length];
}

export interface LaidOutNode {
  oid: string;
  summary: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parents: string[];
  lane: number;
  color_index: number;
  is_merge: boolean;
  refs: string[];
}

export interface LaidOutEdge {
  fromOid: string;
  toOid: string;
  fromLane: number;
  toLane: number;
  colorIndex: number;
}

export function computeLanes(nodes: GraphNode[]): {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  totalLanes: number;
} {
  const activeLanes: ({ childOid: string; color: number } | null)[] = [];
  const laneMap = new Map<string, number>();
  const freeLanes: number[] = [];
  let nextColor = 0;

  const result: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];

  for (const node of nodes) {
    const assignedLane = laneMap.get(node.oid);
    let lane: number;
    let colorIndex: number;

    if (assignedLane !== undefined) {
      const entry = activeLanes[assignedLane];
      if (entry) {
        colorIndex = entry.color;
      } else {
        colorIndex = nextColor;
        nextColor++;
      }
      activeLanes[assignedLane] = null;
      freeLanes.push(assignedLane);
      lane = assignedLane;
    } else {
      lane = freeLanes.length > 0 ? freeLanes.pop()! : activeLanes.length;
      if (lane >= activeLanes.length) activeLanes.push(null);
      colorIndex = nextColor;
      nextColor++;
    }

    for (let i = 0; i < node.parents.length; i++) {
      const parentOid = node.parents[i];
      const existingLane = laneMap.get(parentOid);

      let edgeLane: number;
      let edgeColor: number;

      if (existingLane !== undefined) {
        const existingEntry = activeLanes[existingLane];
        edgeLane = existingLane;
        edgeColor = existingEntry ? existingEntry.color : nextColor++;
      } else if (i === 0) {
        if (lane < activeLanes.length) {
          activeLanes[lane] = { childOid: parentOid, color: colorIndex };
          laneMap.set(parentOid, lane);
          const fi = freeLanes.indexOf(lane);
          if (fi >= 0) freeLanes.splice(fi, 1);
        }
        edgeLane = lane;
        edgeColor = colorIndex;
      } else {
        const ml = freeLanes.length > 0 ? freeLanes.pop()! : activeLanes.length;
        if (ml >= activeLanes.length) activeLanes.push(null);
        const mc = nextColor;
        nextColor++;
        if (ml < activeLanes.length) {
          activeLanes[ml] = { childOid: parentOid, color: mc };
          laneMap.set(parentOid, ml);
          const fi = freeLanes.indexOf(ml);
          if (fi >= 0) freeLanes.splice(fi, 1);
        }
        edgeLane = ml;
        edgeColor = mc;
      }

      edges.push({
        fromOid: node.oid,
        toOid: parentOid,
        fromLane: lane,
        toLane: edgeLane,
        colorIndex: edgeColor,
      });
    }

    result.push({
      oid: node.oid,
      summary: node.summary,
      author_name: node.author_name,
      author_email: node.author_email,
      timestamp: node.timestamp,
      parents: node.parents,
      lane,
      color_index: colorIndex % 12,
      is_merge: node.is_merge,
      refs: node.refs,
    });
  }

  const totalLanes = Math.max(
    result.reduce((max, n) => Math.max(max, n.lane + 1), 0),
    1
  );

  return { nodes: result, edges, totalLanes };
}
