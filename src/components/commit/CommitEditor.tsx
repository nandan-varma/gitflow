import React, { useState } from "react";
import { GitCommit, GitMerge, Sparkles } from "lucide-react";
import { ipc } from "../../lib/ipc";
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
      setError(String(e));
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 12,
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
          {amending ? "Amend Commit" : "Commit"}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={amending}
            onChange={(e) => setAmending(e.target.checked)}
            style={{ width: 12, height: 12 }}
          />
          Amend
        </label>
      </div>

      {/* Message textarea */}
      <div style={{ position: "relative", flex: 1 }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message (subject on first line)"
          style={{
            width: "100%",
            height: "100%",
            resize: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.5,
            background: "var(--bg-input)",
            border: `1px solid ${subjectTooLong ? "var(--warning)" : "var(--border)"}`,
            borderRadius: 4,
            padding: 8,
            color: "var(--text-primary)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleCommit();
            }
          }}
        />
        {/* 72-char ruler indicator */}
        {subjectLine.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 6,
              right: 8,
              fontSize: 10,
              color: subjectTooLong ? "var(--warning)" : "var(--text-muted)",
            }}
          >
            {subjectLine.length}/72
          </div>
        )}
      </div>

      {/* AI placeholder */}
      <button
        title="AI commit message (coming in Phase 4)"
        disabled
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 4,
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          fontSize: 11,
          opacity: 0.5,
          cursor: "not-allowed",
        }}
      >
        <Sparkles size={12} />
        Generate with AI (Phase 4)
      </button>

      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)", background: "rgba(244,67,54,0.1)", padding: "6px 8px", borderRadius: 4 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleCommit}
        disabled={!message.trim() || stagedCount === 0 || isCommitting}
        style={{
          padding: "7px 14px",
          borderRadius: 5,
          background: message.trim() && stagedCount > 0 ? "var(--accent)" : "var(--bg-elevated)",
          color: message.trim() && stagedCount > 0 ? "#fff" : "var(--text-muted)",
          fontWeight: 500,
          fontSize: 13,
          opacity: isCommitting ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          border: "1px solid transparent",
        }}
      >
        <GitCommit size={14} />
        {isCommitting ? "Committing…" : amending ? "Amend Commit" : `Commit ${stagedCount > 0 ? `(${stagedCount})` : ""}`}
      </button>

      <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
        {stagedCount === 0 ? "Stage files to commit" : `${stagedCount} file${stagedCount !== 1 ? "s" : ""} staged`}
      </div>
    </div>
  );
}
