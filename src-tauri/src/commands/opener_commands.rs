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
        else { Err(AppError::Other(truncate_stderr(&String::from_utf8_lossy(&out.stderr)))) }
    }.await;
    state.log_command("cmd_open_in_vscode", t, &r);
    r
}

#[cfg(target_os = "macos")]
fn reveal_in_finder(full: &std::path::Path) -> std::process::Output {
    let args: Vec<&str> = if full.is_dir() {
        vec![full.to_str().unwrap_or("")]
    } else {
        vec!["-R", full.to_str().unwrap_or("")]
    };
    std::process::Command::new("open")
        .args(&args)
        .output()
        .expect("open failed")
}

#[cfg(target_os = "linux")]
fn reveal_in_finder(full: &std::path::Path) -> std::process::Output {
    let parent = full.parent().unwrap_or(full);
    std::process::Command::new("xdg-open")
        .arg(parent.to_str().unwrap_or(""))
        .output()
        .expect("xdg-open failed")
}

#[cfg(target_os = "windows")]
fn reveal_in_finder(full: &std::path::Path) -> std::process::Output {
    std::process::Command::new("explorer")
        .args(["/select,", full.to_str().unwrap_or("")])
        .output()
        .expect("explorer failed")
}

#[tauri::command]
pub async fn cmd_reveal_in_finder(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let base = repo_path(&state)?;
    let full = if path.is_empty() { base.clone() } else { base.join(&path) };
    let r: Result<(), AppError> = async {
        // Use spawn_blocking since std::process::Command is sync
        let full_clone = full.clone();
        let out = tokio::task::spawn_blocking(move || reveal_in_finder(&full_clone))
            .await
            .map_err(|e| AppError::Other(format!("Task failed: {e}")))?;
        if out.status.success() { Ok(()) }
        else { Err(AppError::Other("Failed to reveal in file manager".into())) }
    }.await;
    state.log_command("cmd_reveal_in_finder", t, &r);
    r
}

#[cfg(target_os = "macos")]
fn open_terminal(dir: &std::path::Path) -> std::process::Output {
    std::process::Command::new("open")
        .args(["-a", "Terminal", dir.to_str().unwrap_or("")])
        .output()
        .expect("open failed")
}

#[cfg(target_os = "linux")]
fn open_terminal(dir: &std::path::Path) -> std::process::Output {
    // Try common terminal emulators
    for term in &["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"] {
        if let Ok(out) = std::process::Command::new(term)
            .arg("--working-directory")
            .arg(dir.to_str().unwrap_or(""))
            .output()
        {
            if out.status.success() {
                return out;
            }
        }
    }
    std::process::Command::new("xterm")
        .args(["-e", "cd", dir.to_str().unwrap_or(""), ";", "bash"])
        .output()
        .expect("xterm invocation failed")
}

#[cfg(target_os = "windows")]
fn open_terminal(dir: &std::path::Path) -> std::process::Output {
    std::process::Command::new("cmd")
        .args(["/C", "start", "cmd", "/K", &format!("cd /d {}", dir.to_str().unwrap_or(""))])
        .output()
        .expect("cmd failed")
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
        let dir_clone = dir.clone();
        let out = tokio::task::spawn_blocking(move || open_terminal(&dir_clone))
            .await
            .map_err(|e| AppError::Other(format!("Task failed: {e}")))?;
        if out.status.success() { Ok(()) }
        else { Err(AppError::Other("Failed to open terminal".into())) }
    }.await;
    state.log_command("cmd_open_in_terminal", t, &r);
    r
}

fn truncate_stderr(stderr: &str) -> String {
    stderr.lines().next().unwrap_or(stderr).to_string()
}
