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
    #[allow(dead_code)]
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

    #[allow(dead_code)]
    pub fn repo_path(&self) -> Option<PathBuf> {
        self.repo_path.lock().unwrap().clone()
    }

    pub fn set_repo_path(&self, path: PathBuf) {
        *self.repo_path.lock().unwrap() = Some(path);
    }

    pub fn open_repo(&self) -> Result<git2::Repository, crate::error::AppError> {
        let guard = self.repo_path.lock().unwrap();
        let path = guard.as_ref().ok_or(crate::error::AppError::NoRepository)?;
        Ok(git2::Repository::open(path)?)
    }

    pub fn stop_watcher(&self) {
        if let Some(stop) = self.watch_stop.lock().unwrap().take() {
            stop.store(true, Ordering::Relaxed);
        }
    }

    pub fn set_watcher(&self, stop: Arc<AtomicBool>) {
        self.stop_watcher();
        *self.watch_stop.lock().unwrap() = Some(stop);
    }

    #[allow(dead_code)]
    pub fn log(&self, entry: CommandLogEntry) {
        let _ = self.log_tx.send(entry);
    }
}
