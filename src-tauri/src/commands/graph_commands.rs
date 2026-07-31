use tauri::State;
use crate::{
    error::AppError,
    git::graph::{compute_state_key, list_all_oids, page_from_oids, get_commit_detail, get_file_history, GraphPage, CommitDetail, FileHistoryEntry},
    state::{AppState, GraphCache},
};

#[tauri::command]
pub async fn cmd_get_commit_graph(
    limit: usize,
    offset: usize,
    state: State<'_, AppState>,
) -> Result<GraphPage, AppError> {
    let t = std::time::Instant::now();
    let r = (|| {
        let repo = state.open_repo()?;
        let key = compute_state_key(&repo)?;

        let cached_oids = state
            .graph_cache
            .lock()
            .unwrap()
            .as_ref()
            .filter(|c| c.key == key)
            .map(|c| c.oids.clone());

        // Rebuilding the oid list is the one expensive step (a full revwalk);
        // reuse it across pages as long as HEAD/refs haven't moved since it
        // was built, instead of re-walking history on every page request.
        let oids = match cached_oids {
            Some(oids) => oids,
            None => {
                let oids = list_all_oids(&repo)?;
                *state.graph_cache.lock().unwrap() = Some(GraphCache { key, oids: oids.clone() });
                oids
            }
        };

        page_from_oids(&repo, &oids, limit.clamp(1, 500), offset)
    })();
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

#[tauri::command]
pub async fn cmd_get_file_history(
    path: String,
    limit: usize,
    state: State<'_, AppState>,
) -> Result<Vec<FileHistoryEntry>, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; get_file_history(&repo, &path, limit.clamp(1, 500)) })();
    state.log_command("cmd_get_file_history", t, &r);
    r
}
