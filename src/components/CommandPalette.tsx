import React, { useMemo, useRef, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { useRepoStore } from "../store/repoStore";
import { getCommands, formatShortcut } from "../lib/commands";

interface Entry {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const { recentRepos, currentRepoPath, openRepository } = useRepoStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries: Entry[] = useMemo(() => {
    const cmds: Entry[] = getCommands()
      .filter((c) => c.enabled && c.id !== "command-palette")
      .map((c) => ({ id: c.id, label: c.label, hint: c.shortcut && formatShortcut(c.shortcut), run: c.run }));
    const recents: Entry[] = recentRepos
      .filter((p) => p !== currentRepoPath)
      .map((p) => ({ id: `recent:${p}`, label: `Open Recent: ${p.split("/").slice(-2).join("/")}`, run: () => openRepository(p) }));
    return [...cmds, ...recents];
  }, [recentRepos, currentRepoPath, openRepository]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q));
  }, [entries, query]);

  const sel = Math.min(selected, Math.max(0, filtered.length - 1));

  useEffect(() => {
    listRef.current?.children[sel]?.scrollIntoView({ block: "nearest" });
  }, [sel, filtered]);

  const runEntry = (entry: Entry) => {
    closeDialog();
    entry.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(Math.min(sel + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(sel - 1, 0));
    } else if (e.key === "Enter" && filtered[sel]) {
      e.preventDefault();
      runEntry(filtered[sel]);
    }
  };

  return (
    <div className="dialog-overlay" style={{ alignItems: "flex-start", paddingTop: "15vh" }} onClick={closeDialog}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{ width: 480, padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKeyDown}
            placeholder="Type a command…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={filtered[sel] ? `palette-item-${sel}` : undefined}
            style={{ flex: 1, fontSize: 13, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)" }}
          />
        </div>
        <div ref={listRef} id="palette-listbox" role="listbox" aria-label="Commands" style={{ maxHeight: 320, overflowY: "auto", padding: "4px 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>No matching commands</div>
          )}
          {filtered.map((entry, i) => (
            <div
              key={entry.id}
              id={`palette-item-${i}`}
              role="option"
              aria-selected={i === sel}
              onClick={() => runEntry(entry)}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 14px",
                fontSize: 12,
                cursor: "pointer",
                color: "var(--text-primary)",
                background: i === sel ? "var(--bg-hover)" : "none",
              }}
            >
              <span>{entry.label}</span>
              {entry.hint && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{entry.hint}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
