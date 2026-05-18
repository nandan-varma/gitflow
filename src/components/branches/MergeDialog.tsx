import React, { useState } from "react";
import { useMergeBranch } from "../../hooks/useBranches";
import { useUIStore } from "../../store/uiStore";

export function MergeDialog() {
  const { closeDialog, dialogPayload, setActiveView } = useUIStore();
  const branchName = dialogPayload as string;
  const [error, setError] = useState<string | null>(null);
  const merge = useMergeBranch();

  const handleMerge = async () => {
    setError(null);
    try {
      const result = await merge.mutateAsync(branchName);
      if (result.has_conflicts) {
        setActiveView("conflicts");
      }
      closeDialog();
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={closeDialog}>
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, minWidth: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Merge Branch</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
          Merge <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{branchName}</code> into current branch?
        </div>
        {error && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 10, background: "rgba(244,67,54,0.1)", padding: "6px 8px", borderRadius: 4 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={closeDialog} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}>
            Cancel
          </button>
          <button
            onClick={handleMerge}
            style={{ padding: "5px 12px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500 }}
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}
