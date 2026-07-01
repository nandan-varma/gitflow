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
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; get_diff_workdir(&repo, &path) })();
    state.log_command("cmd_get_diff_workdir", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_get_diff_staged(
    path: String,
    state: State<'_, AppState>,
) -> Result<FileDiff, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; get_diff_staged(&repo, &path) })();
    state.log_command("cmd_get_diff_staged", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_get_diff_commit(
    oid: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<FileDiff, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; get_diff_commit(&repo, &oid, &path) })();
    state.log_command("cmd_get_diff_commit", t, &r);
    r
}
