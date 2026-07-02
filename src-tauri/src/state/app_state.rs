use std::{
    path::PathBuf,
    sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}},
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

pub struct AppState {
    pub repo_path: Mutex<Option<PathBuf>>,
    pub log_tx: mpsc::UnboundedSender<CommandLogEntry>,
    pub watch_stop: Mutex<Option<Arc<AtomicBool>>>,
}

impl AppState {
    pub fn new(log_tx: mpsc::UnboundedSender<CommandLogEntry>) -> Self {
        Self {
            repo_path: Mutex::new(None),
            log_tx,
            watch_stop: Mutex::new(None),
        }
    }

    pub fn set_repo_path(&self, path: PathBuf) {
        *self.repo_path.lock().expect("repo_path mutex poisoned") = Some(path);
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
        let now = chrono::Utc::now();
        let entry = CommandLogEntry {
            id: now.timestamp_nanos_opt().unwrap_or(0).to_string(),
            command: name.to_string(),
            timestamp: now.timestamp(),
            duration_ms: start.elapsed().as_millis() as u64,
            success: result.is_ok(),
            error_message: result.as_ref().err().map(|e| e.to_string()),
        };
        let _ = self.log_tx.send(entry);
    }
}
