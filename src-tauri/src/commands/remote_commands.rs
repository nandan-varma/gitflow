use tauri::State;
use crate::{error::AppError, state::AppState};

async fn run_git(args: &[&str], state: &AppState) -> Result<String, AppError> {
    let path = state.repo_path.lock().unwrap().clone().ok_or(AppError::NoRepository)?;
    let out = tokio::process::Command::new("git")
        .args(args)
        .current_dir(&path)
        .output()
        .await
        .map_err(|e| AppError::Other(format!("git not found: {e}")))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(AppError::Other(String::from_utf8_lossy(&out.stderr).to_string()))
    }
}

#[tauri::command]
pub async fn cmd_git_fetch(state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = run_git(&["fetch", "--prune"], &state).await;
    state.log_command("cmd_git_fetch", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_git_push(
    branch: String,
    set_upstream: bool,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = if set_upstream {
        run_git(&["push", "--set-upstream", "origin", &branch], &state).await
    } else {
        run_git(&["push"], &state).await
    };
    state.log_command("cmd_git_push", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_git_pull(rebase: bool, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let args: &[&str] = if rebase { &["pull", "--rebase"] } else { &["pull"] };
    let r = run_git(args, &state).await;
    state.log_command("cmd_git_pull", t, &r);
    r
}
