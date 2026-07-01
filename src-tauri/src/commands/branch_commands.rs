use tauri::State;
use crate::{
    error::AppError,
    git::branches::{
        list_branches, create_branch, switch_branch, delete_branch, merge_branch, abort_merge,
        start_rebase, continue_rebase, abort_rebase,
        BranchInfo, MergeResult, RebaseOutcome,
    },
    state::AppState,
};

#[tauri::command]
pub async fn cmd_list_branches(state: State<'_, AppState>) -> Result<Vec<BranchInfo>, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; list_branches(&repo) })();
    state.log_command("cmd_list_branches", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_create_branch(
    name: String,
    from_oid: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; create_branch(&repo, &name, from_oid.as_deref()) })();
    state.log_command("cmd_create_branch", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_switch_branch(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; switch_branch(&repo, &name) })();
    state.log_command("cmd_switch_branch", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_delete_branch(
    name: String,
    force: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; delete_branch(&repo, &name, force) })();
    state.log_command("cmd_delete_branch", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_merge_branch(
    name: String,
    state: State<'_, AppState>,
) -> Result<MergeResult, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; merge_branch(&repo, &name) })();
    state.log_command("cmd_merge_branch", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_abort_merge(state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; abort_merge(&repo) })();
    state.log_command("cmd_abort_merge", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_rebase_branch(
    upstream: String,
    state: State<'_, AppState>,
) -> Result<RebaseOutcome, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; start_rebase(&repo, &upstream) })();
    state.log_command("cmd_rebase_branch", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_continue_rebase(state: State<'_, AppState>) -> Result<RebaseOutcome, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; continue_rebase(&repo) })();
    state.log_command("cmd_continue_rebase", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_abort_rebase(state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; abort_rebase(&repo) })();
    state.log_command("cmd_abort_rebase", t, &r);
    r
}
