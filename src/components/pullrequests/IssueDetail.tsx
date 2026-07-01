import React from "react";
import { ExternalLink, CircleDot, CheckCircle2 } from "lucide-react";
import { useIssueDetail, useOpenIssue } from "../../hooks/useGitHub";
import type { Issue } from "../../types/github";

export function IssueDetail({ issue }: { issue: Issue }) {
  const { data: detail } = useIssueDetail(issue.number);
  const openInBrowser = useOpenIssue();
  const isOpen = issue.state === "OPEN";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ marginTop: 2 }}>
            {isOpen
              ? <CircleDot size={14} style={{ color: "var(--success)" }} />
              : <CheckCircle2 size={14} style={{ color: "var(--text-muted)" }} />
            }
          </div>
          <h2 style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.4 }}>
            {issue.title}
            <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 400 }}>
              #{issue.number}
            </span>
          </h2>
          <button
            onClick={() => openInBrowser.mutate(issue.number)}
            title="Open in browser"
            style={{ color: "var(--text-muted)", padding: 3, flexShrink: 0 }}
          >
            <ExternalLink size={13} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 11, color: "var(--text-muted)", paddingLeft: 22, flexWrap: "wrap" }}>
          <span>by {issue.author.login}</span>
          <span
            style={{
              padding: "1px 7px", borderRadius: 10, fontSize: 10,
              background: isOpen ? "rgba(76,175,80,0.15)" : "rgba(130,80,223,0.15)",
              color: isOpen ? "var(--success)" : "var(--text-muted)",
            }}
          >
            {isOpen ? "Open" : "Closed"}
          </span>
          {issue.comments > 0 && <span>{issue.comments} comments</span>}
        </div>
        {issue.labels.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap", paddingLeft: 22 }}>
            {issue.labels.map((l) => (
              <span key={l.name} style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 10,
                background: `#${l.color}22`,
                color: `#${l.color}`,
                border: `1px solid #${l.color}55`,
              }}>
                {l.name}
              </span>
            ))}
          </div>
        )}
        {issue.assignees.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 4, fontSize: 11, color: "var(--text-muted)", paddingLeft: 22, alignItems: "center" }}>
            <span>Assigned to</span>
            {issue.assignees.map((a) => (
              <span key={a.login} style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{a.login}</span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {detail?.body ? (
          <pre style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.5, userSelect: "text", WebkitUserSelect: "text" }}>
            {detail.body}
          </pre>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No description</span>
        )}
      </div>
    </div>
  );
}
