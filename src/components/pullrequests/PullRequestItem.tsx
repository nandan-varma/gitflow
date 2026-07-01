import React from "react";
import { GitPullRequest, GitPullRequestDraft, CheckCircle, XCircle, Clock } from "lucide-react";
import type { PullRequest } from "../../types/github";

function CIBadge({ rollup }: { rollup: PullRequest["statusCheckRollup"] }) {
  const state = rollup?.[0]?.state;
  if (!state) return null;
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    SUCCESS: { icon: <CheckCircle size={10} />, color: "var(--success)" },
    FAILURE: { icon: <XCircle size={10} />, color: "var(--danger)" },
    PENDING: { icon: <Clock size={10} />, color: "var(--warning)" },
    ERROR:   { icon: <XCircle size={10} />, color: "var(--danger)" },
  };
  const entry = map[state] ?? map.PENDING;
  return <span style={{ color: entry.color, flexShrink: 0, display: "flex" }}>{entry.icon}</span>;
}

function ReviewBadge({ decision }: { decision: PullRequest["reviewDecision"] }) {
  if (!decision || decision === "REVIEW_REQUIRED") return null;
  const approved = decision === "APPROVED";
  return (
    <span style={{
      fontSize: 9, padding: "1px 5px", borderRadius: 8, flexShrink: 0,
      background: approved ? "rgba(76,175,80,0.15)" : "rgba(255,82,82,0.15)",
      color: approved ? "var(--success)" : "var(--danger)",
    }}>
      {approved ? "approved" : "changes"}
    </span>
  );
}

export function PullRequestItem({
  pr,
  selected,
  onClick,
}: {
  pr: PullRequest;
  selected: boolean;
  onClick: () => void;
}) {
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
        {pr.isDraft
          ? <GitPullRequestDraft size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          : <GitPullRequest size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
        }
        <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pr.title}
        </span>
        <CIBadge rollup={pr.statusCheckRollup} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 18 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          #{pr.number}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {pr.headRefName} → {pr.baseRefName}
        </span>
        <ReviewBadge decision={pr.reviewDecision} />
        {pr.isDraft && (
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-muted)", flexShrink: 0 }}>
            draft
          </span>
        )}
      </div>
    </div>
  );
}
