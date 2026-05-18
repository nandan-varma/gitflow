import React from "react";
import { useCommitDetail } from "../../hooks/useCommitGraph";
import { useUIStore } from "../../store/uiStore";
import { useDiffCommit } from "../../hooks/useDiff";
import { DiffView } from "../diff/DiffView";
import { formatRelativeTime } from "../../lib/diffParser";
import { GitCommit } from "lucide-react";

export function CommitDetail() {
  const { selectedCommitOid, selectedFilePath } = useUIStore();
  const { data: detail, isLoading } = useCommitDetail(selectedCommitOid);
  const { data: diff } = useDiffCommit(
    selectedCommitOid,
    selectedFilePath
  );

  if (!selectedCommitOid) {
    return (
      <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
        Select a commit to view details
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>;
  }

  if (!detail) return null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: 12, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
          {detail.summary}
        </div>
        {detail.body && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginBottom: 8 }}>
            {detail.body}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 2 }}>
          <span>{detail.author_name} &lt;{detail.author_email}&gt;</span>
          <span>{formatRelativeTime(detail.timestamp)}</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{detail.oid.slice(0, 12)}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>{detail.stats.files_changed} files</span>
          <span style={{ color: "var(--success)" }}>+{detail.stats.insertions}</span>
          <span style={{ color: "var(--danger)" }}>-{detail.stats.deletions}</span>
        </div>
      </div>

      {diff && selectedFilePath && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <DiffView diff={diff} path={selectedFilePath} mode="staged" />
        </div>
      )}
    </div>
  );
}
