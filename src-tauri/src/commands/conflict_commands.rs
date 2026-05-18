use tauri::State;
use crate::{
    error::AppError,
    git::conflict::{get_conflicts, get_conflict_detail, resolve_conflict, ConflictEntry, ConflictDetail},
    state::AppState,
};

#[tauri::command]
pub async fn cmd_get_conflicts(state: State<'_, AppState>) -> Result<Vec<ConflictEntry>, AppError> {
    let repo = state.open_repo()?;
    get_conflicts(&repo)
}

#[tauri::command]
pub async fn cmd_get_conflict_detail(
    path: String,
    state: State<'_, AppState>,
) -> Result<ConflictDetail, AppError> {
    let repo = state.open_repo()?;
    get_conflict_detail(&repo, &path)
}

#[tauri::command]
pub async fn cmd_resolve_conflict(
    path: String,
    resolution: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let repo = state.open_repo()?;
    resolve_conflict(&repo, &path, &resolution)
}
