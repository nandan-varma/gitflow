# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (frontend-only, no Tauri shell)
pnpm dev

# Dev with Tauri desktop app
pnpm tauri dev

# Build
pnpm tauri build

# Type-check frontend
pnpm build   # runs tsc && vite build

# Rust (from src-tauri/)
cargo check
cargo clippy
```

## Tests

```bash
# Frontend unit tests
pnpm test            # vitest run

# Rust unit tests
cargo test            # from src-tauri/

# Watch mode
pnpm test:watch
```

## Architecture

This is a **Tauri 2 desktop app**: a React/TypeScript frontend rendered in a webview, communicating with a Rust backend over Tauri's IPC bridge.

### Rust backend (`src-tauri/src/`)

- **`git/`** — pure git logic using `git2` (libgit2). One file per domain: `branches`, `conflict`, `diff`, `graph`, `repository`, `staging`, `stash`, `status`. There is no `commits` module — commit creation/amend happens inline in `commit_commands.rs` using git2 directly.
- **`commands/`** — Tauri command handlers, one file per domain. Each `cmd_*` function is registered in `lib.rs`'s `invoke_handler!` macro and callable from the frontend:
  - `repo_commands`, `graph_commands`, `diff_commands`, `staging_commands`, `commit_commands`, `branch_commands`, `stash_commands`, `conflict_commands` — git2-based operations
  - `remote_commands` — shells out to the system `git` binary for push/fetch/pull (avoids git2 credential complexity)
  - `gh_commands` — shells out to the `gh` CLI for PR and issue operations
  - `opener_commands` — shells out to `code` / `open` for VS Code, Finder, and Terminal integration
- **`state/app_state.rs`** — shared `AppState`: repo path (Mutex), file-watcher stop signal, `CommandLogEntry` MPSC sender (`log_tx`).
- **`watcher/`** — filesystem watcher (`notify`) that watches the workdir recursively, filters build-dir noise (`node_modules/`, `target/`, etc.) and emits `repo-changed` events with a `git_change` boolean — `.git` mutations cause full invalidation, workdir edits refresh status/diff only.
- **`error.rs`** — `AppError` enum serialized as `{ kind, message }`.

**Adding a new git2 command** — use the sync closure trick so `log_command` always fires even on early `?` returns:

```rust
#[tauri::command]
pub async fn cmd_foo(arg: String, state: State<'_, AppState>) -> Result<T, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; foo(&repo, &arg) })();
    state.log_command("cmd_foo", t, &r);
    r
}
```

**Adding a shell command** (git CLI or gh CLI) — use an async block instead (`tokio::process::Command` is async):

```rust
#[tauri::command]
pub async fn cmd_git_foo(state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r: Result<String, AppError> = async {
        let path = state.repo_path.lock().unwrap().clone().ok_or(AppError::NoRepository)?;
        let out = tokio::process::Command::new("git").args(["foo"]).current_dir(&path).output().await
            .map_err(|e| AppError::Other(format!("git not found: {e}")))?;
        if out.status.success() { Ok(String::from_utf8_lossy(&out.stdout).to_string()) }
        else { Err(AppError::Other(String::from_utf8_lossy(&out.stderr).to_string())) }
    }.await;
    state.log_command("cmd_git_foo", t, &r);
    r
}
```

`remote_commands.rs` and `gh_commands.rs` each have a private `run_git`/`run_gh` helper that encapsulates this pattern — add new shell commands there. `opener_commands.rs` uses the same async pattern directly (no shared helper).

After adding any command: register it in `lib.rs` imports + `invoke_handler!`, add to `src/lib/ipc.ts`.

**Stash quirk:** `git/stash.rs` functions require `&mut Repository`. Use `let mut repo = state.open_repo()?` for stash commands.

**Staging type alias:** `git/staging.rs` exports `pub type HunkLine = DiffLine` (from `git/diff.rs`). `HunkLine` is what IPC deserialization uses for hunk-level staging; it is identical to `DiffLine` and derives both `Serialize` and `Deserialize`.

### Frontend (`src/`)

- **`lib/ipc.ts`** — single file mapping every Tauri `invoke` call. All IPC goes through here; never call `invoke` directly elsewhere.
- **`lib/graphLayout.ts`** — client-side DAG lane layout: takes raw `GraphPage` from Rust, assigns `x`/`lane` positions for rendering.
- **`lib/queryClient.ts`** — React Query client + `queryKeys` registry. All query keys live here; use the registry for cache invalidation (prefix-invalidate `["github", "prs"]` to bust all PR state variants).
- **`lib/commands.ts`** — app-wide command registry (see "Command system" below). Also exports `isMac`, `matchesShortcut`, `toAccelerator`, `formatShortcut`.
- **`lib/menu.ts`** — native macOS menubar built from the command registry.
- **`lib/theme.ts`** — resolves the `theme` setting (`system`/`light`/`dark`) to `document.documentElement.dataset.theme`; follows OS appearance live in system mode.
- **`lib/a11y.ts`** — `rowProps(onActivate)`: spread onto clickable `<div>` rows to add `role="button"`, `tabIndex`, Enter/Space activation, and ⇧F10 → synthesized `contextmenu` event (reuses the row's existing `onContextMenu`).
- **`store/`** — Zustand stores: `uiStore` (active view, dialogs, panel sizes, context menu state), `repoStore` (repo path, recent repos), `stagingStore`, `commandLogStore`, `confirmStore` (global confirm dialog; danger variant is hold-to-confirm), `toastStore`, `settingsStore` (persisted to `localStorage`; to add a setting, extend the `Settings` interface + `defaults` — persistence derives its keys from `defaults`).
- **`hooks/`** — React Query hooks wrapping `ipc.*`. All fetching and mutations live here, not in components.
- **`layouts/AppShell.tsx`** — top-level layout; mounts `useAppCommands()`, the `command-log` listener, the macOS menu rebuild effect, theme/zoom-on-startup, the auto-fetch interval, and renders the global `<ContextMenu />`, `<CommandPalette />`, `<ConfirmDialog />`, and all `activeDialog` dialogs.
- **`types/`** — shared TypeScript types mirroring Rust structs (`git.ts`, `diff.ts`, `graph.ts`, `github.ts`), plus `contextMenu.ts` for the `MenuItem` union type.

### Command system (shortcuts, menubar, palette)

One registry feeds three surfaces. `src/hooks/useAppCommands.ts` (mounted once in `AppShell`) builds an `AppCommand[]` (`{ id, label, shortcut?, enabled, run }`, shortcut format `"mod+shift+p"`) every render from hooks/stores and publishes it via `setCommands()` in `src/lib/commands.ts`. Consumers read the registry at call time (never capture stale closures):

1. **Global keydown listener** (in `useAppCommands`) — handles shortcuts on all platforms; skips them on macOS when the native menu is installed (menu key-equivalents fire first), and skips non-`mod` shortcuts while typing in inputs.
2. **macOS menubar** (`src/lib/menu.ts`) — only on macOS (window is frameless, so Windows/Linux have no menubar). Rebuilt **wholesale** by an `AppShell` effect on `[currentRepoPath, recentRepos, diffMode]` change; menu items call `runCommand(id)`. Must keep the predefined Edit items (Undo/Copy/Paste/…) or webview clipboard shortcuts break.
3. **Command palette** (`src/components/CommandPalette.tsx`, ⌘K) — lists enabled commands + recent repos; opened via `uiStore.openDialog("command-palette")`.

**To add a command**: add it to the array in `useAppCommands.ts`; it appears in the palette automatically. Add a menu item in `menu.ts` if it belongs in the menubar, and it shows up in the Settings → Keyboard Shortcuts section for free (generated from the registry). Frontend webview/window APIs may need a permission in `src-tauri/capabilities/default.json` (e.g. zoom needed `core:webview:allow-set-webview-zoom`).

### Dialogs

All dialogs render through `src/components/ui/DialogShell.tsx` (overlay + card + `role="dialog"` + Escape-to-close + Tab focus trap + focus restore). Never hand-roll `dialog-overlay`/`dialog-card` markup. Dialog open state lives in `uiStore.activeDialog` (one at a time, payload in `dialogPayload`); confirmations go through `confirmStore.showConfirm()` — the `danger: true` variant requires an 800ms hold (mouse or Enter/Space) to confirm.

### Accessibility conventions

- Clickable non-button rows get `{...rowProps(onActivate)}` from `lib/a11y.ts` (plus an `aria-label`).
- Icon-only buttons always get `aria-label` (a `title` alone is not announced).
- `index.css` `focus-visible` rule covers `button`, `[role="button"]`, and `[tabindex="0"]`.
- Toasts announce via `aria-live="polite"` on `ToastContainer`.
- Commit graph supports ↑/↓ selection (keydown on the scroll container in `CommitGraph.tsx`, `virtualizer.scrollToIndex`).

### Theming

Dark palette lives in `:root` in `index.css`; the light palette is `:root[data-theme="light"]`. The attribute is always a resolved `"light"`/`"dark"` set by `lib/theme.ts` from `settingsStore.theme` — do not use `prefers-color-scheme` media queries in CSS; add light-mode overrides under the `[data-theme="light"]` selector.

### Settings page

`src/components/settings/SettingsPage.tsx` is data-driven: a `sections: { id, title, rows }[]` array rendered with left-nav scroll-spy and a client-side search that matches row `label + description + keywords`. To add a setting: add the field to `settingsStore`, then add a row object (with `keywords` for search) to the right section. Rows with `full: true` span the column (used for the update status block and the AI test-connection row).

### Context menu system

`uiStore` holds `contextMenu: { x, y, items: MenuItem[] } | null` with `showContextMenu(x, y, items)` / `hideContextMenu()`. `ContextMenu.tsx` is rendered once in `AppShell` as a fixed-position overlay. To add a context menu to any element:

```tsx
const { showContextMenu } = useUIStore();
<div onContextMenu={(e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, [
  { label: "Do thing", action: () => ... },
  "separator",
  { label: "Danger", danger: true, action: () => ... },
]); }} />
```

`ContextMenu` focuses its first item on open and supports ↑/↓/Enter/Escape. Rows using `rowProps()` open their menu via ⇧F10 with no extra wiring.

### Text selection

`index.css` sets `user-select: none` globally. To make text copyable, use `data-selectable` attribute on the element or `userSelect: "text"` inline. Diff code content (`<pre>` in `DiffLine`), commit body/summary, and PR/issue body text are already opted in.

### Views

`uiStore.activeView` controls which panel renders. Current values: `graph` | `staging` | `conflicts` | `stash` | `pull-requests` | `settings` | `blame` | `file-history`.

| View | Main component | Hook file |
|------|---------------|-----------|
| graph | `CommitGraph` | `useCommitGraph` |
| staging | `StagingArea` | `useFileStatus` |
| conflicts | `ConflictEditor` | (useRepository) |
| stash | `StashManager` | `useStashes` |
| pull-requests | `PullRequestsView` | `useGitHub` |
| blame | `BlameView` | — |
| file-history | `FileHistoryView` | — |

`blame` and `file-history` are opened via `uiStore.openBlame(path)` / `uiStore.openFileHistory(path)`, not `setActiveView`.

### Key data flows

1. **Repo open**: `WelcomeScreen` (inside `CommitGraph.tsx`), Toolbar, ⌘O, or File ▸ Open Recent → `repoStore.openRepository` → `ipc.openRepository` → Rust sets `AppState.repo_path`, starts watcher → emits `repo-opened` + watcher emits `repo-changed` events → `useRepoChangeListener` invalidates status/diff on workdir edits, and additionally branches/stashes/repo/graph/conflicts/tags for `.git/` changes.
2. **Command log**: every Rust command calls `state.log_command(...)` → MPSC → `lib.rs::setup` forwarder → `command-log` Tauri event → `useIpcEvent` in `AppShell` → `commandLogStore`. `log_command` emits timestamp in **seconds** (matching `formatRelativeTime` in `diffParser.ts` which divides `Date.now()` by 1000).
3. **Remote ops**: toolbar push/fetch/pull buttons call `remote_commands` which shell out to the system `git` binary; all invalidate `["branches"]`, `["repo"]`, `["graph"]` (`invalidateAfterRemote` in `useRemote.ts`). Auto-fetch (optional setting) runs the same fetch silently on an interval in `AppShell` — no toast.
4. **GitHub PR/Issue data**: `gh_commands` shell out to `gh` CLI. `usePullRequests(state)` and `useIssues(state)` accept a state string (`open`/`closed`/`merged`/`all`). Query keys include state: `["github", "prs", state]` and `["github", "issues", state]`. `PullRequestsView` manages type (`both`/`prs`/`issues`) and state filter locally; `BranchList` always fetches open PRs for branch badges.
5. **Rebase flow**: `rebaseBranch` returns `{ type: "Conflicts" }`; `RepoInfo.state === "rebase"` triggers `RebaseActionBar` in the conflicts view. Use `useContinueRebase` / `useAbortRebase` hooks from `useBranches.ts`.
5a. **Cherry-pick flow**: mirrors rebase — `cherryPick` returns `{ type: "Conflicts" }`; `RepoInfo.state === "cherry-pick"` triggers `CherryPickActionBar`. Hooks: `useCherryPickContinue` / `useCherryPickAbort` in `useBranches.ts`.
6. **External tool openers**: `opener_commands.rs` shells out to `code <path>` (VS Code), `open -R <path>` (Finder reveal), and `open -a Terminal <dir>`. Path arguments are relative to `AppState.repo_path`; empty string means repo root.

### AI chat (`src/components/ai/`, `src/lib/aiTools.ts`, `src/store/aiStore.ts`)

An in-app AI assistant uses the OpenAI-compatible chat API. Configuration (`aiBaseUrl`, `aiModel`, `aiApiKey`) lives in `settingsStore` (persisted to `localStorage`) — defaults point to `https://api.openai.com/v1` but any OpenAI-compat endpoint works. The AI goes through the same `ipc.*` call path as the UI (command log, watcher, React Query invalidation all fire normally). `aiTools.ts` defines the full tool schema mapping IPC calls to OpenAI function-call format.

### Log filtering (`lib.rs`)

```rust
tauri_plugin_log::Builder::new()
    .level(log::LevelFilter::Warn)
    .level_for("gitflow_studio_lib", log::LevelFilter::Debug)
    .level_for("tauri_plugin_updater", log::LevelFilter::Off)  // remove once releases published
    .build()
```
