import React, { useRef, useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useConfirmStore } from "../../store/confirmStore";
import { DialogShell } from "./DialogShell";

export function ConfirmDialog() {
  const { dialog, closeConfirm } = useConfirmStore();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef(0);

  const cancelHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => cancelHold();
  }, []);

  const startHold = (onComplete: () => void) => {
    holdStart.current = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - holdStart.current;
      const pct = Math.min(1, elapsed / 800);
      setHoldProgress(pct);
      if (pct >= 1) {
        cancelHold();
        onComplete();
      }
    }, 16);
  };

  if (!dialog) return null;

  const handleConfirm = () => {
    dialog.onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    cancelHold();
    dialog.onCancel?.();
    closeConfirm();
  };

  return (
    <DialogShell
      label={dialog.title}
      onClose={handleCancel}
      className={dialog.danger ? "danger-approval" : undefined}
      style={{ minWidth: 360, maxWidth: 440 }}
    >
        {dialog.danger && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={18} style={{ color: "var(--danger)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--danger)" }}>
              {dialog.title}
            </span>
          </div>
        )}
        {!dialog.danger && (
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "var(--text-primary)" }}>
            {dialog.title}
          </div>
        )}

        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 18, userSelect: "text" }}>
          {dialog.message}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={handleCancel}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              borderRadius: 4,
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
            }}
          >
            Cancel
          </button>

          {dialog.danger ? (
            <button
              onMouseDown={() => startHold(handleConfirm)}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !holdTimer.current) startHold(handleConfirm);
              }}
              onKeyUp={cancelHold}
              onBlur={cancelHold}
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "6px 20px",
                fontSize: 12,
                borderRadius: 4,
                background: "var(--danger)",
                color: "#fff",
                fontWeight: 500,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.2)",
                  width: `${holdProgress * 100}%`,
                  transition: "width 0.1s linear",
                }}
              />
              <span style={{ position: "relative", zIndex: 1 }}>
                {holdProgress > 0 ? "Holding..." : `Hold to ${dialog.confirmLabel ?? "Confirm"}`}
              </span>
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                borderRadius: 4,
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 500,
              }}
            >
              {dialog.confirmLabel ?? "Confirm"}
            </button>
          )}
        </div>
    </DialogShell>
  );
}
