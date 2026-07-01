import React, { useState } from "react";
import { GitCommit, GitMerge, Sparkles } from "lucide-react";
import { ipc, toErrMsg } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";
import { useUIStore } from "../../store/uiStore";
import { useFileStatus } from "../../hooks/useFileStatus";

export function CommitEditor() {
  const [message, setMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { amending, setAmending, setActiveView } = useUIStore();
  const { data: status = [] } = useFileStatus();

  const stagedCount = status.filter((f) => f.staged).length;
  const subjectLine = message.split("\n")[0] ?? "";
  const subjectTooLong = subjectLine.length > 72;

  const handleCommit = async () => {
    if (!message.trim() || stagedCount === 0) return;
    setIsCommitting(true);
    setError(null);
    try {
      if (amending) {
        await ipc.amendCommit(message);
        setAmending(false);
      } else {
        await ipc.createCommit(message);
      }
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["diff"] });
      queryClient.invalidateQueries({ queryKey: ["repo"] });
      setActiveView("graph");
    } catch (e: unknown) {
      setError(toErrMsg(e));
    } finally {
      setIsCommitting(false);
    }
  };

  const canCommit = !!message.trim() && stagedCount > 0 && !isCommitting;

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)", background: "rgba(244,67,54,0.1)", padding: "5px 8px", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ color: "var(--text-muted)" }}>×</button>
        </div>
      )}

      {/* textarea row */}
      <div style={{ position: "relative" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message (subject on first line)"
          rows={3}
          style={{
            width: "100%",
            resize: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.5,
            background: "var(--bg-input)",
            border: `1px solid ${subjectTooLong ? "var(--warning)" : "var(--border)"}`,
            borderRadius: 4,
            padding: "6px 8px",
            color: "var(--text-primary)",
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCommit(); }}
        />
        {subjectLine.length > 0 && (
          <span style={{ position: "absolute", bottom: 5, right: 8, fontSize: 10, color: subjectTooLong ? "var(--warning)" : "var(--text-muted)", pointerEvents: "none" }}>
            {subjectLine.length}/72
          </span>
        )}
      </div>

      {/* controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={amending} onChange={(e) => setAmending(e.target.checked)} style={{ width: 12, height: 12 }} />
          Amend
        </label>
        <button
          title="AI commit message (coming in Phase 4)"
          disabled
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 11, opacity: 0.5, cursor: "not-allowed" }}
        >
          <Sparkles size={11} /> AI
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {stagedCount === 0 ? "Nothing staged" : `${stagedCount} file${stagedCount !== 1 ? "s" : ""}`}
        </span>
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          style={{
            padding: "5px 14px",
            borderRadius: 5,
            background: canCommit ? "var(--accent)" : "var(--bg-elevated)",
            color: canCommit ? "#fff" : "var(--text-muted)",
            fontWeight: 500,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 5,
            border: "1px solid transparent",
            whiteSpace: "nowrap",
          }}
        >
          <GitCommit size={13} />
          {isCommitting ? "Committing…" : amending ? "Amend" : "Commit"}
        </button>
      </div>
    </div>
  );
}
