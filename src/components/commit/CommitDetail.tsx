import React, { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useCommitDetail } from "../../hooks/useCommitGraph";
import { useDiffCommit } from "../../hooks/useDiff";
import { useUIStore } from "../../store/uiStore";
import { DiffView } from "../diff/DiffView";
import { Skeleton } from "../ui/Skeleton";
import { Spinner } from "../ui/Spinner";
import { formatRelativeTime } from "../../lib/diffParser";
import { ipc } from "../../lib/ipc";
import { useSettingsStore } from "../../store/settingsStore";
import { rowProps } from "../../lib/a11y";
import type { ChangedFile } from "../../types/graph";
import type { MenuItem } from "../../types/contextMenu";

const STATUS_COLOR: Record<string, string> = {
  added: "var(--success)",
  deleted: "var(--danger)",
  renamed: "var(--warning)",
  modified: "var(--accent)",
};

const basename = (p: string) => p.split("/").pop() ?? p;

export function CommitDetail() {
  const { selectedCommitOid, showContextMenu, openBlame, openFileHistory } = useUIStore();
  const { codeEditor, terminalApp } = useSettingsStore();
  const { data: detail, isLoading } = useCommitDetail(selectedCommitOid);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { data: fileDiff, isLoading: diffLoading } = useDiffCommit(selectedCommitOid, selectedPath);

  useEffect(() => { setSelectedPath(null); }, [selectedCommitOid]);

  if (isLoading) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={12} count={2} />
        <Skeleton width="40%" height={12} />
        <div style={{ height: 12 }} />
        <Skeleton variant="row" count={5} />
      </div>
    );
  }

  if (!detail) return null;

  const fileContextMenu = (file: ChangedFile): MenuItem[] => [
    { label: "Blame", action: () => openBlame(file.path) },
    { label: "File History", action: () => openFileHistory(file.path) },
    "separator",
    { label: "Open in Editor", action: () => { ipc.openInVscode(file.path, codeEditor).catch(() => {}); } },
    { label: "Reveal in Finder", action: () => { ipc.revealInFinder(file.path).catch(() => {}); } },
    { label: "Open Terminal Here", action: () => { ipc.openInTerminal(file.path, terminalApp).catch(() => {}); } },
    "separator",
    { label: "Copy Path", action: () => { navigator.clipboard.writeText(file.path).catch(() => {}); } },
  ];

  // Diff view — file selected, show full-height diff with back button
  if (selectedPath) {
    const file = detail.changed_files.find((f) => f.path === selectedPath);
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 8px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--bg-surface)",
          }}
        >
          <button
            onClick={() => setSelectedPath(null)}
            style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--accent)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}
          >
            <ChevronLeft size={12} />
            {detail.changed_files.length} files
          </button>
          <span
            style={{ flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={selectedPath}
          >
            {selectedPath}
          </span>
          {file && (
            <button
              onContextMenu={(e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, fileContextMenu(file)); }}
              onClick={(e) => { showContextMenu(e.clientX, e.clientY, fileContextMenu(file)); }}
              style={{ fontSize: 10, color: "var(--text-muted)", padding: "2px 4px", flexShrink: 0 }}
              title="More actions"
            >
              ···
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {diffLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Spinner />
            </div>
          ) : fileDiff ? (
            <DiffView diff={fileDiff} path={selectedPath} mode="commit" />
          ) : null}
        </div>
      </div>
    );
  }

  // Files list view
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {detail.body && (
          <div data-selectable style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginBottom: 6 }}>
            {detail.body}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
          <span data-selectable>{detail.author_name} &lt;{detail.author_email}&gt;</span>
          <span>{formatRelativeTime(detail.timestamp)}</span>
          <span data-selectable style={{ fontFamily: "var(--font-mono)" }}>{detail.oid.slice(0, 12)}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>{detail.stats.files_changed} files</span>
          <span style={{ color: "var(--success)" }}>+{detail.stats.insertions}</span>
          <span style={{ color: "var(--danger)" }}>-{detail.stats.deletions}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {detail.changed_files.map((file) => {
          const color = STATUS_COLOR[file.status] ?? "var(--text-muted)";
          return (
            <div
              key={file.path}
              onClick={() => setSelectedPath(file.path)}
              {...rowProps(() => setSelectedPath(file.path))}
              aria-label={`${file.status} file ${file.path}`}
              onContextMenu={(e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, fileContextMenu(file)); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                cursor: "pointer",
                borderLeft: "2px solid transparent",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            >
              <span style={{ fontSize: 10, color, fontWeight: 600, flexShrink: 0, width: 12, textAlign: "center" }}>
                {file.status[0].toUpperCase()}
              </span>
              <span
                style={{ flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={file.old_path ? `${file.old_path} → ${file.path}` : file.path}
              >
                {file.old_path ? `${basename(file.old_path)} → ${basename(file.path)}` : basename(file.path)}
              </span>
              <span style={{ fontSize: 10, color: "var(--success)", flexShrink: 0 }}>+{file.additions}</span>
              <span style={{ fontSize: 10, color: "var(--danger)", flexShrink: 0 }}>-{file.deletions}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
