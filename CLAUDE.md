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
- **`watcher/`** — filesystem watcher (`notify`) that emits `repo-changed` Tauri events on `.git/` changes.
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

### Frontend (`src/`)

- **`lib/ipc.ts`** — single file mapping every Tauri `invoke` call. All IPC goes through here; never call `invoke` directly elsewhere.
- **`lib/graphLayout.ts`** — client-side DAG lane layout: takes raw `GraphPage` from Rust, assigns `x`/`lane` positions for rendering.
- **`lib/queryClient.ts`** — React Query client + `queryKeys` registry. All query keys live here; use the registry for cache invalidation (prefix-invalidate `["github", "prs"]` to bust all PR state variants).
- **`store/`** — Zustand stores: `uiStore` (active view, dialogs, panel sizes, context menu state), `repoStore` (repo path), `stagingStore`, `commandLogStore`, `settingsStore` (persisted to `localStorage`).
- **`hooks/`** — React Query hooks wrapping `ipc.*`. All fetching and mutations live here, not in components.
- **`layouts/AppShell.tsx`** — top-level layout, IPC event listener for `command-log`, and renders the global `<ContextMenu />`.
- **`types/`** — shared TypeScript types mirroring Rust structs (`git.ts`, `diff.ts`, `graph.ts`, `github.ts`), plus `contextMenu.ts` for the `MenuItem` union type.

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

### Text selection

`index.css` sets `user-select: none` globally. To make text copyable, use `data-selectable` attribute on the element or `userSelect: "text"` inline. Diff code content (`<pre>` in `DiffLine`), commit body/summary, and PR/issue body text are already opted in.

### Views

`uiStore.activeView` controls which panel renders. Current values: `graph` | `staging` | `conflicts` | `stash` | `pull-requests` | `settings`.

| View | Main component | Hook file |
|------|---------------|-----------|
| graph | `CommitGraph` | `useCommitGraph` |
| staging | `StagingArea` | `useFileStatus` |
| conflicts | `ConflictEditor` | (useRepository) |
| stash | `StashManager` | `useStashes` |
| pull-requests | `PullRequestsView` | `useGitHub` |

### Key data flows

1. **Repo open**: `RepoSelector` → `ipc.openRepository` → Rust sets `AppState.repo_path`, starts watcher → emits `repo-opened` + watcher emits `repo-changed` on `.git/` changes → `useRepoChangeListener` invalidates all queries.
2. **Command log**: every Rust command calls `state.log_command(...)` → MPSC → `lib.rs::setup` forwarder → `command-log` Tauri event → `useIpcEvent` in `AppShell` → `commandLogStore`. `log_command` emits timestamp in **seconds** (matching `formatRelativeTime` in `diffParser.ts` which divides `Date.now()` by 1000).
3. **Remote ops**: toolbar push/fetch/pull buttons call `remote_commands` which shell out to the system `git` binary; all invalidate `["branches"]`, `["repo"]`, `["graph"]`.
4. **GitHub PR/Issue data**: `gh_commands` shell out to `gh` CLI. `usePullRequests(state)` and `useIssues(state)` accept a state string (`open`/`closed`/`merged`/`all`). Query keys include state: `["github", "prs", state]` and `["github", "issues", state]`. `PullRequestsView` manages type (`both`/`prs`/`issues`) and state filter locally; `BranchList` always fetches open PRs for branch badges.
5. **Rebase flow**: `rebaseBranch` returns `{ type: "Conflicts" }`; `RepoInfo.state === "rebase"` triggers `RebaseActionBar` in the conflicts view.
6. **External tool openers**: `opener_commands.rs` shells out to `code <path>` (VS Code), `open -R <path>` (Finder reveal), and `open -a Terminal <dir>`. Path arguments are relative to `AppState.repo_path`; empty string means repo root.

### Log filtering (`lib.rs`)

```rust
tauri_plugin_log::Builder::new()
    .level(log::LevelFilter::Warn)
    .level_for("gitflow_studio_lib", log::LevelFilter::Debug)
    .level_for("tauri_plugin_updater", log::LevelFilter::Off)  // remove once releases published
    .build()
```
