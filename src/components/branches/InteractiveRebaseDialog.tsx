import React, { useMemo, useState } from "react";
import { useUIStore } from "../../store/uiStore";
import { useCommitGraph } from "../../hooks/useCommitGraph";
import { ipc, toErrMsg } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";
import { formatRelativeTime } from "../../lib/diffParser";
import { GripVertical } from "lucide-react";

type Action = "pick" | "fixup" | "drop";

interface Step {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
  action: Action;
}

const ACTION_COLOR: Record<Action, string> = {
  pick: "var(--success)",
  fixup: "var(--warning)",
  drop: "var(--danger)",
};

export function InteractiveRebaseDialog() {
  const { closeDialog, setActiveView } = useUIStore();
  const { data } = useCommitGraph();
  const [count, setCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sourceNodes = useMemo(() => data?.pages[0]?.nodes ?? [], [data]);

  const [steps, setSteps] = useState<Step[]>(() =>
    sourceNodes.slice(0, count).map((n) => ({
      oid: n.oid,
      message: n.summary,
      author: n.author_name,
      timestamp: n.timestamp,
      action: "pick" as Action,
    }))
  );

  // Sync steps when count changes
  const handleCountChange = (n: number) => {
    setCount(n);
    setSteps(
      sourceNodes.slice(0, n).map((node) => ({
        oid: node.oid,
        message: node.summary,
        author: node.author_name,
        timestamp: node.timestamp,
        action: "pick" as Action,
      }))
    );
  };

  const setAction = (i: number, action: Action) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, action } : s)));
  };

  const handleRebase = async () => {
    setError(null);
    setPending(true);
    try {
      // steps are newest-first in UI; git rebase -i wants oldest-first
      const ordered = [...steps].reverse();
      const base = `HEAD~${steps.length}`;
      await ipc.interactiveRebase(base, ordered.map((s) => ({ action: s.action, oid: s.oid, message: s.message })));
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      closeDialog();
    } catch (e) {
      const msg = toErrMsg(e);
      if (msg.toLowerCase().includes("conflict")) {
        setActiveView("conflicts");
        closeDialog();
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog-card" style={{ width: 540, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Interactive Rebase</div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Last</span>
          <select
            value={count}
            onChange={(e) => handleCountChange(Number(e.target.value))}
            style={{ fontSize: 12, padding: "2px 6px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" }}
          >
            {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>commits</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
            pick = keep · fixup = squash into prev · drop = remove
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
          {steps.map((step, i) => (
            <div
              key={step.oid}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 4,
                background: step.action === "drop" ? "rgba(244,67,54,0.06)" : "var(--bg-surface)",
                border: "1px solid var(--border)",
                opacity: step.action === "drop" ? 0.5 : 1,
              }}
            >
              <GripVertical size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <select
                value={step.action}
                onChange={(e) => setAction(i, e.target.value as Action)}
                style={{ fontSize: 11, padding: "1px 4px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 3, color: ACTION_COLOR[step.action], fontWeight: 600, flexShrink: 0 }}
              >
                <option value="pick">pick</option>
                <option value="fixup">fixup</option>
                <option value="drop">drop</option>
              </select>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{step.oid.slice(0, 7)}</span>
              <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.message}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{formatRelativeTime(step.timestamp)}</span>
            </div>
          ))}
        </div>

        {error && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 8, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "auto" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={closeDialog} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}>Cancel</button>
          <button
            onClick={handleRebase}
            disabled={pending}
            style={{ padding: "5px 12px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500 }}
          >
            {pending ? "Rebasing…" : "Start Rebase"}
          </button>
        </div>
      </div>
    </div>
  );
}
