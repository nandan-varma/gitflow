import React from "react";
import { CircleDot, CheckCircle2, MessageSquare } from "lucide-react";
import type { Issue } from "../../types/github";

export function IssueItem({
  issue,
  selected,
  onClick,
}: {
  issue: Issue;
  selected: boolean;
  onClick: () => void;
}) {
  const isOpen = issue.state === "OPEN";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        background: selected ? "var(--bg-selected)" : "transparent",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {isOpen
          ? <CircleDot size={13} style={{ color: "var(--success)", flexShrink: 0 }} />
          : <CheckCircle2 size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        }
        <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {issue.title}
        </span>
        {issue.comments > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
            <MessageSquare size={9} />
            {issue.comments}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
          #{issue.number}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
          by {issue.author.login}
        </span>
        {issue.labels.slice(0, 3).map((l) => (
          <span key={l.name} style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 8,
            background: `#${l.color}22`,
            color: `#${l.color}`,
            border: `1px solid #${l.color}55`,
            flexShrink: 0,
          }}>
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
