import React, { useState } from "react";
import { useRebaseBranch } from "../../hooks/useBranches";
import { useUIStore } from "../../store/uiStore";
import { toErrMsg } from "../../lib/ipc";

export function RebaseDialog() {
  const { closeDialog, dialogPayload } = useUIStore();
  const upstream = dialogPayload as string;
  const [error, setError] = useState<string | null>(null);
  const rebase = useRebaseBranch();

  const handleRebase = async () => {
    setError(null);
    try {
      await rebase.mutateAsync(upstream);
      closeDialog();
    } catch (e: unknown) {
      setError(toErrMsg(e));
    }
  };

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog-card" style={{ minWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Rebase Branch</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
          Rebase current branch onto{" "}
          <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{upstream}</code>?
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
          If conflicts arise, the conflict editor will open. You can resolve each conflict and continue the rebase.
        </div>
        {error && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 10, background: "rgba(244,67,54,0.1)", padding: "6px 8px", borderRadius: 4 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={closeDialog}
            style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}
          >
            Cancel
          </button>
          <button
            onClick={handleRebase}
            disabled={rebase.isPending}
            style={{ padding: "5px 12px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500, opacity: rebase.isPending ? 0.6 : 1 }}
          >
            {rebase.isPending ? "Rebasing…" : "Rebase"}
          </button>
        </div>
      </div>
    </div>
  );
}
