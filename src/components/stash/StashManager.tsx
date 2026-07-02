import React from "react";
import { Archive, Play, Trash2, Download, PackageOpen } from "lucide-react";
import { useStashes, useStashPop, useStashApply, useStashDrop } from "../../hooks/useStashes";
import { useUIStore } from "../../store/uiStore";
import { useConfirmStore } from "../../store/confirmStore";
import { Skeleton } from "../ui/Skeleton";
import { formatRelativeTime } from "../../lib/diffParser";

export function StashManager() {
  const { data: stashes = [], isLoading } = useStashes();
  const { openDialog } = useUIStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
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
        {isLoading ? (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton variant="row" count={3} />
          </div>
        ) : stashes.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 12px" }}>
            <PackageOpen size={28} style={{ opacity: 0.3 }} />
            <span>No stashes</span>
          </div>
        ) : (
          stashes.map((s) => (
            <div
              key={s.index}
              className="list-item"
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
                  title="Apply — restore changes, keep stash"
                  style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 3, fontSize: 11, background: "rgba(76,175,80,0.15)", color: "var(--success)" }}
                >
                  <Download size={11} /> Apply
                </button>
                <button
                  onClick={() => showConfirm({ title: "Pop Stash", message: `Pop stash@{${s.index}} — "${s.message}". Restores changes then deletes the stash.`, danger: true, confirmLabel: "Pop", onConfirm: () => pop.mutate(s.index) })}
                  title="Pop — restore changes and delete stash"
                  style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 3, fontSize: 11, background: "rgba(76,139,245,0.15)", color: "var(--accent)" }}
                >
                  <Play size={11} /> Pop
                </button>
                <button
                  onClick={() => showConfirm({ title: "Drop Stash", message: `Drop stash@{${s.index}} — "${s.message}"? This permanently deletes the stash without applying the changes.`, danger: true, confirmLabel: "Drop", onConfirm: () => drop.mutate(s.index) })}
                  title="Drop — delete stash without applying"
                  style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 3, fontSize: 11, background: "rgba(244,67,54,0.15)", color: "var(--danger)" }}
                >
                  <Trash2 size={11} /> Drop
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
