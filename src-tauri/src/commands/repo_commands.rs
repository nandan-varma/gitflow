use tauri::{AppHandle, Emitter, State};
use crate::{
    error::AppError,
    git::{
        repository::{get_repo_info, list_tags, open_repo, RepoInfo, TagEntry},
        status::{get_status, FileStatus},
    },
    state::AppState,
    watcher::start_watcher,
};

#[tauri::command]
pub async fn open_repository(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<RepoInfo, AppError> {
    let (repo, workdir) = open_repo(&path)?;
    let info = get_repo_info(&repo)?;

    let workdir_path = std::path::PathBuf::from(&workdir);
    state.set_repo_path(workdir_path.clone());

    let stop = start_watcher(app.clone(), workdir_path);
    state.set_watcher(stop);

    app.emit("repo-opened", &info).ok();
    Ok(info)
}

#[tauri::command]
pub async fn get_current_repo_info(state: State<'_, AppState>) -> Result<RepoInfo, AppError> {
    let repo = state.open_repo()?;
    get_repo_info(&repo)
}

#[tauri::command]
pub async fn cmd_get_status(state: State<'_, AppState>) -> Result<Vec<FileStatus>, AppError> {
    let repo = state.open_repo()?;
    get_status(&repo)
}

#[tauri::command]
pub async fn cmd_list_tags(state: State<'_, AppState>) -> Result<Vec<TagEntry>, AppError> {
    let repo = state.open_repo()?;
    list_tags(&repo)
}
