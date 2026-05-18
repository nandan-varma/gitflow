use tauri::State;
use crate::{
    error::AppError,
    git::stash::{list_stashes, stash_push, stash_apply, stash_pop, stash_drop, StashEntry},
    state::AppState,
};

#[tauri::command]
pub async fn cmd_list_stashes(state: State<'_, AppState>) -> Result<Vec<StashEntry>, AppError> {
    let mut repo = state.open_repo()?;
    list_stashes(&mut repo)
}

#[tauri::command]
pub async fn cmd_stash_push(
    message: Option<String>,
    include_untracked: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut repo = state.open_repo()?;
    stash_push(&mut repo, message.as_deref(), include_untracked)
}

#[tauri::command]
pub async fn cmd_stash_apply(
    index: usize,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut repo = state.open_repo()?;
    stash_apply(&mut repo, index)
}

#[tauri::command]
pub async fn cmd_stash_pop(
    index: usize,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut repo = state.open_repo()?;
    stash_pop(&mut repo, index)
}

#[tauri::command]
pub async fn cmd_stash_drop(
    index: usize,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut repo = state.open_repo()?;
    stash_drop(&mut repo, index)
}
