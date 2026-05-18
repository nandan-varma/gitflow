import type { GraphNode, GraphEdge } from "../types/graph";

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
