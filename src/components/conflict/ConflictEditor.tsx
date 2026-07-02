import React, { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ipc } from "../../lib/ipc";
import { queryClient, queryKeys } from "../../lib/queryClient";
import { useUIStore } from "../../store/uiStore";
import type { ConflictDetail } from "../../types/git";

export function ConflictEditor() {
  const { data: conflicts = [], isLoading: conflictsLoading } = useQuery({
    queryKey: queryKeys.conflicts,
    queryFn: () => ipc.getConflicts(),
  });

  const { cherryPickInProgress, setCherryPickInProgress } = useUIStore();
  const [activeConflictPath, setActiveConflictPath] = useState<string | null>(null);

  React.useEffect(() => {
    if (!conflictsLoading && conflicts.length === 0 && cherryPickInProgress) {
      setCherryPickInProgress(false, null);
    }
  }, [conflicts, conflictsLoading, cherryPickInProgress, setCherryPickInProgress]);

  React.useEffect(() => {
    if (!activeConflictPath && conflicts.length > 0) {
      setActiveConflictPath(conflicts[0].path);
    }
  }, [conflicts, activeConflictPath]);

  const activePath = activeConflictPath ?? conflicts[0]?.path;

  const { data: detail } = useQuery({
    queryKey: queryKeys.conflictDetail(activePath ?? ""),
    queryFn: () => ipc.getConflictDetail(activePath!),
    enabled: !!activePath,
  });

  const resolve = useMutation({
    mutationFn: ({ path, resolution }: { path: string; resolution: string }) =>
      ipc.resolveConflict(path, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["conflict"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });

  if (conflictsLoading) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton width="70%" height={14} />
        <Skeleton variant="row" count={3} />
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--success)", gap: 8, fontSize: 13 }}>
        <Check size={16} />
        No conflicts
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "8px 12px", background: "rgba(244,67,54,0.1)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <AlertTriangle size={14} style={{ color: "var(--danger)" }} />
        <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
          {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} to resolve
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* File list */}
        <div style={{ width: 200, borderRight: "1px solid var(--border)", overflow: "auto" }}>
          {conflicts.map((c) => (
            <button
              key={c.path}
              onClick={() => setActiveConflictPath(c.path)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 12px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: activePath === c.path ? "var(--text-primary)" : "var(--text-secondary)",
                background: activePath === c.path ? "var(--bg-selected)" : "transparent",
                borderLeft: `2px solid ${activePath === c.path ? "var(--danger)" : "transparent"}`,
              }}
            >
              {c.path.split("/").pop()}
            </button>
          ))}
        </div>

        {/* 3-pane editor — key forces remount on file switch so state doesn't bleed across files */}
        {detail && activePath && (
          <ConflictPane key={activePath} detail={detail} path={activePath} onResolve={(res) => resolve.mutate({ path: activePath, resolution: res })} />
        )}
      </div>
    </div>
  );
}

function ConflictPane({
  detail,
  path,
  onResolve,
}: {
  detail: ConflictDetail;
  path: string;
  onResolve: (resolution: string) => void;
}) {
  const blockText = (i: number, res: string) =>
    [...detail.conflicts[i].before_lines, res].join("\n");

  // Tracks what each button last set so we can do a targeted replacement in the textarea
  const lastRes = React.useRef<string[]>(detail.conflicts.map(() => ""));

  // Content after the last conflict block — must survive into the resolution
  const tail = detail.trailing_lines.length ? "\n" + detail.trailing_lines.join("\n") : "";

  const [editableResult, setEditableResult] = useState(() =>
    detail.conflicts.map((_, i) => blockText(i, "")).join("\n") + tail
  );

  const applyChoice = (i: number, newRes: string) => {
    const oldBlock = blockText(i, lastRes.current[i]);
    const newBlock = blockText(i, newRes);
    lastRes.current[i] = newRes;
    setEditableResult(prev => {
      if (!oldBlock) {
        // Empty section (no before_lines + empty old res): can't locate, full rebuild
        return detail.conflicts.map((_, j) => blockText(j, lastRes.current[j])).join("\n") + tail;
      }
      const idx = prev.indexOf(oldBlock);
      if (idx < 0) {
        // User edited this section beyond recognition: rebuild from tracked choices
        return detail.conflicts.map((_, j) => blockText(j, lastRes.current[j])).join("\n") + tail;
      }
      return prev.slice(0, idx) + newBlock + prev.slice(idx + oldBlock.length);
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Ours panel */}
      <div style={{ flex: 1, overflow: "auto", borderRight: "1px solid var(--border)" }}>
        <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--success)", background: "rgba(76,175,80,0.08)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Ours (Current)
        </div>
        {detail.conflicts.map((block, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "4px 8px" }}>
              {block.ours_lines.map((l, j) => (
                <pre key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--success)", margin: 0 }}>{l}</pre>
              ))}
            </div>
            <button
              onClick={() => applyChoice(i, detail.conflicts[i].ours_lines.join("\n"))}
              style={{ display: "block", width: "100%", padding: "3px 8px", fontSize: 11, color: "var(--success)", background: "rgba(76,175,80,0.12)", textAlign: "left" }}
            >
              ▶ Use Ours
            </button>
          </div>
        ))}
      </div>

      {/* Result panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg-elevated)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Result — edit freely
        </div>
        <textarea
          style={{
            flex: 1,
            width: "100%",
            resize: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "none",
            padding: 8,
            boxSizing: "border-box",
          }}
          value={editableResult}
          onChange={(e) => setEditableResult(e.target.value)}
        />
        <div style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => onResolve(editableResult)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 4,
              background: "var(--success)", color: "#fff",
              fontSize: 12, fontWeight: 500, width: "100%", justifyContent: "center",
            }}
          >
            <Check size={13} />
            Mark Resolved
          </button>
        </div>
      </div>

      {/* Theirs panel */}
      <div style={{ flex: 1, overflow: "auto", borderLeft: "1px solid var(--border)" }}>
        <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--info)", background: "rgba(33,150,243,0.08)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Theirs (Incoming)
        </div>
        {detail.conflicts.map((block, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "4px 8px" }}>
              {block.theirs_lines.map((l, j) => (
                <pre key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--info)", margin: 0 }}>{l}</pre>
              ))}
            </div>
            <button
              onClick={() => applyChoice(i, detail.conflicts[i].theirs_lines.join("\n"))}
              style={{ display: "block", width: "100%", padding: "3px 8px", fontSize: 11, color: "var(--info)", background: "rgba(33,150,243,0.12)", textAlign: "left" }}
            >
              ▶ Use Theirs
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
