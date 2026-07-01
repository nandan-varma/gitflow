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
}

pub fn start_watcher(
    app: AppHandle,
    repo_path: PathBuf,
) -> Arc<AtomicBool> {
    let stop = Arc::new(AtomicBool::new(false));
    let stop_clone = Arc::clone(&stop);

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
                    let paths: Vec<String> = events
                        .iter()
                        .flat_map(|e| &e.paths)
                        .map(|p| p.to_string_lossy().to_string())
                        .filter(|p| !p.ends_with("index.lock"))
                        .collect();

                    if !paths.is_empty() {
                        let _ = app.emit("repo-changed", RepoChangedPayload { paths });
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
