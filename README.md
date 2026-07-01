# Gitflow Studio

A desktop Git client built with Tauri 2, React, and Rust.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)

## Features

- **Commit graph** — visual DAG with branch/tag labels
- **Staging** — stage/unstage files or individual hunks, discard changes
- **Diff viewer** — syntax-highlighted diffs for working tree, index, and commits
- **Branches** — create, switch, delete, merge, rebase
- **Stash** — push, apply, pop, drop stashes
- **Conflict resolution** — view and resolve merge/rebase conflicts
- **Command log** — real-time log of every git operation with timing

## Requirements

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- Tauri system dependencies for your OS — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

## Dev

```bash
pnpm install

# Frontend only (no native shell)
pnpm dev

# Full desktop app
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`.

## Type-check

```bash
pnpm build        # tsc + vite build
cargo check       # from src-tauri/
cargo clippy      # from src-tauri/
```

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Zustand, React Query |
| Backend | Rust, git2 (libgit2) |
| Desktop | Tauri 2 |
| Build | Vite 7, pnpm |
