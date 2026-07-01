import React, { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { usePullRequests } from "../../hooks/useGitHub";
import { PullRequestItem } from "./PullRequestItem";
import { PullRequestDetail } from "./PullRequestDetail";
import { CreatePRDialog } from "./CreatePRDialog";
import type { PullRequest } from "../../types/github";

export function PullRequestsView() {
  const { data: prs = [], isLoading, error, refetch, isFetching } = usePullRequests();
  const [selected, setSelected] = useState<PullRequest | null>(null);
  const [creating, setCreating] = useState(false);

  if (isLoading) {
    return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>Loading pull requests…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--danger)" }}>
          Could not load pull requests — gh CLI not available or not authenticated.
        </span>
        <code style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          gh auth login
        </code>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* PR list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid var(--border)", gap: 6 }}>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pull Requests
            <span style={{ marginLeft: 6, fontSize: 10, background: "var(--bg-elevated)", padding: "0 4px", borderRadius: 8 }}>
              {prs.length}
            </span>
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
            style={{ color: "var(--text-muted)", padding: 2 }}
          >
            <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : undefined }} />
          </button>
          <button
            onClick={() => setCreating(true)}
            title="New pull request"
            style={{ color: "var(--text-muted)", padding: 2 }}
          >
            <Plus size={13} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {prs.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
              No open pull requests
            </div>
          ) : (
            prs.map((pr) => (
              <PullRequestItem
                key={pr.number}
                pr={pr}
                selected={selected?.number === pr.number}
                onClick={() => setSelected(pr)}
              />
            ))
          )}
        </div>
      </div>

      {/* PR detail */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {selected ? (
          <PullRequestDetail pr={selected} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-muted)" }}>
            <span style={{ fontSize: 12 }}>Select a pull request to view details</span>
            <button
              onClick={() => setCreating(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
            >
              <Plus size={13} />
              New Pull Request
            </button>
          </div>
        )}
      </div>

      {creating && <CreatePRDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
