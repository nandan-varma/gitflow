import React, { useEffect, useRef } from "react";
import { useUIStore } from "../store/uiStore";

export function ContextMenu() {
  const { contextMenu, hideContextMenu } = useUIStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hideContextMenu(); };
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
            <div key={i} style={{ height: 1, background: "var(--border)", margin: "3px 0" }} />
          ) : (
            <button
              key={i}
              onMouseDown={(e) => {
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
