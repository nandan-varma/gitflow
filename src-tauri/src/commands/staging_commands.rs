use tauri::State;
use crate::{
    error::AppError,
    git::staging::{stage_file, unstage_file, stage_hunk, unstage_hunk, discard_changes, HunkLine},
    state::AppState,
};

#[tauri::command]
pub async fn cmd_stage_file(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let repo = state.open_repo()?;
    stage_file(&repo, &path)
}

#[tauri::command]
pub async fn cmd_unstage_file(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let repo = state.open_repo()?;
    let result = unstage_file(&repo, &path);
    eprintln!("[unstage] path={path:?} result={result:?}");
    result
}

#[tauri::command]
pub async fn cmd_stage_hunk(
    path: String,
    lines: Vec<HunkLine>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let repo = state.open_repo()?;
    stage_hunk(&repo, &path, &lines)
}

#[tauri::command]
pub async fn cmd_unstage_hunk(
    path: String,
    lines: Vec<HunkLine>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let repo = state.open_repo()?;
    unstage_hunk(&repo, &path, &lines)
}

#[tauri::command]
pub async fn cmd_discard_changes(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let repo = state.open_repo()?;
    discard_changes(&repo, &path)
}
