import type React from "react";

/** Keyboard/AT affordances for clickable non-button rows: spread alongside an
 *  onClick to make it focusable, Enter/Space-activatable, and give the
 *  ContextMenu key (or Shift+F10) access to the row's onContextMenu handler. */
export function rowProps(onActivate: () => void): {
  role: string;
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent) => void;
} {
  return {
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent("contextmenu", { clientX: r.left + 12, clientY: r.bottom, bubbles: true }));
      }
    },
  };
}
