use tauri::State;
use crate::{error::AppError, state::AppState};

fn repo_path(state: &AppState) -> Result<std::path::PathBuf, AppError> {
    state.repo_path.lock().unwrap().clone().ok_or(AppError::NoRepository)
}

#[tauri::command]
pub async fn cmd_open_in_vscode(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let base = repo_path(&state)?;
    let full = if path.is_empty() { base.clone() } else { base.join(&path) };
    let r: Result<(), AppError> = async {
        let out = tokio::process::Command::new("code")
            .arg(&full)
            .output()
            .await
            .map_err(|e| AppError::Other(format!("VS Code CLI not found: {e}")))?;
        if out.status.success() { Ok(()) }
        else { Err(AppError::Other(String::from_utf8_lossy(&out.stderr).to_string())) }
    }.await;
    state.log_command("cmd_open_in_vscode", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_reveal_in_finder(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let base = repo_path(&state)?;
    let full = if path.is_empty() { base.clone() } else { base.join(&path) };
    let r: Result<(), AppError> = async {
        // -R reveals the item in its parent folder; for directories just open
        let args: Vec<&str> = if full.is_dir() {
            vec![full.to_str().unwrap_or("")]
        } else {
            vec!["-R", full.to_str().unwrap_or("")]
        };
        let out = tokio::process::Command::new("open")
            .args(&args)
            .output()
            .await
            .map_err(|e| AppError::Other(format!("open failed: {e}")))?;
        if out.status.success() { Ok(()) }
        else { Err(AppError::Other(String::from_utf8_lossy(&out.stderr).to_string())) }
    }.await;
    state.log_command("cmd_reveal_in_finder", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_open_in_terminal(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let base = repo_path(&state)?;
    let dir = if path.is_empty() {
        base.clone()
    } else {
        let full = base.join(&path);
        if full.is_dir() { full } else { full.parent().map(|p| p.to_path_buf()).unwrap_or(base) }
    };
    let r: Result<(), AppError> = async {
        // ponytail: hard-codes Terminal.app — add iTerm2/Warp preference to settingsStore if requested
        let out = tokio::process::Command::new("open")
            .args(["-a", "Terminal", dir.to_str().unwrap_or("")])
            .output()
            .await
            .map_err(|e| AppError::Other(format!("open failed: {e}")))?;
        if out.status.success() { Ok(()) }
        else { Err(AppError::Other(String::from_utf8_lossy(&out.stderr).to_string())) }
    }.await;
    state.log_command("cmd_open_in_terminal", t, &r);
    r
}
