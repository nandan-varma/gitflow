import React, { useState } from "react";
import { ExternalLink, GitMerge, GitBranch } from "lucide-react";
import { usePullRequestDetail, useCheckoutPR, useOpenPR, useMergePR } from "../../hooks/useGitHub";
import { useUIStore } from "../../store/uiStore";
import { useConfirmStore } from "../../store/confirmStore";
import type { PullRequest } from "../../types/github";

export function PullRequestDetail({ pr }: { pr: PullRequest }) {
  const { data: detail } = usePullRequestDetail(pr.number);
  const checkout = useCheckoutPR();
  const openInBrowser = useOpenPR();
  const merge = useMergePR();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const { setActiveView } = useUIStore();
  const [strategy, setStrategy] = useState<"merge" | "squash" | "rebase">("merge");

  const canMerge = pr.reviewDecision === "APPROVED" && detail?.mergeable === "MERGEABLE";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <h2 style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.4 }}>
            {pr.title}
            <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 400 }}>
              #{pr.number}
            </span>
          </h2>
          <button
            onClick={() => openInBrowser.mutate(pr.number)}
            title="Open in browser"
            style={{ color: "var(--text-muted)", padding: 3, flexShrink: 0 }}
          >
            <ExternalLink size={13} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>{pr.headRefName}</span>
          <span>→</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{pr.baseRefName}</span>
          <span>by {pr.author.login}</span>
          {detail && (
            <span style={{ marginLeft: "auto" }}>
              <span style={{ color: "var(--success)" }}>+{detail.additions}</span>
              {" / "}
              <span style={{ color: "var(--danger)" }}>-{detail.deletions}</span>
              {" in "}{detail.changedFiles} {detail.changedFiles === 1 ? "file" : "files"}
            </span>
          )}
        </div>
        {detail?.labels && detail.labels.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {detail.labels.map((l) => (
              <span key={l.name} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: `#${l.color}33`, color: `#${l.color}`, border: `1px solid #${l.color}66` }}>
                {l.name}
              </span>
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

      {/* Actions */}
      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
        <button
          onClick={() => checkout.mutate(pr.number, {
            onSuccess: () => setActiveView("graph"),
          })}
          disabled={checkout.isPending}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
        >
          <GitBranch size={12} />
          {checkout.isPending ? "Checking out…" : "Checkout"}
        </button>

        {canMerge && (
          <>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as typeof strategy)}
              style={{ fontSize: 11, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
            >
              <option value="merge">Merge commit</option>
              <option value="squash">Squash and merge</option>
              <option value="rebase">Rebase and merge</option>
            </select>
            <button
              onClick={() => showConfirm({ title: "Merge Pull Request", message: `Merge PR #${pr.number} ("${pr.title}") into ${pr.baseRefName} using ${strategy} strategy? The branch "${pr.headRefName}" will also be deleted.`, danger: true, confirmLabel: "Merge", onConfirm: () => merge.mutate({ number: pr.number, strategy, deleteBranch: true }) })}
              disabled={merge.isPending}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 11, borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 500 }}
            >
              <GitMerge size={12} />
              {merge.isPending ? "Merging…" : "Merge"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
