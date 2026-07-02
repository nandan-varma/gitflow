use tauri::State;
use crate::{
    error::AppError,
    git::stash::{list_stashes, stash_push, stash_apply, stash_pop, stash_drop, get_stash_diff, StashEntry},
    git::diff::FileDiff,
    state::AppState,
};

#[tauri::command]
pub async fn cmd_list_stashes(state: State<'_, AppState>) -> Result<Vec<StashEntry>, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let mut repo = state.open_repo()?; list_stashes(&mut repo) })();
    state.log_command("cmd_list_stashes", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_stash_push(
    message: Option<String>,
    include_untracked: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let mut repo = state.open_repo()?; stash_push(&mut repo, message.as_deref(), include_untracked) })();
    state.log_command("cmd_stash_push", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_stash_apply(
    index: usize,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let mut repo = state.open_repo()?; stash_apply(&mut repo, index) })();
    state.log_command("cmd_stash_apply", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_stash_pop(
    index: usize,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let mut repo = state.open_repo()?; stash_pop(&mut repo, index) })();
    state.log_command("cmd_stash_pop", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_stash_drop(
    index: usize,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let mut repo = state.open_repo()?; stash_drop(&mut repo, index) })();
    state.log_command("cmd_stash_drop", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_get_stash_diff(
    index: usize,
    state: State<'_, AppState>,
) -> Result<Vec<FileDiff>, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let mut repo = state.open_repo()?; get_stash_diff(&mut repo, index) })();
    state.log_command("cmd_get_stash_diff", t, &r);
    r
}
