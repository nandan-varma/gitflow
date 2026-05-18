use tauri::State;
use crate::{
    error::AppError,
    git::diff::{get_diff_workdir, get_diff_staged, get_diff_commit, FileDiff},
    state::AppState,
};

#[tauri::command]
pub async fn cmd_get_diff_workdir(
    path: String,
    state: State<'_, AppState>,
) -> Result<FileDiff, AppError> {
    let repo = state.open_repo()?;
    get_diff_workdir(&repo, &path)
}

#[tauri::command]
pub async fn cmd_get_diff_staged(
    path: String,
    state: State<'_, AppState>,
) -> Result<FileDiff, AppError> {
    let repo = state.open_repo()?;
    get_diff_staged(&repo, &path)
}

#[tauri::command]
pub async fn cmd_get_diff_commit(
    oid: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<FileDiff, AppError> {
    let repo = state.open_repo()?;
    get_diff_commit(&repo, &oid, &path)
}
