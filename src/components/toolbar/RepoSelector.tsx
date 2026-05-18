import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { useRepoStore } from "../../store/repoStore";

export function RepoSelector() {
  const { openRepository, recentRepos, isOpening } = useRepoStore();
  const [showRecent, setShowRecent] = useState(false);

  const handleOpen = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      await openRepository(selected);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleOpen}
        disabled={isOpening}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 5,
          background: "var(--accent)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 500,
          opacity: isOpening ? 0.7 : 1,
        }}
      >
        <FolderOpen size={13} />
        {isOpening ? "Opening…" : "Open Repository"}
      </button>

      {recentRepos.length > 0 && (
        <button
          onClick={() => setShowRecent((v) => !v)}
          style={{ marginLeft: 4, color: "var(--text-muted)", fontSize: 11, padding: "2px 6px" }}
        >
          Recent ▾
        </button>
      )}

      {showRecent && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 0",
            minWidth: 300,
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {recentRepos.map((p) => (
            <button
              key={p}
              onClick={() => {
                openRepository(p);
                setShowRecent(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 12px",
                color: "var(--text-secondary)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
