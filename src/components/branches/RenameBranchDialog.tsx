import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ipc, toErrMsg } from "../../lib/ipc";
import { useUIStore } from "../../store/uiStore";
import { DialogShell } from "../ui/DialogShell";

export function RenameBranchDialog() {
  const { closeDialog, dialogPayload } = useUIStore();
  const oldName = typeof dialogPayload === "string" ? dialogPayload : "";
  const [name, setName] = useState(oldName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();

  const isValid = /^[a-zA-Z0-9._/-]+$/.test(name) && !name.startsWith("-") && name !== oldName;

  const handleRename = async () => {
    if (!isValid) return;
    setPending(true);
    setError(null);
    try {
      await ipc.renameBranch(oldName, name);
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      closeDialog();
    } catch (e: unknown) {
      setError(toErrMsg(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogShell label="Rename branch" onClose={closeDialog} style={{ minWidth: 340 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        Rename Branch
        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>{oldName}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          New name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "var(--font-mono)" }}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
        </label>
        {name && name !== oldName && !isValid && (
          <span style={{ fontSize: 11, color: "var(--danger)" }}>Invalid branch name</span>
        )}
        {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={closeDialog} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}>
            Cancel
          </button>
          <button
            onClick={handleRename}
            disabled={!isValid || pending}
            style={{ padding: "5px 12px", borderRadius: 4, background: isValid && !pending ? "var(--accent)" : "var(--bg-elevated)", color: isValid && !pending ? "#fff" : "var(--text-muted)", fontSize: 12, fontWeight: 500 }}
          >
            {pending ? "Renaming…" : "Rename"}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
