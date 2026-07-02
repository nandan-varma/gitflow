# GitFlow Studio

A fast, native Git client built with Tauri 2, React, and Rust. Runs on macOS, Linux, and Windows.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)
![CI](https://github.com/nandan-varma/gitflow/actions/workflows/ci.yml/badge.svg)

## Features

**Core git**
- Commit graph — visual DAG with topological+time sort, branch/tag labels, infinite scroll
- Staging — stage/unstage files, individual hunks, or selected lines; discard changes
- Diff viewer — unified and split modes, syntax highlighting, word-level diff on changed lines
- Branches — create, switch, delete, merge, rebase; ahead/behind tracking
- Interactive rebase — reorder, fixup, drop commits
- Cherry-pick — with conflict detection and continue/abort flow
- Stash — push (with untracked), apply, pop, drop
- Conflict resolution — three-pane editor (ours / theirs / result) for merge, rebase, and cherry-pick conflicts
- Blame — line-by-line author and commit annotation against HEAD
- File history — per-file commit log

**GitHub integration** (requires [`gh` CLI](https://cli.github.com/))
- Pull requests — list, view, create, checkout, merge
- Issues — list, view, open in browser
- Branch badges showing open PR status

**AI assistant** (OpenAI-compatible API)
- In-panel chat with full tool access to the open repo
- Dangerous actions (discard, force delete, push, merge) require hold-to-approve

**Developer experience**
- Command log — every git operation with duration and error details
- Real-time file watcher — UI refreshes automatically on external changes
- Resizable panels — rail, context panel, command log
- Context menus throughout
- Auto-updater

## Installation

### Download a release

Go to [Releases](https://github.com/nandan-varma/gitflow/releases) and download the build for your platform:

| Platform | File |
|----------|------|
| macOS Apple Silicon | `GitFlow-Studio_*_aarch64.dmg` |
| macOS Intel | `GitFlow-Studio_*_x64.dmg` |
| Windows | `GitFlow-Studio_*_x64-setup.exe` |
| Linux (portable) | `gitflow-studio_*_amd64.AppImage` |
| Linux (Debian/Ubuntu) | `gitflow-studio_*_amd64.deb` |

> **macOS**: if Gatekeeper blocks the app, right-click → Open.

### Build from source

**Prerequisites**

- [Rust](https://rustup.rs/) stable
- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 11+
- Tauri system dependencies for your OS — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

```bash
git clone https://github.com/nandan-varma/gitflow.git
cd gitflow
pnpm install
pnpm tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`.

## Development

```bash
pnpm install

# Frontend only (hot-reload in browser, no Tauri shell — useful for UI work)
pnpm dev

# Full desktop app with hot-reload
pnpm tauri dev
```

### Type-check and lint

```bash
pnpm build          # tsc + vite build
cargo clippy        # from src-tauri/
```

### Tests

```bash
pnpm test           # frontend unit tests (vitest)
cargo test          # Rust unit tests (from src-tauri/)
```

Rust tests spin up temporary git repos in the system temp dir and clean up after themselves. They run in parallel and are safe to run alongside other test processes.

## Configuration

### AI assistant

Open Settings (gear icon) and set:

| Field | Description |
|-------|-------------|
| Base URL | OpenAI-compatible endpoint, e.g. `https://api.openai.com/v1` |
| Model | Model name, e.g. `gpt-4o` or `claude-opus-4-5` |
| API Key | Your API key (stored in `localStorage`) |

Any OpenAI-compatible API works — OpenAI, Anthropic (via compatible proxy), Ollama, etc.

### GitHub integration

Install the [`gh` CLI](https://cli.github.com/) and authenticate:

```bash
gh auth login
```

PR and issue features appear automatically when `gh` is available and the open repo has a GitHub remote.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Zustand, TanStack Query, TanStack Virtual |
| Backend | Rust, git2 (libgit2, statically linked) |
| Desktop shell | Tauri 2 |
| Build | Vite 7, pnpm |
| AI | OpenAI SDK (browser mode, any compatible endpoint) |
| Syntax highlighting | Shiki |

## Architecture

GitFlow Studio is a Tauri 2 app: a React/TypeScript frontend in a webview, talking to a Rust backend over Tauri's IPC bridge.

```
src/                    # React frontend
  lib/ipc.ts            # All invoke() calls — single source of truth for IPC
  lib/graphLayout.ts    # Client-side DAG lane assignment
  lib/queryClient.ts    # React Query client + queryKeys registry
  hooks/                # React Query hooks (all data fetching lives here)
  store/                # Zustand stores (ui, repo, staging, settings, ai, ...)
  components/           # UI components, one folder per feature
  layouts/AppShell.tsx  # Root layout, wires up IPC events and global overlays

src-tauri/src/          # Rust backend
  git/                  # Pure git logic (git2): branches, diff, graph, staging, ...
  commands/             # Tauri command handlers (one file per domain)
  state/app_state.rs    # Shared state: repo path, watcher stop signal, log channel
  watcher/              # File watcher → emits repo-changed events to frontend
  error.rs              # AppError enum, serialized as { kind, message }
```

The frontend never calls `invoke()` directly — everything goes through `src/lib/ipc.ts`. All React Query keys are registered in `src/lib/queryClient.ts`; use prefix invalidation to bust related queries (e.g. `["github", "prs"]` busts all PR state variants).

The file watcher emits `repo-changed` with a `git_change: boolean` flag. Workdir changes refresh status and diffs only; `.git/` changes additionally invalidate branches, graph, conflicts, stashes, and tags.

## CI / Releases

CI runs on every push and PR: `cargo clippy -- -D warnings`, `cargo test`, `pnpm build`, `pnpm test`.

Releases are built for macOS (arm64 + x64), Linux, and Windows by pushing a `v*` tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions builds signed bundles and creates a draft release.
