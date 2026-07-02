import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ToolCallStatus } from "../../store/aiStore";

interface Props {
  call: ToolCallStatus;
}

function truncate(s: string, max = 80): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export function ToolCallCard({ call }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live elapsed counter while running/pending
  useEffect(() => {
    if (call.status === "running" || call.status === "pending") {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - call.startedAt);
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [call.status, call.startedAt]);

  const displayDuration =
    call.durationMs ?? (call.status === "running" || call.status === "pending" ? elapsed : 0);

  const resultText = call.status === "success" ? call.result : call.status === "error" ? call.error : null;

  const dotClass =
    call.status === "running"
      ? "status-dot running"
      : call.status === "pending"
        ? "status-dot pending"
        : call.status === "success"
          ? "status-dot success"
          : "status-dot error";

  return (
    <div className={`tool-call-card ${call.status} msg-enter`}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={dotClass} />
        <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
          {call.name}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {call.status === "pending"
            ? "..."
            : `${(displayDuration / 1000).toFixed(1)}s`}
        </span>
        {resultText && (
          <span style={{ color: "var(--text-muted)" }}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </div>

      {/* Summary line */}
      {call.status === "running" && (
        <div style={{ padding: "0 8px 6px", fontSize: 11, color: "var(--text-secondary)" }}>
          {call.name === "git_fetch" || call.name === "git_push" || call.name === "git_pull"
            ? "Running..."
            : "Executing..."}
        </div>
      )}
      {call.status === "success" && resultText && (
        <div
          style={{ padding: "0 8px 6px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}
          className={!expanded ? undefined : "expanded"}
        >
          {!expanded ? (
            <span>{truncate(resultText)}</span>
          ) : null}
        </div>
      )}
      {call.status === "error" && resultText && (
        <div
          style={{ padding: "0 8px 6px", fontSize: 11, color: "var(--danger)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}
        >
          {truncate(resultText, 200)}
        </div>
      )}

      {/* Expandable raw output */}
      {expanded && resultText && (
        <div
          data-selectable
          style={{
            padding: "6px 8px",
            borderTop: "1px solid var(--border)",
            fontSize: 10.5,
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 200,
            overflow: "auto",
            background: "var(--bg-base)",
            userSelect: "text",
          }}
        >
          {resultText}
        </div>
      )}
    </div>
  );
}
