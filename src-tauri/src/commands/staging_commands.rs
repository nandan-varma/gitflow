use tauri::State;
use crate::{
    error::AppError,
    git::staging::{stage_file, unstage_file, stage_hunk, unstage_hunk, discard_changes, HunkLine},
    state::AppState,
};

#[tauri::command]
pub async fn cmd_stage_file(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; stage_file(&repo, &path) })();
    state.log_command("cmd_stage_file", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_unstage_file(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; unstage_file(&repo, &path) })();
    state.log_command("cmd_unstage_file", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_stage_hunk(
    path: String,
    lines: Vec<HunkLine>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; stage_hunk(&repo, &path, &lines) })();
    state.log_command("cmd_stage_hunk", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_unstage_hunk(
    path: String,
    lines: Vec<HunkLine>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; unstage_hunk(&repo, &path, &lines) })();
    state.log_command("cmd_unstage_hunk", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_discard_changes(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; discard_changes(&repo, &path) })();
    state.log_command("cmd_discard_changes", t, &r);
    r
}
