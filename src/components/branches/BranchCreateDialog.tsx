import React, { useState } from "react";
import { useCreateBranch, useSwitchBranch } from "../../hooks/useBranches";
import { useUIStore } from "../../store/uiStore";
import { toErrMsg } from "../../lib/ipc";

export function BranchCreateDialog() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { closeDialog } = useUIStore();
  const create = useCreateBranch();
  const switchBranch = useSwitchBranch();

  const isValid = /^[a-zA-Z0-9._/-]+$/.test(name) && !name.startsWith("-");

  const handleCreate = async () => {
    if (!isValid) return;
    setError(null);
    try {
      await create.mutateAsync({ name });
      await switchBranch.mutateAsync(name);
      closeDialog();
    } catch (e: unknown) {
      setError(toErrMsg(e));
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={closeDialog}>
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, minWidth: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Create Branch</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Branch name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="feature/my-feature"
              style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "var(--font-mono)" }}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </label>
          {name && !isValid && (
            <span style={{ fontSize: 11, color: "var(--danger)" }}>
              Invalid branch name
            </span>
          )}
          {error && (
            <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={closeDialog} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}>
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!isValid}
              style={{ padding: "5px 12px", borderRadius: 4, background: isValid ? "var(--accent)" : "var(--bg-elevated)", color: isValid ? "#fff" : "var(--text-muted)", fontSize: 12, fontWeight: 500 }}
            >
              Create & Switch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
