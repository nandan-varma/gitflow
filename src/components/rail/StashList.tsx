import React, { useState } from "react";
import { Archive, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useStashes, useStashApply, useStashPop, useStashDrop } from "../../hooks/useStashes";
import { useUIStore } from "../../store/uiStore";
import { useConfirmStore } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";
import { toErrMsg } from "../../lib/ipc";
import { rowProps } from "../../lib/a11y";

export function StashList() {
  const [collapsed, setCollapsed] = useState(true);
  const { data: stashes = [] } = useStashes();
  const { openDialog, showContextMenu } = useUIStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const addToast = useToastStore((s) => s.addToast);
  const apply = useStashApply();
  const pop = useStashPop();
  const drop = useStashDrop();

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", paddingRight: 12 }}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flex: 1,
            padding: "6px 12px",
            color: "var(--text-muted)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          Stashes
          {stashes.length > 0 && (
            <span style={{ fontSize: 10, background: "var(--bg-elevated)", padding: "0 4px", borderRadius: 8 }}>
              {stashes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => openDialog("stash-push")}
          style={{ color: "var(--text-muted)", padding: 2 }}
          title="Stash changes"
          aria-label="Stash changes"
        >
          <Plus size={12} />
        </button>
      </div>

      {!collapsed && stashes.map((s) => (
        <div
          key={s.index}
          className="list-item"
          {...rowProps(() => apply.mutate(s.index, { onError: (e) => addToast(toErrMsg(e), "error") }))}
          aria-label={`Apply stash: ${s.message}`}
          style={{
            padding: "4px 12px 4px 24px",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
          onClick={() => apply.mutate(s.index, { onError: (e) => addToast(toErrMsg(e), "error") })}
          onContextMenu={(e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, [
              { label: "Apply", action: () => apply.mutate(s.index, { onError: (err) => addToast(toErrMsg(err), "error") }) },
              { label: "Pop (Apply & Drop)", action: () => pop.mutate(s.index, { onError: (err) => addToast(toErrMsg(err), "error") }) },
              "separator",
              { label: "Drop", danger: true, action: () => showConfirm({ title: "Drop Stash", message: `Drop stash "${s.message}"? This cannot be undone.`, danger: true, confirmLabel: "Drop", onConfirm: () => drop.mutate(s.index, { onError: (err) => addToast(toErrMsg(err), "error") }) }) },
              "separator",
              { label: "Copy Message", action: () => { navigator.clipboard.writeText(s.message).catch(() => {}); } },
            ]);
          }}
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
