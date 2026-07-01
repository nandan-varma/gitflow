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
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; get_commit_graph(&repo, limit.max(1).min(500), offset) })();
    state.log_command("cmd_get_commit_graph", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_get_commit_detail(
    oid: String,
    state: State<'_, AppState>,
) -> Result<CommitDetail, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; get_commit_detail(&repo, &oid) })();
    state.log_command("cmd_get_commit_detail", t, &r);
    r
}
