import React, { useState } from "react";
import { Archive, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useStashes, useStashApply } from "../../hooks/useStashes";
import { useUIStore } from "../../store/uiStore";

export function StashList() {
  const [collapsed, setCollapsed] = useState(true);
  const { data: stashes = [] } = useStashes();
  const { openDialog } = useUIStore();
  const apply = useStashApply();

  return (
    <section>
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "6px 12px",
          color: "var(--text-muted)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          Stashes
          {stashes.length > 0 && (
            <span style={{ fontSize: 10, background: "var(--bg-elevated)", padding: "0 4px", borderRadius: 8 }}>
              {stashes.length}
            </span>
          )}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); openDialog("stash-push"); }}
          style={{ color: "var(--text-muted)", padding: 2 }}
          title="Stash changes"
        >
          <Plus size={12} />
        </button>
      </button>

      {!collapsed && stashes.map((s) => (
        <div
          key={s.index}
          className="list-item"
          style={{
            padding: "4px 12px 4px 24px",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
          onClick={() => { if (window.confirm(`Apply stash "${s.message}"?`)) apply.mutate(s.index); }}
        >
          <Archive size={11} style={{ color: "var(--text-muted)" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.message}
          </span>
        </div>
      ))}
    </section>
  );
}
