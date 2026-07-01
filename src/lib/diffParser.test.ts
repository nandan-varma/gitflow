import { describe, it, expect } from "vitest";
import { computeWordDiff, formatRelativeTime } from "./diffParser";

describe("computeWordDiff", () => {
  it("returns equal words for identical strings", () => {
    const result = computeWordDiff("hello world", "hello world");
    expect(result.before.every((w) => w.type === "equal")).toBe(true);
    expect(result.after.every((w) => w.type === "equal")).toBe(true);
  });

  it("finds added words", () => {
    const result = computeWordDiff("hello", "hello world");
    expect(result.after.some((w) => w.type === "add" && w.text === "world")).toBe(true);
  });

  it("finds removed words", () => {
    const result = computeWordDiff("hello world", "hello");
    expect(result.before.some((w) => w.type === "remove" && w.text === "world")).toBe(true);
  });

  it("handles empty strings", () => {
    const result = computeWordDiff("", "");
    expect(result.before).toHaveLength(0);
    expect(result.after).toHaveLength(0);
  });

  it("handles one empty string", () => {
    const result = computeWordDiff("hello", "");
    expect(result.before.some((w) => w.type === "remove")).toBe(true);
    expect(result.after).toHaveLength(0);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.now() / 1000;

  it('returns "just now" for < 60 seconds', () => {
    expect(formatRelativeTime(now - 30)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(formatRelativeTime(now - 120)).toBe("2m ago");
  });

  it("returns hours ago", () => {
    expect(formatRelativeTime(now - 7200)).toBe("2h ago");
  });

  it("returns days ago", () => {
    expect(formatRelativeTime(now - 172800)).toBe("2d ago");
  });

  it("returns months ago", () => {
    expect(formatRelativeTime(now - 86400 * 60)).toBe("2mo ago");
  });

  it("returns years ago", () => {
    expect(formatRelativeTime(now - 86400 * 400)).toBe("1y ago");
  });
});
