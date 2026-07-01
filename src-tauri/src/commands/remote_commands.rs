use tauri::State;
use serde::Deserialize;
use crate::{error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct RebaseStep {
    pub action: String,
    pub oid: String,
    pub message: String,
}

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

#[tauri::command]
pub async fn cmd_interactive_rebase(
    base: String,
    steps: Vec<RebaseStep>,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r: Result<String, AppError> = async {
        let path = state.repo_path.lock().unwrap().clone().ok_or(AppError::NoRepository)?;

        let todo_content = steps.iter()
            .map(|s| {
                let short = if s.oid.len() >= 7 { &s.oid[..7] } else { &s.oid };
                let first_line = s.message.lines().next().unwrap_or("");
                format!("{} {} {}", s.action, short, first_line)
            })
            .collect::<Vec<_>>()
            .join("\n");

        let todo_path = std::env::temp_dir().join("gitflow-rebase-todo");
        let script_path = std::env::temp_dir().join("gitflow-rebase-editor.sh");
        std::fs::write(&todo_path, &todo_content)?;
        let script = format!("#!/bin/sh\ncp '{}' \"$1\"\n", todo_path.display());
        std::fs::write(&script_path, &script)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&script_path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&script_path, perms)?;
        }

        let out = tokio::process::Command::new("git")
            .args(["rebase", "-i", &base])
            .env("GIT_SEQUENCE_EDITOR", script_path.to_str().unwrap_or(""))
            .current_dir(&path)
            .output()
            .await
            .map_err(|e| AppError::Other(format!("git not found: {e}")))?;

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            Err(AppError::Other(String::from_utf8_lossy(&out.stderr).to_string()))
        }
    }.await;
    state.log_command("cmd_interactive_rebase", t, &r);
    r
}
