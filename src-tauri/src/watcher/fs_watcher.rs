use std::{
    path::PathBuf,
    sync::{Arc, atomic::{AtomicBool, Ordering}},
    time::Duration,
};
use log::{error, warn};
use notify_debouncer_full::{new_debouncer, notify::{RecursiveMode, Watcher}};
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct RepoChangedPayload {
    pub paths: Vec<String>,
    pub git_change: bool,
}

fn is_ignored_noise(s: &str) -> bool {
    // ponytail: upgrade to parsing .gitignore via the `ignore` crate for full coverage
    let noise_segments = ["/node_modules/", "/target/", "/dist/", "/.venv/"];
    noise_segments.iter().any(|seg| s.contains(seg))
}

pub fn start_watcher(
    app: AppHandle,
    repo_path: PathBuf,
) -> Arc<AtomicBool> {
    let stop = Arc::new(AtomicBool::new(false));
    let stop_clone = Arc::clone(&stop);
    let repo_git_dir = repo_path.join(".git");

    tokio::task::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut debouncer = match new_debouncer(Duration::from_millis(150), None, tx) {
            Ok(d) => d,
            Err(e) => {
                error!("Failed to create watcher: {e}");
                return;
            }
        };

        if let Err(e) = debouncer.watcher().watch(&repo_path, RecursiveMode::Recursive) {
            error!("Failed to watch {repo_path:?}: {e}");
            return;
        }

        loop {
            if stop_clone.load(Ordering::Relaxed) {
                break;
            }

            match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(Ok(events)) => {
                    let mut git_change = false;
                    let mut workdir_paths: Vec<String> = Vec::new();
                    for p in events.iter().flat_map(|e| &e.paths) {
                        let s = p.to_string_lossy();
                        if s.ends_with("index.lock") || s.contains("/.git/objects/") {
                            continue;
                        }
                        if p.starts_with(&repo_git_dir) {
                            git_change = true;
                        } else if !is_ignored_noise(&s) {
                            workdir_paths.push(s.to_string());
                        }
                    }
                    if git_change || !workdir_paths.is_empty() {
                        let _ = app.emit("repo-changed", RepoChangedPayload { paths: workdir_paths, git_change });
                    }
                }
                Ok(Err(errors)) => {
                    for e in errors {
                        warn!("Watch error: {e:?}");
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(_) => break,
            }
        }
    });

    stop
}
