import React, { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ipc } from "../../lib/ipc";
import { queryClient, queryKeys } from "../../lib/queryClient";
import { useUIStore } from "../../store/uiStore";
import type { ConflictDetail } from "../../types/git";

export function ConflictEditor() {
  const { data: conflicts = [] } = useQuery({
    queryKey: queryKeys.conflicts,
    queryFn: () => ipc.getConflicts(),
  });

  const [activeConflictPath, setActiveConflictPath] = useState<string | null>(
    conflicts[0]?.path ?? null
  );

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
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });

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

        {/* 3-pane editor */}
        {detail && activePath && (
          <ConflictPane detail={detail} path={activePath} onResolve={(res) => resolve.mutate({ path: activePath, resolution: res })} />
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
  const [activeBlock, setActiveBlock] = useState(0);
  const [resolutions, setResolutions] = useState<string[]>(
    detail.conflicts.map(() => "")
  );
  const [editableResult, setEditableResult] = useState(
    detail.conflicts.map((c) => "").join("\n")
  );

  const handleAcceptOurs = (i: number) => {
    const block = detail.conflicts[i];
    const updated = [...resolutions];
    updated[i] = block.ours_lines.join("\n");
    setResolutions(updated);
  };

  const handleAcceptTheirs = (i: number) => {
    const block = detail.conflicts[i];
    const updated = [...resolutions];
    updated[i] = block.theirs_lines.join("\n");
    setResolutions(updated);
  };

  const buildResult = () =>
    detail.conflicts
      .map((c, i) => [...c.before_lines, resolutions[i] || ""].join("\n"))
      .join("\n");

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Ours panel */}
      <div style={{ flex: 1, overflow: "auto", borderRight: "1px solid var(--border)" }}>
        <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg-elevated)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Ours (Current)
        </div>
        {detail.conflicts.map((block, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "4px 8px", background: "rgba(76,175,80,0.08)" }}>
              {block.ours_lines.map((l, j) => (
                <pre key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--success)", margin: 0 }}>{l}</pre>
              ))}
            </div>
            <button
              onClick={() => handleAcceptOurs(i)}
              style={{ display: "block", width: "100%", padding: "3px 8px", fontSize: 11, color: "var(--success)", background: "rgba(76,175,80,0.1)", textAlign: "left" }}
            >
              ▶ Use Ours
            </button>
          </div>
        ))}
      </div>

      {/* Result panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg-elevated)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Result (editable)
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
          }}
          value={buildResult()}
          onChange={(e) => setEditableResult(e.target.value)}
        />
        <div style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => onResolve(buildResult())}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 4,
              background: "var(--success)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              width: "100%",
              justifyContent: "center",
            }}
          >
            <Check size={13} />
            Mark Resolved
          </button>
        </div>
      </div>

      {/* Theirs panel */}
      <div style={{ flex: 1, overflow: "auto", borderLeft: "1px solid var(--border)" }}>
        <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg-elevated)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Theirs (Incoming)
        </div>
        {detail.conflicts.map((block, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "4px 8px", background: "rgba(33,150,243,0.08)" }}>
              {block.theirs_lines.map((l, j) => (
                <pre key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--info)", margin: 0 }}>{l}</pre>
              ))}
            </div>
            <button
              onClick={() => handleAcceptTheirs(i)}
              style={{ display: "block", width: "100%", padding: "3px 8px", fontSize: 11, color: "var(--info)", background: "rgba(33,150,243,0.1)", textAlign: "left" }}
            >
              ▶ Use Theirs
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
