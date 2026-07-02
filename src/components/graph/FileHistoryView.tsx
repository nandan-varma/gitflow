import React, { useState } from "react";
import { useUIStore } from "../../store/uiStore";
import { useFileHistory } from "../../hooks/useDiff";
import { useDiffCommit } from "../../hooks/useDiff";
import { Skeleton } from "../ui/Skeleton";
import { DiffView } from "../diff/DiffView";
import { formatRelativeTime } from "../../lib/diffParser";
import { ArrowLeft, GitCommit } from "lucide-react";

export function FileHistoryView() {
  const { fileHistoryPath, setActiveView } = useUIStore();
  const { data: entries = [], isLoading } = useFileHistory(fileHistoryPath);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const { data: diff } = useDiffCommit(selectedOid, fileHistoryPath);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg-surface)" }}>
        <button onClick={() => setActiveView("graph")} style={{ color: "var(--text-muted)", padding: 2 }}>
          <ArrowLeft size={14} />
        </button>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
          {fileHistoryPath ?? ""}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>file history</span>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Commit list */}
        <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--border)", overflowY: "auto" }}>
          {isLoading && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton width="90%" height={12} />
              <Skeleton width="70%" height={12} />
              <Skeleton width="85%" height={12} />
              <Skeleton width="60%" height={12} />
            </div>
          )}
          {!isLoading && entries.length === 0 && (
            <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>No history found.</div>
          )}
          {entries.map((e) => (
            <div
              key={e.oid}
              onClick={() => setSelectedOid(e.oid === selectedOid ? null : e.oid)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                background: selectedOid === e.oid ? "rgba(76,139,245,0.12)" : undefined,
                borderLeft: selectedOid === e.oid ? "2px solid var(--accent)" : "2px solid transparent",
              }}
              onMouseEnter={(el) => { if (selectedOid !== e.oid) el.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={(el) => { if (selectedOid !== e.oid) el.currentTarget.style.background = ""; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <GitCommit size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{e.oid.slice(0, 7)}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>{formatRelativeTime(e.timestamp)}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.summary}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{e.author_name}</div>
            </div>
          ))}
        </div>

        {/* Diff panel */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {diff && fileHistoryPath ? (
            <DiffView diff={diff} path={fileHistoryPath} mode="workdir" />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 12 }}>
              Select a commit to view diff
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
