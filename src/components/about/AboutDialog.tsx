import React, { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useUIStore } from "../../store/uiStore";
import { GitBranch, X } from "lucide-react";

export function AboutDialog() {
  const { closeDialog } = useUIStore();
  const [version, setVersion] = useState("…");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("—"));
  }, []);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onClick={closeDialog}
    >
      <div
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, minWidth: 320, textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={closeDialog} style={{ position: "absolute", top: 12, right: 12, color: "var(--text-muted)", padding: 4 }}>
          <X size={14} />
        </button>

        <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <GitBranch size={28} color="#fff" />
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>GitFlow Studio</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Version {version}</div>

        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
          A modern, native Git GUI<br />built with Tauri + React
        </div>

        <a
          href="https://github.com/nandan-varma/gitflow"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
        >
          View on GitHub ↗
        </a>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} nandan-varma · MIT License
        </div>
      </div>
    </div>
  );
}
