import React, { useMemo } from "react";
import { useUIStore } from "../../store/uiStore";
import { useBlame } from "../../hooks/useDiff";
import { Skeleton } from "../ui/Skeleton";
import { formatRelativeTime } from "../../lib/diffParser";
import { ArrowLeft } from "lucide-react";

export function BlameView() {
  const { blameFilePath, setActiveView } = useUIStore();
  const { data: lines = [], isLoading } = useBlame(blameFilePath);

  // Track commit boundaries for zebra striping
  const oidBoundary = useMemo(() => {
    const set = new Set<number>();
    let last = "";
    for (const l of lines) {
      if (l.oid !== last) { set.add(l.line_no); last = l.oid; }
    }
    return set;
  }, [lines]);

  // Alternating shade per commit block
  const oidShade = useMemo(() => {
    const map = new Map<string, boolean>();
    let shade = false;
    let last = "";
    for (const l of lines) {
      if (l.oid !== last) { shade = !shade; last = l.oid; }
      map.set(l.oid, shade);
    }
    return map;
  }, [lines]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg-surface)" }}>
        <button onClick={() => setActiveView("graph")} style={{ color: "var(--text-muted)", padding: 2 }}>
          <ArrowLeft size={14} />
        </button>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
          {blameFilePath ?? ""}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>blame</span>
      </div>

      {isLoading && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton variant="row" count={8} />
        </div>
      )}

      {!isLoading && lines.length === 0 && (
        <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>No blame data available.</div>
      )}

      <div style={{ flex: 1, overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        {lines.map((line) => {
          const isNew = oidBoundary.has(line.line_no);
          const shade = oidShade.get(line.oid) ?? false;
          return (
            <div
              key={line.line_no}
              style={{
                display: "flex",
                minHeight: 20,
                background: shade ? "rgba(255,255,255,0.02)" : "transparent",
                borderTop: isNew ? "1px solid var(--border)" : undefined,
              }}
            >
              {/* Line number */}
              <span style={{ width: 44, textAlign: "right", padding: "0 8px", color: "var(--text-muted)", fontSize: 11, userSelect: "none", flexShrink: 0, lineHeight: "20px" }}>
                {line.line_no}
              </span>

              {/* Commit info — only shown on first line of each group */}
              <div style={{ width: 220, flexShrink: 0, padding: "0 8px", overflow: "hidden", lineHeight: "20px", borderRight: "1px solid var(--border)" }}>
                {isNew ? (
                  <>
                    <span style={{ color: "var(--accent)", marginRight: 6 }}>{line.oid.slice(0, 7)}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{line.author_name}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 10 }}>{formatRelativeTime(line.timestamp)}</span>
                  </>
                ) : null}
              </div>

              {/* Code content */}
              <pre
                style={{ flex: 1, margin: 0, padding: "0 8px", color: "var(--text-primary)", whiteSpace: "pre", lineHeight: "20px", userSelect: "text", WebkitUserSelect: "text" }}
              >
                {line.content}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
