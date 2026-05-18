import React from "react";
import { X, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useCommandLogStore } from "../../store/commandLogStore";
import { useUIStore } from "../../store/uiStore";
import { formatRelativeTime } from "../../lib/diffParser";

interface Props {
  height: number;
}

export function CommandLog({ height }: Props) {
  const { entries, clearLog } = useCommandLogStore();
  const { toggleCommandLog } = useUIStore();

  return (
    <div
      style={{
        position: "absolute",
        bottom: "var(--commit-bar-height)",
        left: 0,
        right: 0,
        height,
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "4px 10px", borderBottom: "1px solid var(--border)", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 }}>
          Git Command Log
        </span>
        <button onClick={clearLog} title="Clear log" style={{ color: "var(--text-muted)", padding: 3 }}>
          <Trash2 size={12} />
        </button>
        <button onClick={toggleCommandLog} title="Close" style={{ color: "var(--text-muted)", padding: 3 }}>
          <X size={14} />
        </button>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {entries.length === 0 ? (
          <div style={{ padding: 10, color: "var(--text-muted)", fontSize: 11, textAlign: "center" }}>
            No commands yet
          </div>
        ) : (
          [...entries].reverse().map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                padding: "4px 10px",
                borderBottom: "1px solid var(--border)",
                gap: 6,
                opacity: entry.success ? 1 : 0.9,
              }}
            >
              {entry.success ? (
                <CheckCircle size={11} style={{ color: "var(--success)", marginTop: 2, flexShrink: 0 }} />
              ) : (
                <XCircle size={11} style={{ color: "var(--danger)", marginTop: 2, flexShrink: 0 }} />
              )}
              <pre
                style={{
                  flex: 1,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: entry.success ? "var(--text-primary)" : "var(--danger)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {entry.command}
              </pre>
              <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                {entry.duration_ms}ms
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
