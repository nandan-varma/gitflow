import React, { useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import { useSettingsStore } from "../../store/settingsStore";
import { useUIStore } from "../../store/uiStore";
import { Info } from "lucide-react";
import { toErrMsg } from "../../lib/ipc";

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "up-to-date" }
  | { status: "available"; version: string; body: string | null | undefined; update: Awaited<ReturnType<typeof checkUpdate>> }
  | { status: "downloading" }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

const AI_PRESETS = [
  { name: "OpenAI", url: "https://api.openai.com/v1" },
  { name: "Anthropic", url: "https://api.anthropic.com/v1" },
  { name: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { name: "Ollama", url: "http://localhost:11434/v1" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: checked ? "var(--accent)" : "var(--bg-hover)",
        border: "1px solid var(--border)",
        position: "relative", transition: "background 0.15s",
        padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? 16 : 2,
        width: 14, height: 14, borderRadius: "50%", background: "#fff",
        transition: "left 0.15s", display: "block",
      }} />
    </button>
  );
}

export function SettingsPage() {
  const { defaultDiffMode, defaultBranchName, checkUpdatesOnStartup, aiBaseUrl, aiModel, aiApiKey, patch } = useSettingsStore();
  const { openDialog } = useUIStore();
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });

  async function handleCheckUpdate() {
    setUpdateState({ status: "checking" });
    try {
      const update = await checkUpdate();
      if (!update) {
        setUpdateState({ status: "up-to-date" });
      } else {
        setUpdateState({ status: "available", version: update.version, body: update.body, update });
      }
    } catch (e: unknown) {
      const msg = toErrMsg(e);
      // ponytail: pubkey not configured yet — guide the user instead of showing a raw error
      if (msg.includes("pubkey") || msg.includes("key") || msg.includes("Not Found") || msg.includes("404")) {
        setUpdateState({ status: "error", message: "Updater not configured. Run: pnpm tauri signer generate, then add the pubkey to tauri.conf.json." });
      } else {
        setUpdateState({ status: "error", message: msg });
      }
    }
  }

  async function handleInstallUpdate() {
    if (updateState.status !== "available") return;
    setUpdateState({ status: "downloading" });
    try {
      const version = updateState.version;
      await updateState.update!.downloadAndInstall();
      setUpdateState({ status: "ready", version });
    } catch (e: unknown) {
      setUpdateState({ status: "error", message: toErrMsg(e) });
    }
  }

  const [version, setVersion] = React.useState<string | null>(null);
  React.useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 40px", maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Settings</div>
        {version && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            v{version}
            <button
              title="About GitFlow Studio"
              onClick={() => openDialog("about")}
              style={{ color: "var(--text-muted)", padding: 2 }}
            >
              <Info size={12} />
            </button>
          </span>
        )}
      </div>

      <Section title="Appearance">
        <Row label="Default diff mode" description="Used when opening a file diff for the first time">
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            {(["unified", "split"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => patch({ defaultDiffMode: mode })}
                style={{
                  padding: "4px 12px", fontSize: 12,
                  background: defaultDiffMode === mode ? "var(--accent)" : "transparent",
                  color: defaultDiffMode === mode ? "#fff" : "var(--text-secondary)",
                  borderRight: mode === "unified" ? "1px solid var(--border)" : "none",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Git">
        <Row label="Default branch name" description="Used when initializing a new repository">
          <input
            value={defaultBranchName}
            onChange={(e) => patch({ defaultBranchName: e.target.value })}
            style={{ width: 100, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12 }}
            placeholder="main"
          />
        </Row>
      </Section>

      <Section title="AI Assistant">
        <Row label="Provider" description="Pre-fills the base URL for common OpenAI-compatible APIs">
          <select
            value={AI_PRESETS.find((p) => p.url === aiBaseUrl)?.name ?? "Custom"}
            onChange={(e) => {
              const preset = AI_PRESETS.find((p) => p.name === e.target.value);
              if (preset) patch({ aiBaseUrl: preset.url });
            }}
            style={{ fontSize: 12, padding: "4px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" }}
          >
            {AI_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            <option value="Custom">Custom</option>
          </select>
        </Row>
        <Row label="Base URL">
          <input
            value={aiBaseUrl}
            onChange={(e) => patch({ aiBaseUrl: e.target.value })}
            style={{ width: 240, fontFamily: "var(--font-mono)", fontSize: 11 }}
            placeholder="https://api.openai.com/v1"
          />
        </Row>
        <Row label="Model" description="Model ID as the provider expects it">
          <input
            value={aiModel}
            onChange={(e) => patch({ aiModel: e.target.value })}
            style={{ width: 180, fontFamily: "var(--font-mono)", fontSize: 12 }}
            placeholder="gpt-5.2 / claude-opus-4-8"
          />
        </Row>
        <Row label="API key" description="Stored locally on this machine">
          <input
            type="password"
            value={aiApiKey}
            onChange={(e) => patch({ aiApiKey: e.target.value })}
            style={{ width: 240, fontFamily: "var(--font-mono)", fontSize: 12 }}
            placeholder="sk-…"
          />
        </Row>
      </Section>

      <Section title="Updates">
        <Row label="Check for updates on startup">
          <Toggle checked={checkUpdatesOnStartup} onChange={(v) => patch({ checkUpdatesOnStartup: v })} />
        </Row>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleCheckUpdate}
              disabled={updateState.status === "checking" || updateState.status === "downloading"}
              style={{
                padding: "5px 14px", fontSize: 12, borderRadius: 4,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              {updateState.status === "checking" ? "Checking…" : updateState.status === "downloading" ? "Downloading…" : "Check Now"}
            </button>

            {updateState.status === "available" && (
              <button
                onClick={handleInstallUpdate}
                style={{ padding: "5px 14px", fontSize: 12, borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 500 }}
              >
                Install v{updateState.version} & Restart
              </button>
            )}
          </div>

          {updateState.status === "up-to-date" && (
            <div style={{ fontSize: 12, color: "var(--success)" }}>You're on the latest version.</div>
          )}
          {updateState.status === "ready" && (
            <div style={{ fontSize: 12, color: "var(--success)" }}>v{updateState.version} installed — restart the app to apply.</div>
          )}
          {updateState.status === "available" && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
              {updateState.body ?? `v${updateState.version} is available.`}
            </div>
          )}
          {updateState.status === "error" && (
            <div style={{ fontSize: 11, color: "var(--warning)", lineHeight: 1.5 }}>{updateState.message}</div>
          )}
        </div>
      </Section>
    </div>
  );
}
