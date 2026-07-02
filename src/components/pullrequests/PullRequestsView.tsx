import React, { useState, useMemo } from "react";
import { Plus, RefreshCw, GitPullRequest, AlertCircle } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";
import { usePullRequests, useIssues, useCreateIssueWeb } from "../../hooks/useGitHub";
import { PullRequestItem } from "./PullRequestItem";
import { PullRequestDetail } from "./PullRequestDetail";
import { IssueItem } from "./IssueItem";
import { IssueDetail } from "./IssueDetail";
import { CreatePRDialog } from "./CreatePRDialog";
import type { ActivityType, PRState, IssueState, ActivityItem } from "../../types/github";

// ─── Filter pill group ────────────────────────────────────────────────────────

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "2px 9px",
              fontSize: 11,
              borderRadius: 10,
              border: "1px solid",
              borderColor: active ? "var(--accent)" : "var(--border)",
              background: active ? "rgba(76,139,245,0.15)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              fontWeight: active ? 500 : 400,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: "both",   label: "All" },
  { value: "prs",    label: "PRs" },
  { value: "issues", label: "Issues" },
];

const PR_STATE_OPTIONS: { value: PRState; label: string }[] = [
  { value: "open",   label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "merged", label: "Merged" },
  { value: "all",    label: "All" },
];

const ISSUE_STATE_OPTIONS: { value: IssueState; label: string }[] = [
  { value: "open",   label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all",    label: "All" },
];

export function PullRequestsView() {
  const [activityType, setActivityType] = useState<ActivityType>("both");
  const [prState, setPRState] = useState<PRState>("open");
  const [issueState, setIssueState] = useState<IssueState>("open");
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [creating, setCreating] = useState<"pr" | "issue" | null>(null);

  const createIssueWeb = useCreateIssueWeb();

  const showPRs = activityType === "prs" || activityType === "both";
  const showIssues = activityType === "issues" || activityType === "both";

  // For "both" mode use the same state for both, but issues have no "merged"
  const effectiveIssueState: IssueState =
    activityType === "both" ? (prState === "merged" ? "all" : prState as IssueState) : issueState;

  const prQuery    = usePullRequests(prState, showPRs);
  const issueQuery = useIssues(effectiveIssueState, showIssues);

  const isLoading = (showPRs && prQuery.isLoading) || (showIssues && issueQuery.isLoading);
  const hasError  = (showPRs && !!prQuery.error)   || (showIssues && !!issueQuery.error);
  const isFetching = (showPRs && prQuery.isFetching) || (showIssues && issueQuery.isFetching);

  // Merge + sort by createdAt descending
  const items = useMemo<ActivityItem[]>(() => {
    const result: ActivityItem[] = [];
    if (showPRs) {
      (prQuery.data ?? []).forEach((pr) => result.push({ kind: "pr", data: pr }));
    }
    if (showIssues) {
      (issueQuery.data ?? []).forEach((issue) => result.push({ kind: "issue", data: issue }));
    }
    return result.sort(
      (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
    );
  }, [prQuery.data, issueQuery.data, showPRs, showIssues]);

  // Reset selected item when filters change
  const handleTypeChange = (t: ActivityType) => {
    setActivityType(t);
    setSelected(null);
    // Reset merged state if switching away from PRs-only
    if (t !== "prs" && prState === "merged") setPRState("open");
  };

  const handlePRStateChange = (s: PRState) => {
    setPRState(s);
    setSelected(null);
  };

  const handleIssueStateChange = (s: IssueState) => {
    setIssueState(s);
    setSelected(null);
  };

  const handleRefresh = () => {
    if (showPRs)   prQuery.refetch();
    if (showIssues) issueQuery.refetch();
  };

  // State pill options depend on type.
  // "both" uses ISSUE_STATE_OPTIONS (no "merged") and effectiveIssueState as value
  // so the pill always shows a valid option regardless of prState.
  const stateOptions  = activityType === "prs" ? PR_STATE_OPTIONS : ISSUE_STATE_OPTIONS;
  const stateValue    = activityType === "issues" ? issueState
                      : activityType === "both"   ? effectiveIssueState
                      : prState;
  const onStateChange = (v: string) =>
    activityType === "issues" ? handleIssueStateChange(v as IssueState) : handlePRStateChange(v as PRState);

  const emptyLabel =
    activityType === "prs" ? `No ${prState} pull requests`
    : activityType === "issues" ? `No ${issueState} issues`
    : `No ${prState} activity`;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left column: filters + list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Filter bar */}
        <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Pills value={activityType} onChange={handleTypeChange} options={TYPE_OPTIONS} />
            <div style={{ flex: 1 }} />
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              title="Refresh"
              style={{ color: "var(--text-muted)", padding: 2, display: "flex" }}
            >
              <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : undefined }} />
            </button>
            {(showPRs) && (
              <button
                onClick={() => setCreating("pr")}
                title="New pull request"
                style={{ color: "var(--text-muted)", padding: 2, display: "flex" }}
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {/* State pills row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Pills
              value={stateValue}
              onChange={onStateChange}
              options={stateOptions}
            />
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
              {items.length}
            </span>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton variant="row" height={40} count={4} />
            </div>
          ) : hasError ? (
            <div className="empty-state" style={{ padding: "24px 12px" }}>
              <AlertCircle size={24} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 12, color: "var(--danger)" }}>gh CLI not available or not authenticated</span>
              <code style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>gh auth login</code>
              <button style={{ fontSize: 11, marginTop: 8, padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-elevated)", cursor: "pointer" }}
                onClick={() => handleRefresh()}>
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 12px" }}>
              <GitPullRequest size={28} style={{ opacity: 0.3 }} />
              <span>{emptyLabel}</span>
            </div>
          ) : (
            items.map((item) =>
              item.kind === "pr" ? (
                <PullRequestItem
                  key={`pr-${item.data.number}`}
                  pr={item.data}
                  selected={selected?.kind === "pr" && selected.data.number === item.data.number}
                  onClick={() => setSelected(item)}
                />
              ) : (
                <IssueItem
                  key={`issue-${item.data.number}`}
                  issue={item.data}
                  selected={selected?.kind === "issue" && selected.data.number === item.data.number}
                  onClick={() => setSelected(item)}
                />
              )
            )
          )}
        </div>
      </div>

      {/* Right column: detail */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {selected ? (
          selected.kind === "pr"
            ? <PullRequestDetail pr={selected.data} />
            : <IssueDetail issue={selected.data} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-muted)" }}>
            <span style={{ fontSize: 12 }}>Select an item to view details</span>
            <div style={{ display: "flex", gap: 8 }}>
              {showPRs && (
                <button
                  onClick={() => setCreating("pr")}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
                >
                  <Plus size={13} /> New PR
                </button>
              )}
              {showIssues && (
                <button
                  onClick={() => createIssueWeb.mutate()}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
                >
                  <Plus size={13} /> New Issue
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {creating === "pr" && <CreatePRDialog onClose={() => setCreating(null)} />}
    </div>
  );
}
