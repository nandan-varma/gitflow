import React, { useState } from "react";
import { Tag, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ipc } from "../../lib/ipc";
import { queryKeys } from "../../lib/queryClient";
import { useRepoStore } from "../../store/repoStore";
import { useIpcEvent } from "../../hooks/useIpcEvent";
import { queryClient } from "../../lib/queryClient";
import { useUIStore } from "../../store/uiStore";

export function TagList() {
  const [collapsed, setCollapsed] = useState(true);
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  const { showContextMenu, openDialog } = useUIStore();

  const { data: tags = [] } = useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => ipc.listTags(),
    enabled: !!currentRepoPath,
  });

  useIpcEvent("repo-changed", () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tags });
  });

  return (
    <section>
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
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
        <span style={{ marginLeft: "auto" }} />
        <button
          onClick={(e) => { e.stopPropagation(); openDialog("tag-create", "HEAD"); }}
          title="Create tag"
          style={{ color: "var(--text-muted)", padding: 2 }}
        >
          <Plus size={12} />
        </button>
      </button>
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
