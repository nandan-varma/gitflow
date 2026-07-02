import { describe, it, expect } from "vitest";
import { matchesShortcut, toAccelerator, formatShortcut } from "./commands";

const ev = (key: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods }) as KeyboardEvent;

describe("matchesShortcut", () => {
  it("maps mod to ctrl on non-mac and meta on mac", () => {
    expect(matchesShortcut(ev("o", { ctrlKey: true }), "mod+o", false)).toBe(true);
    expect(matchesShortcut(ev("o", { metaKey: true }), "mod+o", true)).toBe(true);
    expect(matchesShortcut(ev("o", { metaKey: true }), "mod+o", false)).toBe(false);
    expect(matchesShortcut(ev("o"), "mod+o", false)).toBe(false);
  });

  it("requires exact modifiers", () => {
    expect(matchesShortcut(ev("P", { ctrlKey: true, shiftKey: true }), "mod+shift+p", false)).toBe(true);
    expect(matchesShortcut(ev("p", { ctrlKey: true }), "mod+shift+p", false)).toBe(false);
    expect(matchesShortcut(ev("p", { ctrlKey: true, shiftKey: true }), "mod+p", false)).toBe(false);
  });

  it("handles symbol keys", () => {
    expect(matchesShortcut(ev("=", { ctrlKey: true }), "mod+=", false)).toBe(true);
    expect(matchesShortcut(ev(",", { ctrlKey: true }), "mod+,", false)).toBe(true);
  });
});

describe("toAccelerator", () => {
  it("converts to Tauri accelerator format", () => {
    expect(toAccelerator("mod+shift+p")).toBe("CmdOrCtrl+Shift+P");
    expect(toAccelerator("mod+o")).toBe("CmdOrCtrl+O");
    expect(toAccelerator("mod+=")).toBe("CmdOrCtrl+=");
  });
});

describe("formatShortcut", () => {
  it("formats per platform", () => {
    expect(formatShortcut("mod+shift+p", false)).toBe("Ctrl+Shift+P");
    expect(formatShortcut("mod+shift+p", true)).toBe("⇧⌘P");
    expect(formatShortcut("mod+k", true)).toBe("⌘K");
  });
});
