import React from "react";
import { useUIStore } from "../../store/uiStore";
import { CommitDetail } from "../commit/CommitDetail";

export function ContextPanel() {
  const { selectedCommitOid } = useUIStore();

  return (
    <aside style={{ background: "var(--bg-surface)", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div data-tauri-drag-region className="panel-header" style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, letterSpacing: "0.06em" }}>
        DETAILS
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {selectedCommitOid ? (
          <CommitDetail />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 12, padding: 16, textAlign: "center" }}>
            Select a commit to view details
          </div>
        )}
      </div>
    </aside>
  );
}
