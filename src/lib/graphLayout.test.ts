import { describe, it, expect } from "vitest";
import { laneX, rowY, bezierPath, laneColor, LANE_COLORS, LANE_WIDTH, ROW_HEIGHT } from "./graphLayout";

describe("laneX", () => {
  it("returns center of lane", () => {
    expect(laneX(0)).toBe(LANE_WIDTH / 2);
    expect(laneX(1)).toBe(LANE_WIDTH + LANE_WIDTH / 2);
    expect(laneX(5)).toBe(5 * LANE_WIDTH + LANE_WIDTH / 2);
  });
});

describe("rowY", () => {
  it("returns center of row", () => {
    expect(rowY(0)).toBe(ROW_HEIGHT / 2);
    expect(rowY(1)).toBe(ROW_HEIGHT + ROW_HEIGHT / 2);
  });
});

describe("bezierPath", () => {
  it("generates a cubic bezier curve", () => {
    const path = bezierPath(10, 10, 50, 50);
    expect(path).toContain("M 10 10");
    expect(path).toContain("C ");
    expect(path).toContain("50 50");
  });

  it("uses midpoint as control point", () => {
    const path = bezierPath(0, 0, 100, 100);
    expect(path).toContain("C 0 50");
    expect(path).toContain("100 50");
  });
});

describe("laneColor", () => {
  it("returns color from palette", () => {
    expect(laneColor(0)).toBe(LANE_COLORS[0]);
    expect(laneColor(LANE_COLORS.length)).toBe(LANE_COLORS[0]);
    expect(laneColor(LANE_COLORS.length + 1)).toBe(LANE_COLORS[1]);
  });

  it("wraps around for large indices", () => {
    expect(laneColor(12)).toBe(LANE_COLORS[0]);
    expect(laneColor(13)).toBe(LANE_COLORS[1]);
  });
});
