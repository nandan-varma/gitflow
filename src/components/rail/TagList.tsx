import React, { useState } from "react";
import { Tag, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc } from "../../lib/ipc";
import { queryKeys } from "../../lib/queryClient";
import { useRepoStore } from "../../store/repoStore";
import { useUIStore } from "../../store/uiStore";
import { useConfirmStore } from "../../store/confirmStore";
import { rowProps } from "../../lib/a11y";

export function TagList() {
  const [collapsed, setCollapsed] = useState(true);
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  const { openDialog, showContextMenu } = useUIStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const queryClient = useQueryClient();

  const { data: tags = [] } = useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => ipc.listTags(),
    enabled: !!currentRepoPath,
  });

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
          Tags
          {tags.length > 0 && (
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              {tags.length}
            </span>
          )}
        </button>
        <button
          onClick={() => openDialog("tag-create", "HEAD")}
          title="Create tag"
          aria-label="Create tag"
          style={{ color: "var(--text-muted)", padding: 2 }}
        >
          <Plus size={12} />
        </button>
      </div>
      {!collapsed && (
        <div style={{ padding: "2px 0" }}>
          {tags.length === 0 ? (
            <div style={{ padding: "4px 24px", color: "var(--text-muted)", fontSize: 12 }}>
              No tags
            </div>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.name}
                className="list-item"
                {...rowProps(() => {})}
                aria-label={`Tag ${tag.name}`}
                title={tag.message ?? undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 12px 3px 24px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  cursor: "default",
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  showContextMenu(e.clientX, e.clientY, [
                    { label: "Create Branch from Tag…", action: () => openDialog("branch-create", tag.target_oid) },
                    { label: "Cherry-pick onto Current Branch", action: async () => { try { await ipc.cherryPick(tag.target_oid); } catch {} } },
                    "separator",
                    { label: "Copy Tag Name", action: () => { navigator.clipboard.writeText(tag.name).catch(() => {}); } },
                    { label: "Copy Commit SHA", action: () => { navigator.clipboard.writeText(tag.target_oid).catch(() => {}); } },
                    "separator",
                    { label: "Delete Tag", danger: true, action: () => showConfirm({ title: "Delete Tag", message: `Delete tag "${tag.name}"? This cannot be undone.`, danger: true, confirmLabel: "Delete", onConfirm: async () => { await ipc.deleteTag(tag.name); queryClient.invalidateQueries({ queryKey: ["tags"] }); } }) },
                  ]);
                }}
              >
                <Tag size={11} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {tag.name}
                </span>
                {tag.is_annotated && (
                  <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "rgba(76,139,245,0.15)", color: "var(--accent)", flexShrink: 0 }}>
                    A
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
