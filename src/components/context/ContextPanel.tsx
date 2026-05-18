import React from "react";
import { useUIStore } from "../../store/uiStore";
import { CommitDetail } from "../commit/CommitDetail";

export function ContextPanel() {
  const { selectedCommitOid } = useUIStore();

  return (
    <aside
      style={{
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {selectedCommitOid ? (
        <CommitDetail />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: 12,
            padding: 16,
            textAlign: "center",
          }}
        >
          Select a commit to view details
        </div>
      )}
    </aside>
  );
}
