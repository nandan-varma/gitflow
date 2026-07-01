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

No test suite yet. Rust logic can be spot-checked with `cargo check` and `clippy`.

## Architecture

This is a **Tauri 2 desktop app**: a React/TypeScript frontend rendered in a webview, communicating with a Rust backend over Tauri's IPC bridge.

### Rust backend (`src-tauri/src/`)

- **`git/`** — pure git logic using `git2` (libgit2). One file per domain: `branches`, `conflict`, `diff`, `graph`, `repository`, `staging`, `stash`, `status`. There is no `commits` module — commit creation/amend happens inline in `commit_commands.rs` using git2 directly.
- **`commands/`** — Tauri command handlers (thin wrappers over `git/`). Each `cmd_*` function is registered in `lib.rs`'s `invoke_handler!` macro and callable from the frontend.
- **`state/app_state.rs`** — shared `AppState` managed by Tauri: holds the current repo path (Mutex), a file-watcher stop signal, and a `CommandLogEntry` MPSC sender (`log_tx`).
- **`watcher/`** — filesystem watcher (using `notify`) that emits `repo-changed` events to the frontend when `.git/` changes.
- **`error.rs`** — `AppError` enum serialized as `{ kind, message }` for the frontend to inspect.

**Adding a new command:** every handler must follow this pattern to emit a log entry:

```rust
#[tauri::command]
pub async fn cmd_foo(arg: String, state: State<'_, AppState>) -> Result<T, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; foo(&repo, &arg) })();
    state.log_command("cmd_foo", t, &r);
    r
}
```

The closure captures early `?` returns so `log_command` always fires. Register the function in `lib.rs`'s `invoke_handler!` and in `src/lib/ipc.ts`.

**Stash quirk:** `git/stash.rs` functions require `&mut Repository` (libgit2 API). Use `let mut repo = state.open_repo()?` inside the closure for stash commands.

### Frontend (`src/`)

- **`lib/ipc.ts`** — single file mapping every Tauri `invoke` call. All IPC goes through here; never call `invoke` directly elsewhere.
- **`lib/graphLayout.ts`** — client-side DAG lane layout: takes raw `GraphPage` from Rust and assigns `x`/`lane` positions for rendering.
- **`store/`** — Zustand stores: `uiStore` (active view, dialogs, panel sizes), `repoStore` (current repo path), `stagingStore`, `commandLogStore`, `settingsStore` (persisted to `localStorage`, not Tauri storage).
- **`hooks/`** — React Query hooks wrapping `ipc.*` calls. All data fetching and mutations live here, not in components.
- **`layouts/AppShell.tsx`** — top-level layout: left rail (`RepoRail`), main area (view switcher), right `ContextPanel`, dialogs, and `CommandLog` drawer. Also the IPC event listener for `command-log`.
- **`types/`** — shared TypeScript types (`git.ts`, `diff.ts`, `graph.ts`) that mirror Rust structs. Keep in sync when changing Rust structs.

### Key data flows

1. **Repo open**: `RepoSelector` → `ipc.openRepository` → Rust sets `AppState.repo_path`, starts file watcher, emits `repo-opened` → watcher emits `repo-changed` on `.git/` changes → `useRepoChangeListener` invalidates all queries.
2. **Command log**: every Rust command calls `state.log_command(...)` → sent via MPSC to the forwarder in `lib.rs::setup` → emitted as `command-log` Tauri event → `useIpcEvent` in `AppShell` → `commandLogStore`. `formatRelativeTime` in `diffParser.ts` expects Unix seconds; `log_command` emits `now.timestamp()` (seconds).
3. **Views**: `uiStore.activeView` controls which main panel renders (`graph` | `staging` | `conflicts` | `stash`).
4. **Rebase flow**: `rebaseBranch` can return `{ type: "Conflicts" }`; `RepoInfo.state === "rebase"` triggers `RebaseActionBar` in the conflicts view with continue/abort actions.

### Log filtering (`lib.rs`)

`tauri_plugin_log` is configured to suppress noisy tao/reqwest TRACE output:

```rust
tauri_plugin_log::Builder::new()
    .level(log::LevelFilter::Warn)           // all crates default to Warn
    .level_for("gitflow_studio_lib", log::LevelFilter::Debug)  // app code gets Debug
    .level_for("tauri_plugin_updater", log::LevelFilter::Off)  // no release endpoint yet
    .build()
```

Remove the `tauri_plugin_updater` line once GitHub releases are published.
