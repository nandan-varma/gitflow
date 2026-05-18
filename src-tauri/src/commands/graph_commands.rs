use tauri::State;
use crate::{
    error::AppError,
    git::graph::{get_commit_graph, get_commit_detail, GraphPage, CommitDetail},
    state::AppState,
};

#[tauri::command]
pub async fn cmd_get_commit_graph(
    limit: usize,
    offset: usize,
    state: State<'_, AppState>,
) -> Result<GraphPage, AppError> {
    let repo = state.open_repo()?;
    get_commit_graph(&repo, limit.max(1).min(500), offset)
}

#[tauri::command]
pub async fn cmd_get_commit_detail(
    oid: String,
    state: State<'_, AppState>,
) -> Result<CommitDetail, AppError> {
    let repo = state.open_repo()?;
    get_commit_detail(&repo, &oid)
}
