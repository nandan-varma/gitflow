import React, { useState, useEffect, useRef } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import OpenAI from "openai";
import { useSettingsStore } from "../../store/settingsStore";
import { useUIStore } from "../../store/uiStore";
import { useRepoStore } from "../../store/repoStore";
import { useConfirmStore } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";
import { getCommands, formatShortcut, runCommand, isMac } from "../../lib/commands";
import { Info, Search, X } from "lucide-react";
import { toErrMsg } from "../../lib/ipc";

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "up-to-date" }
  | { status: "available"; version: string; body: string | null | undefined; update: Awaited<ReturnType<typeof checkUpdate>> }
  | { status: "downloading" }
  | { status: "error"; message: string };

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; models: number }
  | { status: "error"; message: string };

const EDITOR_PRESETS = [
  { label: "VS Code", cmd: "code" },
  { label: "Cursor", cmd: "cursor" },
  { label: "Zed", cmd: "zed" },
  { label: "Sublime Text", cmd: "subl" },
  { label: "Vim", cmd: "vim" },
];

const TERMINAL_PRESETS = [
  { label: "Terminal", app: "Terminal" },
  { label: "iTerm2", app: "iTerm" },
  { label: "Warp", app: "Warp" },
  { label: "Ghostty", app: "Ghostty" },
  { label: "Alacritty", app: "Alacritty" },
];

const AI_PRESETS = [
  { name: "OpenAI", url: "https://api.openai.com/v1" },
  { name: "Anthropic", url: "https://api.anthropic.com/v1" },
  { name: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { name: "Ollama", url: "http://localhost:11434/v1" },
];

interface SettingRow {
  label: string;
  description?: string;
  keywords?: string;
  full?: boolean;
  control: React.ReactNode;
}

interface SettingSection {
  id: string;
  title: string;
  rows: SettingRow[];
}

const inputStyle: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };
const selectStyle: React.CSSProperties = {
  fontSize: 12, padding: "4px 8px", background: "var(--bg-elevated)",
  border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)",
};
const buttonStyle: React.CSSProperties = {
  padding: "5px 14px", fontSize: 12, borderRadius: 4,
  background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)",
};

function Row({ row }: { row: SettingRow }) {
  if (row.full) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {row.label && (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{row.label}</div>
            {row.description && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{row.description}</div>}
          </div>
        )}
        {row.control}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{row.label}</div>
        {row.description && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{row.description}</div>}
      </div>
      {row.control}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
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

function Segmented<T extends string>({ options, value, onChange, format }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          style={{
            padding: "4px 12px", fontSize: 12,
            background: value === opt ? "var(--accent)" : "transparent",
            color: value === opt ? "#fff" : "var(--text-secondary)",
            borderRight: i < options.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          {format ? format(opt) : opt}
        </button>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)",
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

export function SettingsPage() {
  const settings = useSettingsStore();
  const { patch, reset } = settings;
  const { openDialog } = useUIStore();
  const { recentRepos, clearRecentRepos } = useRepoStore();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const addToast = useToastStore((s) => s.addToast);

  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("appearance");
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [version, setVersion] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);

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
      if (msg.includes("pubkey") || msg.includes("key") || msg.includes("Not Found") || msg.includes("404") || msg.includes("valid JSON") || msg.includes("fetch")) {
        setUpdateState({ status: "error", message: "No update available (server returned an unexpected response). This is normal in development or when no release has been published." });
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
      await relaunch();
    } catch (e: unknown) {
      setUpdateState({ status: "error", message: toErrMsg(e) });
    }
  }

  async function handleTestConnection() {
    setTestState({ status: "testing" });
    try {
      const client = new OpenAI({
        apiKey: settings.aiApiKey || "none",
        baseURL: settings.aiBaseUrl,
        dangerouslyAllowBrowser: true,
        timeout: 8000,
        maxRetries: 0,
      });
      const models = await client.models.list();
      setTestState({ status: "ok", models: models.data.length });
    } catch (e: unknown) {
      setTestState({ status: "error", message: toErrMsg(e) });
    }
  }

  const shortcutRows: SettingRow[] = [
    ...getCommands()
      .filter((c) => c.shortcut)
      .map((c) => ({
        label: c.label,
        keywords: "shortcut hotkey keybinding",
        control: <Kbd>{formatShortcut(c.shortcut!)}</Kbd>,
      })),
    { label: "Commit", description: "In the commit message editor", keywords: "shortcut hotkey", control: <Kbd>{isMac ? "⌘↵" : "Ctrl+Enter"}</Kbd> },
    { label: "Open context menu", description: "On any focused row", keywords: "shortcut hotkey right click", control: <Kbd>⇧F10</Kbd> },
    { label: "Navigate commits", description: "In the commit graph", keywords: "shortcut hotkey arrows", control: <Kbd>↑ / ↓</Kbd> },
  ];

  const sections: SettingSection[] = [
    {
      id: "appearance",
      title: "Appearance",
      rows: [
        {
          label: "Theme",
          description: "System follows your OS appearance",
          keywords: "dark light mode color",
          control: (
            <Segmented
              options={["system", "light", "dark"] as const}
              value={settings.theme}
              onChange={(theme) => patch({ theme })}
            />
          ),
        },
        {
          label: "Zoom",
          description: `Also ${isMac ? "⌘" : "Ctrl"} + / − / 0 anywhere`,
          keywords: "font size scale bigger smaller",
          control: (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button aria-label="Zoom out" onClick={() => runCommand("zoom-out")} style={{ ...buttonStyle, padding: "3px 10px" }}>−</button>
              <span style={{ fontSize: 12, width: 44, textAlign: "center", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {Math.round(settings.zoomFactor * 100)}%
              </span>
              <button aria-label="Zoom in" onClick={() => runCommand("zoom-in")} style={{ ...buttonStyle, padding: "3px 10px" }}>+</button>
              {settings.zoomFactor !== 1 && (
                <button onClick={() => runCommand("zoom-reset")} style={{ ...buttonStyle, padding: "3px 10px", marginLeft: 4 }}>Reset</button>
              )}
            </div>
          ),
        },
        {
          label: "Default diff mode",
          description: "Used when opening a file diff for the first time",
          keywords: "unified split side by side",
          control: (
            <Segmented
              options={["unified", "split"] as const}
              value={settings.defaultDiffMode}
              onChange={(defaultDiffMode) => patch({ defaultDiffMode })}
            />
          ),
        },
      ],
    },
    {
      id: "git",
      title: "Git",
      rows: [
        {
          label: "Default branch name",
          description: "Used when initializing a new repository",
          keywords: "main master init",
          control: (
            <input
              value={settings.defaultBranchName}
              onChange={(e) => patch({ defaultBranchName: e.target.value })}
              style={{ ...inputStyle, width: 100, textAlign: "center" }}
              placeholder="main"
            />
          ),
        },
        {
          label: "Auto-fetch",
          description: "Periodically fetch from remotes in the background",
          keywords: "background refresh interval periodic",
          control: (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {settings.autoFetchEnabled && (
                <select
                  value={settings.autoFetchMinutes}
                  onChange={(e) => patch({ autoFetchMinutes: Number(e.target.value) })}
                  aria-label="Auto-fetch interval"
                  style={selectStyle}
                >
                  {[5, 10, 15, 30].map((n) => <option key={n} value={n}>every {n} min</option>)}
                </select>
              )}
              <Toggle
                checked={settings.autoFetchEnabled}
                onChange={(autoFetchEnabled) => patch({ autoFetchEnabled })}
                label="Auto-fetch"
              />
            </div>
          ),
        },
      ],
    },
    {
      id: "shortcuts",
      title: "Keyboard Shortcuts",
      rows: shortcutRows,
    },
    {
      id: "tools",
      title: "External Tools",
      rows: [
        {
          label: "Code editor",
          description: "CLI command used to open files",
          keywords: "vscode cursor zed vim editor open",
          control: (
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={EDITOR_PRESETS.find((p) => p.cmd === settings.codeEditor)?.label ?? "Custom"}
                onChange={(e) => {
                  const preset = EDITOR_PRESETS.find((p) => p.label === e.target.value);
                  if (preset) patch({ codeEditor: preset.cmd });
                }}
                aria-label="Editor preset"
                style={selectStyle}
              >
                {EDITOR_PRESETS.map((p) => <option key={p.cmd} value={p.label}>{p.label}</option>)}
                <option value="Custom">Custom</option>
              </select>
              <input
                value={settings.codeEditor}
                onChange={(e) => patch({ codeEditor: e.target.value })}
                style={{ ...inputStyle, width: 100 }}
                placeholder="code"
                aria-label="Editor command"
              />
            </div>
          ),
        },
        {
          label: "Terminal",
          description: "App name passed to 'open -a' on macOS",
          keywords: "iterm warp ghostty alacritty shell",
          control: (
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={TERMINAL_PRESETS.find((p) => p.app === settings.terminalApp)?.label ?? "Custom"}
                onChange={(e) => {
                  const preset = TERMINAL_PRESETS.find((p) => p.label === e.target.value);
                  if (preset) patch({ terminalApp: preset.app });
                }}
                aria-label="Terminal preset"
                style={selectStyle}
              >
                {TERMINAL_PRESETS.map((p) => <option key={p.app} value={p.label}>{p.label}</option>)}
                <option value="Custom">Custom</option>
              </select>
              <input
                value={settings.terminalApp}
                onChange={(e) => patch({ terminalApp: e.target.value })}
                style={{ ...inputStyle, width: 100 }}
                placeholder="Terminal"
                aria-label="Terminal app"
              />
            </div>
          ),
        },
      ],
    },
    {
      id: "ai",
      title: "AI Assistant",
      rows: [
        {
          label: "Provider",
          description: "Pre-fills the base URL for common OpenAI-compatible APIs",
          keywords: "openai anthropic openrouter ollama llm",
          control: (
            <select
              value={AI_PRESETS.find((p) => p.url === settings.aiBaseUrl)?.name ?? "Custom"}
              onChange={(e) => {
                const preset = AI_PRESETS.find((p) => p.name === e.target.value);
                if (preset) patch({ aiBaseUrl: preset.url });
              }}
              aria-label="AI provider preset"
              style={selectStyle}
            >
              {AI_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              <option value="Custom">Custom</option>
            </select>
          ),
        },
        {
          label: "Base URL",
          keywords: "endpoint api url",
          control: (
            <input
              value={settings.aiBaseUrl}
              onChange={(e) => patch({ aiBaseUrl: e.target.value })}
              style={{ ...inputStyle, width: 240, fontSize: 11 }}
              placeholder="https://api.openai.com/v1"
              aria-label="AI base URL"
            />
          ),
        },
        {
          label: "Model",
          description: "Model ID as the provider expects it",
          keywords: "gpt claude llama",
          control: (
            <input
              value={settings.aiModel}
              onChange={(e) => patch({ aiModel: e.target.value })}
              style={{ ...inputStyle, width: 180 }}
              placeholder="gpt-5.2 / claude-opus-4-8"
              aria-label="AI model"
            />
          ),
        },
        {
          label: "API key",
          description: "Stored locally on this machine",
          keywords: "token secret credentials",
          control: (
            <input
              type="password"
              value={settings.aiApiKey}
              onChange={(e) => patch({ aiApiKey: e.target.value })}
              style={{ ...inputStyle, width: 240 }}
              placeholder="sk-…"
              aria-label="AI API key"
            />
          ),
        },
        {
          label: "",
          keywords: "test connection verify check",
          full: true,
          control: (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={handleTestConnection}
                disabled={testState.status === "testing"}
                style={buttonStyle}
              >
                {testState.status === "testing" ? "Testing…" : "Test Connection"}
              </button>
              {testState.status === "ok" && (
                <span style={{ fontSize: 12, color: "var(--success)" }}>✓ Connected — {testState.models} models available</span>
              )}
              {testState.status === "error" && (
                <span style={{ fontSize: 11, color: "var(--danger)" }}>{testState.message}</span>
              )}
            </div>
          ),
        },
      ],
    },
    {
      id: "updates",
      title: "Updates",
      rows: [
        {
          label: "Check for updates on startup",
          keywords: "automatic update version",
          control: (
            <Toggle
              checked={settings.checkUpdatesOnStartup}
              onChange={(checkUpdatesOnStartup) => patch({ checkUpdatesOnStartup })}
              label="Check for updates on startup"
            />
          ),
        },
        {
          label: "",
          keywords: "update install version check now",
          full: true,
          control: (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={handleCheckUpdate}
                  disabled={updateState.status === "checking" || updateState.status === "downloading"}
                  style={buttonStyle}
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

              {updateState.status === "available" && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                  {updateState.body ?? `v${updateState.version} is available.`}
                </div>
              )}
              {updateState.status === "error" && (
                <div style={{ fontSize: 11, color: "var(--warning)", lineHeight: 1.5 }}>{updateState.message}</div>
              )}
            </div>
          ),
        },
      ],
    },
    {
      id: "data",
      title: "Data",
      rows: [
        {
          label: "Recent repositories",
          description: `${recentRepos.length} in the welcome screen and File menu`,
          keywords: "clear history recent list",
          control: (
            <button
              onClick={() => { clearRecentRepos(); addToast("Recent repositories cleared", "success"); }}
              disabled={recentRepos.length === 0}
              style={{ ...buttonStyle, opacity: recentRepos.length === 0 ? 0.5 : 1 }}
            >
              Clear
            </button>
          ),
        },
        {
          label: "Reset all settings",
          description: "Restores every setting to its default value",
          keywords: "defaults factory clear wipe",
          control: (
            <button
              onClick={() =>
                showConfirm({
                  title: "Reset All Settings",
                  message: "Restore every setting to its default value? Your AI API key and all preferences will be cleared.",
                  danger: true,
                  confirmLabel: "Reset",
                  onConfirm: () => { reset(); runCommand("zoom-reset"); addToast("Settings reset to defaults", "success"); },
                })
              }
              style={{ ...buttonStyle, color: "var(--danger)", borderColor: "rgba(244,67,54,0.4)" }}
            >
              Reset…
            </button>
          ),
        },
      ],
    },
  ];

  // Search filter: match label + description + keywords + section title
  const q = query.trim().toLowerCase();
  const visibleSections = sections
    .map((s) => ({
      ...s,
      rows: q
        ? s.rows.filter((r) =>
            `${s.title} ${r.label} ${r.description ?? ""} ${r.keywords ?? ""}`.toLowerCase().includes(q)
          )
        : s.rows,
    }))
    .filter((s) => s.rows.length > 0);

  // Scroll-spy for the left nav
  useEffect(() => {
    if (q) return;
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const topmost = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (topmost) setActiveId(topmost.target.id.replace("settings-", ""));
      },
      { root, rootMargin: "0px 0px -60% 0px" }
    );
    root.querySelectorAll("[data-settings-section]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [q]);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Left nav */}
      {!q && (
        <nav aria-label="Settings sections" style={{ width: 160, flexShrink: 0, padding: "32px 0 32px 24px", overflowY: "auto" }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                scrollRef.current?.querySelector(`#settings-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveId(s.id);
              }}
              aria-current={activeId === s.id || undefined}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "5px 12px", fontSize: 12, borderRadius: 4,
                color: activeId === s.id ? "var(--text-primary)" : "var(--text-muted)",
                background: activeId === s.id ? "var(--bg-elevated)" : "transparent",
                fontWeight: activeId === s.id ? 500 : 400,
              }}
            >
              {s.title}
            </button>
          ))}
        </nav>
      )}

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "32px 40px" }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Settings</div>
            {version && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                v{version}
                <button
                  title="About GitFlow Studio"
                  aria-label="About GitFlow Studio"
                  onClick={() => openDialog("about")}
                  style={{ color: "var(--text-muted)", padding: 2 }}
                >
                  <Info size={12} />
                </button>
              </span>
            )}
          </div>

          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 24,
            padding: "6px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6,
          }}>
            <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
              placeholder="Search settings…"
              aria-label="Search settings"
              style={{ flex: 1, fontSize: 13, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)" }}
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" style={{ color: "var(--text-muted)", padding: 2 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {visibleSections.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "24px 0" }}>
              No settings match “{query}”
            </div>
          )}

          {visibleSections.map((s) => (
            <div key={s.id} id={`settings-${s.id}`} data-settings-section style={{ marginBottom: 32, scrollMarginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
                {s.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {s.rows.map((row, i) => <Row key={`${row.label}-${i}`} row={row} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
