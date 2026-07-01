import React from "react";
import { useUIStore } from "../../store/uiStore";
import { useCommitDetail } from "../../hooks/useCommitGraph";
import { CommitDetail } from "../commit/CommitDetail";

export function ContextPanel() {
  const { selectedCommitOid } = useUIStore();
  const { data: detail } = useCommitDetail(selectedCommitOid);

  return (
    <aside style={{ background: "var(--bg-surface)", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div data-tauri-drag-region className="panel-header" style={{ overflow: "hidden" }}>
        {detail ? (
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={detail.summary}>
            {detail.summary}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.06em" }}>DETAILS</span>
        )}
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
