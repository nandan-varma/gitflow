import React, { useEffect, useRef } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Shared modal chrome: overlay + card, Escape to close, Tab focus trap,
 *  focus restore, and dialog ARIA. All app dialogs render through this. */
export function DialogShell({
  label,
  onClose,
  style,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const card = cardRef.current!;
    const prev = document.activeElement as HTMLElement | null;
    // React autoFocus may already have focused an input inside the card
    if (!card.contains(document.activeElement)) {
      (card.querySelector<HTMLElement>(FOCUSABLE) ?? card).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const els = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement;
        if (!card.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="dialog-overlay" onClick={() => onCloseRef.current()}>
      <div
        ref={cardRef}
        className={`dialog-card${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
