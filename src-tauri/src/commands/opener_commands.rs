use std::path::Path;
use tauri::State;
use crate::{error::AppError, state::AppState, commands::remote_commands::truncate_stderr};

fn repo_path(state: &AppState) -> Result<std::path::PathBuf, AppError> {
    state.repo_path.lock().unwrap().clone().ok_or(AppError::NoRepository)
}

fn resolve_path(base: &Path, user_path: &str) -> Result<std::path::PathBuf, AppError> {
    let base = base.canonicalize().map_err(|_| AppError::Other("Repository path missing".into()))?;
    let joined = if user_path.is_empty() {
        base.clone()
    } else {
        base.join(user_path)
    };
    let canonical = joined.canonicalize().map_err(|_| {
        AppError::InvalidArgument(format!("Path does not exist: {user_path}"))
    })?;
    if !canonical.starts_with(&base) {
        return Err(AppError::InvalidArgument("Path is outside repository".into()));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn tmp_dir() -> std::path::PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("opener_resolve_{}", n))
    }

    #[test]
    fn rejects_parent_traversal() {
        let dir = tmp_dir();
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let result = resolve_path(&dir, "../outside");
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn accepts_inner_file() {
        let dir = tmp_dir();
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let inner = dir.join("foo.txt");
        fs::write(&inner, "hi").unwrap();
        let result = resolve_path(&dir, "foo.txt");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), inner.canonicalize().unwrap());
        let _ = fs::remove_dir_all(&dir);
    }
}

#[tauri::command]
pub async fn cmd_open_in_vscode(path: String, editor_cmd: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let base = repo_path(&state)?;
    let full = resolve_path(&base, &path)?;
    let cmd = if editor_cmd.is_empty() { "code".to_string() } else { editor_cmd };
    let r: Result<(), AppError> = async {
        let out = tokio::process::Command::new(&cmd)
            .arg(&full)
            .output()
            .await
            .map_err(|e| AppError::Other(format!("Editor '{cmd}' not found: {e}")))?;
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
    let full = resolve_path(&base, &path)?;
    let r: Result<(), AppError> = async {
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
fn open_terminal(dir: &std::path::Path, terminal_app: &str) -> std::process::Output {
    let app = if terminal_app.is_empty() { "Terminal" } else { terminal_app };
    std::process::Command::new("open")
        .args(["-a", app, dir.to_str().unwrap_or("")])
        .output()
        .expect("open failed")
}

#[cfg(target_os = "linux")]
fn open_terminal(dir: &std::path::Path, _terminal_app: &str) -> std::process::Output {
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
fn open_terminal(dir: &std::path::Path, _terminal_app: &str) -> std::process::Output {
    std::process::Command::new("cmd")
        .args(["/C", "start", "cmd", "/K", &format!("cd /d {}", dir.to_str().unwrap_or(""))])
        .output()
        .expect("cmd failed")
}

#[tauri::command]
pub async fn cmd_open_in_terminal(path: String, terminal_app: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let base = repo_path(&state)?;
    let resolved = resolve_path(&base, &path)?;
    let dir = if resolved.is_dir() {
        resolved
    } else {
        resolved.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| base.clone())
    };
    let r: Result<(), AppError> = async {
        let dir_clone = dir.clone();
        let out = tokio::task::spawn_blocking(move || open_terminal(&dir_clone, &terminal_app))
            .await
            .map_err(|e| AppError::Other(format!("Task failed: {e}")))?;
        if out.status.success() { Ok(()) }
        else { Err(AppError::Other("Failed to open terminal".into())) }
    }.await;
    state.log_command("cmd_open_in_terminal", t, &r);
    r
}


