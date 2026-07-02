import React, { useEffect, useRef } from "react";
import { useUIStore } from "../store/uiStore";

export function ContextMenu() {
  const { contextMenu, hideContextMenu } = useUIStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    // Focus the first item so arrow keys / Enter work immediately
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideContextMenu();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = Array.from(ref.current?.querySelectorAll("button") ?? []);
      if (!items.length) return;
      const cur = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === "ArrowDown"
        ? (cur + 1) % items.length
        : (cur - 1 + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [contextMenu, hideContextMenu]);

  if (!contextMenu) return null;

  // Clamp menu to viewport
  const menuW = 200;
  const x = Math.min(contextMenu.x, window.innerWidth - menuW - 4);

  return (
    <>
      {/* backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
        onMouseDown={hideContextMenu}
        onContextMenu={(e) => { e.preventDefault(); hideContextMenu(); }}
      />
      <div
        ref={ref}
        className="menu-enter"
        role="menu"
        style={{
          position: "fixed",
          left: x,
          top: contextMenu.y,
          zIndex: 1000,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          minWidth: menuW,
          padding: "4px 0",
          fontSize: 12,
        }}
      >
        {contextMenu.items.map((item, i) =>
          item === "separator" ? (
            <div key={i} role="separator" style={{ height: 1, background: "var(--border)", margin: "3px 0" }} />
          ) : (
            <button
              key={i}
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                hideContextMenu();
                item.action();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "5px 12px",
                color: item.danger ? "var(--danger)" : "var(--text-primary)",
                background: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  );
}
