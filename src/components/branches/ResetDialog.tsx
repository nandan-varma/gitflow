import React, { useState } from "react";
import { ipc, toErrMsg } from "../../lib/ipc";
import { useUIStore } from "../../store/uiStore";
import { useConfirmStore } from "../../store/confirmStore";
import { queryClient } from "../../lib/queryClient";
import { DialogShell } from "../ui/DialogShell";

type ResetPayload = { oid: string; summary: string };

const MODES = [
  { value: "soft",  label: "Soft",  desc: "Move HEAD only — keep index and workdir unchanged" },
  { value: "mixed", label: "Mixed", desc: "Unstage changes — keep workdir unchanged (default)" },
  { value: "hard",  label: "Hard",  desc: "Discard all changes — cannot be undone" },
] as const;

export function ResetDialog() {
  const { closeDialog, dialogPayload } = useUIStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const payload = dialogPayload as ResetPayload | null;
  const [mode, setMode] = useState<"soft" | "mixed" | "hard">("mixed");
  const [error, setError] = useState<string | null>(null);

  if (!payload) return null;

  const doReset = async () => {
    setError(null);
    try {
      await ipc.gitReset(payload.oid, mode);
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["repo"] });
      closeDialog();
    } catch (e: unknown) {
      setError(toErrMsg(e));
    }
  };

  const handleReset = () => {
    if (mode === "hard") {
      showConfirm({ title: "Hard Reset", message: `Reset to ${payload.oid.slice(0, 7)} with --hard? All uncommitted changes will be permanently discarded.`, danger: true, confirmLabel: "Reset Hard", onConfirm: doReset });
    } else {
      doReset();
    }
  };

  return (
    <DialogShell label="Reset to commit" onClose={closeDialog} style={{ minWidth: 380 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Reset to Here</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 16 }}>
        {payload.oid.slice(0, 7)} — {payload.summary}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {MODES.map((m) => (
          <label key={m.value} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "8px 10px", borderRadius: 6, background: mode === m.value ? "rgba(76,139,245,0.1)" : "transparent", border: `1px solid ${mode === m.value ? "var(--accent)" : "var(--border)"}` }}>
            <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: m.value === "hard" ? "var(--danger)" : "var(--text-primary)" }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.desc}</div>
            </div>
          </label>
        ))}
      </div>
      {error && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={closeDialog} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}>
          Cancel
        </button>
        <button
          onClick={handleReset}
          style={{ padding: "5px 12px", borderRadius: 4, background: mode === "hard" ? "var(--danger)" : "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500 }}
        >
          Reset {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      </div>
    </DialogShell>
  );
}
