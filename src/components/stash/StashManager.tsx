import React from "react";
import { Archive, Play, Trash2, Download } from "lucide-react";
import { useStashes, useStashPop, useStashApply, useStashDrop } from "../../hooks/useStashes";
import { useUIStore } from "../../store/uiStore";
import { formatRelativeTime } from "../../lib/diffParser";

export function StashManager() {
  const { data: stashes = [] } = useStashes();
  const { openDialog } = useUIStore();
  const pop = useStashPop();
  const apply = useStashApply();
  const drop = useStashDrop();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <Archive size={14} style={{ color: "var(--text-muted)" }} />
        <span style={{ fontSize: 12, fontWeight: 500 }}>Stash Manager</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => openDialog("stash-push")}
          style={{ padding: "4px 10px", fontSize: 11, borderRadius: 4, background: "var(--accent)", color: "#fff" }}
        >
          New Stash
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {stashes.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            No stashes
          </div>
        ) : (
          stashes.map((s) => (
            <div
              key={s.index}
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Archive size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.message}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  stash@{`{${s.index}}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => apply.mutate(s.index)}
                  title="Apply (keep stash)"
                  style={{ padding: "3px 6px", borderRadius: 3, fontSize: 11, background: "rgba(76,175,80,0.15)", color: "var(--success)" }}
                >
                  <Download size={11} />
                </button>
                <button
                  onClick={() => pop.mutate(s.index)}
                  title="Pop (apply and drop)"
                  style={{ padding: "3px 6px", borderRadius: 3, fontSize: 11, background: "rgba(76,139,245,0.15)", color: "var(--accent)" }}
                >
                  <Play size={11} />
                </button>
                <button
                  onClick={() => drop.mutate(s.index)}
                  title="Drop stash"
                  style={{ padding: "3px 6px", borderRadius: 3, fontSize: 11, background: "rgba(244,67,54,0.15)", color: "var(--danger)" }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
