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

- **`git/`** — pure git logic using `git2` (libgit2). One file per domain: `branches`, `commits`, `diff`, `staging`, `stash`, `conflict`, `graph`, `status`, `repository`.
- **`commands/`** — Tauri command handlers (thin wrappers over `git/`). Each `cmd_*` function is registered in `lib.rs`'s `invoke_handler!` macro and callable from the frontend.
- **`state/app_state.rs`** — shared `AppState` managed by Tauri: holds the current repo path (Mutex), a file-watcher stop signal, and a `CommandLogEntry` MPSC sender.
- **`watcher/`** — filesystem watcher (using `notify`) that emits `repo-changed` events to the frontend when `.git/` changes.
- **`error.rs`** — `AppError` enum serialized as `{ kind, message }` for the frontend to inspect.

Every command logs its execution to the frontend via the `command-log` Tauri event (emitted from the MPSC channel in `lib.rs::setup`).

### Frontend (`src/`)

- **`lib/ipc.ts`** — single file mapping every Tauri `invoke` call. All IPC goes through here; never call `invoke` directly elsewhere.
- **`store/`** — Zustand stores: `uiStore` (active view, dialogs, panel sizes), `repoStore` (current repo path), `stagingStore`, `commandLogStore`.
- **`hooks/`** — React Query hooks wrapping `ipc.*` calls. All data fetching and mutations live here, not in components.
- **`layouts/AppShell.tsx`** — top-level layout: left rail (`RepoRail`), main area (view switcher), right `ContextPanel`, dialogs, and `CommandLog` drawer.
- **`components/`** — organized by feature: `graph/`, `staging/`, `diff/`, `branches/`, `stash/`, `conflict/`, `rail/`, `toolbar/`, `commandlog/`.
- **`types/`** — shared TypeScript types (`git.ts`, `diff.ts`, `graph.ts`) that mirror Rust structs.

### Key data flows

1. **Repo open**: `RepoSelector` → `ipc.openRepository` → Rust sets `AppState.repo_path`, starts file watcher → emits `repo-changed` → `useRepoChangeListener` invalidates all queries.
2. **Command log**: every Rust command logs a `CommandLogEntry` to the MPSC channel → forwarded as `command-log` Tauri event → `useIpcEvent` in `AppShell` → `commandLogStore`.
3. **Views**: `uiStore.activeView` controls which main panel renders (`graph` | `staging` | `conflicts` | `stash`).
4. **Rebase flow**: `rebaseBranch` can return conflicts; `RepoInfo.state === "rebase"` triggers `RebaseActionBar` in the conflicts view with continue/abort actions.
