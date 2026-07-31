use std::{
    path::PathBuf,
    sync::{Arc, Mutex, atomic::{AtomicBool, AtomicU64, Ordering}},
};
use tokio::sync::mpsc;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CommandLogEntry {
    pub id: String,
    pub command: String,
    pub timestamp: i64,
    pub duration_ms: u64,
    pub success: bool,
    pub error_message: Option<String>,
}

/// Cached, fully-ordered oid list for the commit graph, plus the
/// `graph::compute_state_key` fingerprint it was built from. Revalidated
/// (cheaply) on every graph request; rebuilt only when the fingerprint
/// no longer matches — see `commands::graph_commands::cmd_get_commit_graph`.
pub struct GraphCache {
    pub key: u64,
    pub oids: Vec<git2::Oid>,
}

pub struct AppState {
    pub repo_path: Mutex<Option<PathBuf>>,
    pub log_tx: mpsc::UnboundedSender<CommandLogEntry>,
    pub watch_stop: Mutex<Option<Arc<AtomicBool>>>,
    pub graph_cache: Mutex<Option<GraphCache>>,
}

impl AppState {
    pub fn new(log_tx: mpsc::UnboundedSender<CommandLogEntry>) -> Self {
        Self {
            repo_path: Mutex::new(None),
            log_tx,
            watch_stop: Mutex::new(None),
            graph_cache: Mutex::new(None),
        }
    }

    pub fn set_repo_path(&self, path: PathBuf) {
        *self.repo_path.lock().expect("repo_path mutex poisoned") = Some(path);
        // A new repo invalidates any cached graph — its state key is computed
        // against whichever repo is currently open.
        *self.graph_cache.lock().expect("graph_cache mutex poisoned") = None;
    }

    pub fn open_repo(&self) -> Result<git2::Repository, crate::error::AppError> {
        let guard = self.repo_path.lock().expect("repo_path mutex poisoned");
        let path = guard.as_ref().ok_or(crate::error::AppError::NoRepository)?;
        Ok(git2::Repository::discover(path)?)
    }

    pub fn stop_watcher(&self) {
        if let Some(stop) = self.watch_stop.lock().expect("watch_stop mutex poisoned").take() {
            stop.store(true, Ordering::Relaxed);
        }
    }

    pub fn set_watcher(&self, stop: Arc<AtomicBool>) {
        self.stop_watcher();
        *self.watch_stop.lock().expect("watch_stop mutex poisoned") = Some(stop);
    }

    pub fn log_command<T, E: std::fmt::Display>(
        &self,
        name: &'static str,
        start: std::time::Instant,
        result: &Result<T, E>,
    ) {
        static LOG_SEQ: AtomicU64 = AtomicU64::new(0);
        let now = chrono::Utc::now();
        let entry = CommandLogEntry {
            id: LOG_SEQ.fetch_add(1, Ordering::Relaxed).to_string(),
            command: name.to_string(),
            timestamp: now.timestamp(),
            duration_ms: start.elapsed().as_millis() as u64,
            success: result.is_ok(),
            error_message: result.as_ref().err().map(|e| e.to_string()),
        };
        let _ = self.log_tx.send(entry);
    }
}
