import React from "react";
import { FilePlus, FileMinus, FileEdit, FileX, ArrowRight } from "lucide-react";
import type { FileStatus } from "../../types/git";
import { ipc, toErrMsg } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";
import { useUIStore } from "../../store/uiStore";

const STATUS_ORDER: Record<string, number> = { conflict: 0, modified: 1, deleted: 2, added: 3, renamed: 4 };
const basename = (p: string) => p.split("/").pop() ?? p;
const dirname = (p: string) => { const i = p.lastIndexOf("/"); return i >= 0 ? p.slice(0, i + 1) : ""; };

const STATUS_ICON: Record<string, React.ReactNode> = {
  added: <FilePlus size={12} style={{ color: "var(--success)" }} />,
  modified: <FileEdit size={12} style={{ color: "var(--warning)" }} />,
  deleted: <FileMinus size={12} style={{ color: "var(--danger)" }} />,
  renamed: <ArrowRight size={12} style={{ color: "var(--info)" }} />,
  conflict: <FileX size={12} style={{ color: "var(--danger)" }} />,
};

interface Props {
  files: FileStatus[];
  staged: boolean;
  onStageAll?: () => Promise<void>;
  onUnstageAll?: () => Promise<void>;
}

export function FileStatusList({ files, staged, onStageAll, onUnstageAll }: Props) {
  const { selectedFilePath, selectFile } = useUIStore();
  const [error, setError] = React.useState<string | null>(null);

  const handleFileAction = async (file: FileStatus) => {
    setError(null);
    try {
      if (staged) {
        await ipc.unstageFile(file.path);
      } else {
        await ipc.stageFile(file.path);
      }
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["diff"] });
    } catch (e: unknown) {
      setError(toErrMsg(e));
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {error && (
        <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--danger)", background: "rgba(244,67,54,0.1)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ color: "var(--text-muted)", fontSize: 12 }}>×</button>
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px",
          borderBottom: "1px solid var(--border)",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {staged ? "Staged" : "Unstaged"}
        </span>
        <span style={{ fontSize: 11, background: "var(--bg-elevated)", padding: "0 4px", borderRadius: 8, color: "var(--text-muted)" }}>
          {files.length}
        </span>
        <div style={{ flex: 1 }} />
        {staged && onUnstageAll && (
          <button
            onClick={() => { setError(null); onUnstageAll().catch((e: unknown) => setError(toErrMsg(e))); }}
            style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 6px" }}
          >
            Unstage all
          </button>
        )}
        {!staged && onStageAll && (
          <button
            onClick={() => { setError(null); onStageAll().catch((e: unknown) => setError(toErrMsg(e))); }}
            style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 6px" }}
          >
            Stage all
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {files.length === 0 ? (
          <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
            {staged ? "Nothing staged" : "Working tree clean"}
          </div>
        ) : (() => {
          const sorted = [...files].sort((a, b) => {
            const dc = dirname(a.path).localeCompare(dirname(b.path));
            if (dc !== 0) return dc;
            const sc = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
            if (sc !== 0) return sc;
            return basename(a.path).localeCompare(basename(b.path));
          });
          const grouped = Object.entries(
            sorted.reduce<Record<string, FileStatus[]>>((acc, f) => {
              const dir = dirname(f.path);
              (acc[dir] ??= []).push(f);
              return acc;
            }, {})
          );
          const multiDir = grouped.length > 1;
          return grouped.map(([dir, groupFiles]) => (
            <React.Fragment key={dir}>
              {multiDir && (
                <div style={{ padding: "3px 12px", fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", fontFamily: "var(--font-mono)", letterSpacing: "0.02em", borderBottom: "1px solid var(--border)" }}>
                  {dir || "/"}
                </div>
              )}
              {groupFiles.map((file) => (
                <div
                  key={file.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "5px 12px",
                    gap: 8,
                    background: selectedFilePath === file.path ? "rgba(76,139,245,0.1)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => selectFile(file.path)}
                >
                  {STATUS_ICON[file.status]}
                  <span style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--text-primary)" }}>
                      {file.old_path ? `${basename(file.old_path)} → ` : ""}{basename(file.path)}
                    </span>
                    {!multiDir && dir && (
                      <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 4 }}>{dir}</span>
                    )}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleFileAction(file); }}
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: staged ? "rgba(244,67,54,0.15)" : "rgba(76,175,80,0.15)",
                      color: staged ? "var(--danger)" : "var(--success)",
                    }}
                  >
                    {staged ? "−" : "+"}
                  </button>
                </div>
              ))}
            </React.Fragment>
          ));
        })()}
      </div>
    </div>
  );
}
