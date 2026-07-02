import React, { useState } from "react";
import { useStashPush } from "../../hooks/useStashes";
import { useUIStore } from "../../store/uiStore";

export function StashPushDialog() {
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const { closeDialog } = useUIStore();
  const push = useStashPush();

  const handleStash = async () => {
    await push.mutateAsync({ message: message || undefined, includeUntracked });
    closeDialog();
  };

  return (
    <Dialog title="Stash Changes" onClose={closeDialog}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Message (optional)
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="WIP"
            style={{ display: "block", width: "100%", marginTop: 4 }}
            autoFocus
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeUntracked}
            onChange={(e) => setIncludeUntracked(e.target.checked)}
          />
          Include untracked files
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={closeDialog} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: 12 }}>
            Cancel
          </button>
          <button onClick={handleStash} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500 }}>
            Stash
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "var(--text-primary)" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
