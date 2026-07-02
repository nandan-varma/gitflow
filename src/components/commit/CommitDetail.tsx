import React, { useState } from "react";
import { useCommitDetail } from "../../hooks/useCommitGraph";
import { useDiffCommit } from "../../hooks/useDiff";
import { useUIStore } from "../../store/uiStore";
import { DiffView } from "../diff/DiffView";
import { Skeleton } from "../ui/Skeleton";
import { formatRelativeTime } from "../../lib/diffParser";
import type { ChangedFile } from "../../types/graph";

const STATUS_COLOR: Record<string, string> = {
  added: "var(--success)",
  deleted: "var(--danger)",
  renamed: "var(--warning)",
  modified: "var(--accent)",
};

function FileRow({ file, selected, onSelect }: { file: ChangedFile; selected: boolean; onSelect: () => void }) {
  const color = STATUS_COLOR[file.status] ?? "var(--text-muted)";
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 12px",
        cursor: "pointer",
        background: selected ? "rgba(76,139,245,0.12)" : undefined,
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = ""; }}
    >
      <span style={{ fontSize: 10, color, fontWeight: 600, flexShrink: 0, width: 12, textAlign: "center" }}>
        {file.status[0].toUpperCase()}
      </span>
      <span style={{ flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {file.old_path ? `${file.old_path} → ${file.path}` : file.path}
      </span>
      <span style={{ fontSize: 10, color: "var(--success)", flexShrink: 0 }}>+{file.additions}</span>
      <span style={{ fontSize: 10, color: "var(--danger)", flexShrink: 0 }}>-{file.deletions}</span>
    </div>
  );
}

export function CommitDetail() {
  const { selectedCommitOid } = useUIStore();
  const { data: detail, isLoading } = useCommitDetail(selectedCommitOid);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { data: fileDiff } = useDiffCommit(selectedCommitOid, selectedPath);

  if (!selectedCommitOid) {
    return (
      <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
        Select a commit to view details
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={12} count={2} />
        <Skeleton width="40%" height={12} />
        <div style={{ height: 12 }} />
        <Skeleton variant="row" count={5} />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div data-selectable style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
          {detail.summary}
        </div>
        {detail.body && (
          <div data-selectable style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginBottom: 6 }}>
            {detail.body}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
          <span data-selectable>{detail.author_name} &lt;{detail.author_email}&gt;</span>
          <span>{formatRelativeTime(detail.timestamp)}</span>
          <span data-selectable style={{ fontFamily: "var(--font-mono)" }}>{detail.oid.slice(0, 12)}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>{detail.stats.files_changed} files</span>
          <span style={{ color: "var(--success)" }}>+{detail.stats.insertions}</span>
          <span style={{ color: "var(--danger)" }}>-{detail.stats.deletions}</span>
        </div>
      </div>

      <div style={{ flexShrink: 0, borderBottom: fileDiff ? "1px solid var(--border)" : undefined, maxHeight: "45%", overflowY: "auto" }}>
        {detail.changed_files.map((f) => (
          <FileRow
            key={f.path}
            file={f}
            selected={selectedPath === f.path}
            onSelect={() => setSelectedPath(selectedPath === f.path ? null : f.path)}
          />
        ))}
      </div>

      {fileDiff && selectedPath && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <DiffView diff={fileDiff} path={selectedPath} mode="workdir" />
        </div>
      )}
    </div>
  );
}
