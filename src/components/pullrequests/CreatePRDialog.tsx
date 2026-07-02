import React, { useState } from "react";
import { X } from "lucide-react";
import { useCreatePR } from "../../hooks/useGitHub";
import { useBranches } from "../../hooks/useBranches";
import { DialogShell } from "../ui/DialogShell";

export function CreatePRDialog({ onClose }: { onClose: () => void }) {
  const { data: branches = [] } = useBranches();
  const currentBranch = branches.find((b) => b.is_head);
  const localBranches = branches.filter((b) => !b.is_remote && !b.is_head);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [base, setBase] = useState("main");
  const [draft, setDraft] = useState(false);

  const createPR = useCreatePR();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPR.mutate({ title, body, base, draft }, { onSuccess: onClose });
  };

  return (
    <DialogShell label="New pull request" onClose={onClose} style={{ width: 480, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h3 style={{ flex: 1, fontSize: 13, fontWeight: 600, margin: 0 }}>New Pull Request</h3>
          <button onClick={onClose} aria-label="Close" style={{ color: "var(--text-muted)", padding: 2 }}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="PR title"
              style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 12 }}
            />
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              From
              <input
                value={currentBranch?.name ?? ""}
                readOnly
                style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}
              />
            </label>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              Into
              <select
                value={base}
                onChange={(e) => setBase(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 12 }}
              >
                {localBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                {!localBranches.find((b) => b.name === "main") && <option value="main">main</option>}
              </select>
            </label>
          </div>

          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            Description (optional)
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Describe the changes…"
              style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 12, resize: "vertical", fontFamily: "inherit" }}
            />
          </label>

          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
            Create as draft
          </label>

          {createPR.error && (
            <span style={{ fontSize: 11, color: "var(--danger)" }}>{String(createPR.error)}</span>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "6px 14px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPR.isPending || !title.trim()}
              style={{ padding: "6px 14px", fontSize: 12, borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 500, opacity: createPR.isPending || !title.trim() ? 0.6 : 1 }}
            >
              {createPR.isPending ? "Creating…" : draft ? "Create draft PR" : "Create PR"}
            </button>
          </div>
        </form>
    </DialogShell>
  );
}
