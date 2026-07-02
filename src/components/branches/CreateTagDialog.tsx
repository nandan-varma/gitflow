import React, { useState } from "react";
import { useUIStore } from "../../store/uiStore";
import { ipc, toErrMsg } from "../../lib/ipc";
import { queryClient } from "../../lib/queryClient";

export function CreateTagDialog() {
  const { closeDialog, dialogPayload } = useUIStore();
  const oid = typeof dialogPayload === "string" ? dialogPayload : "";
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isValid = /^[a-zA-Z0-9._/-]+$/.test(name) && !name.startsWith("-");

  const handleCreate = async () => {
    if (!isValid || !oid) return;
    setError(null);
    setPending(true);
    try {
      await ipc.createTag(name, oid, message || undefined);
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      closeDialog();
    } catch (e) {
      setError(toErrMsg(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog-card" style={{ minWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
          Create Tag
          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>at {oid.slice(0, 7)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Tag name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0.0"
              style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "var(--font-mono)" }}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </label>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Message <span style={{ color: "var(--text-muted)" }}>(optional — creates annotated tag)</span>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Release notes…"
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          {name && !isValid && <span style={{ fontSize: 11, color: "var(--danger)" }}>Invalid tag name</span>}
          {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={closeDialog} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}>Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!isValid || pending}
              style={{ padding: "5px 12px", borderRadius: 4, background: isValid ? "var(--accent)" : "var(--bg-elevated)", color: isValid ? "#fff" : "var(--text-muted)", fontSize: 12, fontWeight: 500 }}
            >
              {pending ? "Creating…" : "Create Tag"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
