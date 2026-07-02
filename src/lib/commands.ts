export interface AppCommand {
  id: string;
  label: string;
  shortcut?: string; // e.g. "mod+shift+p" — mod = Cmd on macOS, Ctrl elsewhere
  enabled: boolean;
  run: () => void;
}

export const isMac = typeof navigator !== "undefined" && (navigator.platform ?? "").startsWith("Mac");

// Module-level registry, re-published every render by useAppCommands so
// menu actions and the keydown listener never see stale closures.
let registry: AppCommand[] = [];
// True once the native macOS menu is installed — its key equivalents consume
// accelerators before the webview, so the DOM listener must not double-fire.
let nativeMenuActive = false;

export function setCommands(commands: AppCommand[]) {
  registry = commands;
}

export function getCommands(): AppCommand[] {
  return registry;
}

export function runCommand(id: string) {
  const cmd = registry.find((c) => c.id === id);
  if (cmd?.enabled) cmd.run();
}

export function setNativeMenuActive() {
  nativeMenuActive = true;
}

export function isNativeMenuActive() {
  return nativeMenuActive;
}

export function matchesShortcut(e: KeyboardEvent, shortcut: string, mac: boolean = isMac): boolean {
  const parts = shortcut.split("+");
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  const mod = mac ? e.metaKey : e.ctrlKey;
  return (
    mods.has("mod") === mod &&
    mods.has("shift") === e.shiftKey &&
    mods.has("alt") === e.altKey &&
    e.key.toLowerCase() === key
  );
}

/** "mod+shift+p" → "CmdOrCtrl+Shift+P" (Tauri accelerator format) */
export function toAccelerator(shortcut: string): string {
  return shortcut
    .split("+")
    .map((p) => (p === "mod" ? "CmdOrCtrl" : p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join("+");
}

/** "mod+shift+p" → "⇧⌘P" on macOS, "Ctrl+Shift+P" elsewhere (for UI hints) */
export function formatShortcut(shortcut: string, mac: boolean = isMac): string {
  const parts = shortcut.split("+");
  if (mac) {
    const sym: Record<string, string> = { mod: "⌘", shift: "⇧", alt: "⌥" };
    // macOS convention: modifiers ordered ⌥⇧⌘, key last
    const order = ["alt", "shift", "mod"];
    const mods = order.filter((m) => parts.includes(m)).map((m) => sym[m]);
    return [...mods, parts[parts.length - 1].toUpperCase()].join("");
  }
  return parts
    .map((p) => (p === "mod" ? "Ctrl" : p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join("+");
}
