use tauri::State;
use serde::Deserialize;
use crate::{error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct RebaseStep {
    pub action: String,
    pub oid: String,
    pub message: String,
}

pub fn truncate_stderr(stderr: &str) -> String {
    stderr.lines().next().unwrap_or(stderr).to_string()
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
        Err(AppError::Other(truncate_stderr(&String::from_utf8_lossy(&out.stderr))))
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

        let valid_actions = ["pick", "reword", "edit", "squash", "fixup", "exec", "break", "drop", "label", "reset", "merge"];
        for s in &steps {
            if !valid_actions.contains(&s.action.as_str()) {
                return Err(AppError::InvalidArgument(format!("Invalid rebase action: {}", s.action)));
            }
        }

        let todo_content = steps.iter()
            .map(|s| {
                let short = if s.oid.len() >= 7 { &s.oid[..7] } else { &s.oid };
                let first_line = s.message.lines().next().unwrap_or("");
                format!("{} {} {}", s.action, short, first_line)
            })
            .collect::<Vec<_>>()
            .join("\n");

        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();

        let todo_path = std::env::temp_dir().join(format!("gitflow-rebase-todo-{unique}"));
        let script_path = std::env::temp_dir().join(format!("gitflow-rebase-editor-{unique}.sh"));
        std::fs::write(&todo_path, &todo_content)?;
        // Pass path via env var to avoid shell injection through file path embedding
        let script = "#!/bin/sh\ncp -- \"${GITFLOW_TODO_FILE:?}\" \"$1\"\n";
        std::fs::write(&script_path, script)?;

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
            .env("GITFLOW_TODO_FILE", &todo_path)
            .current_dir(&path)
            .output()
            .await
            .map_err(|e| AppError::Other(format!("git not found: {e}")))?;

        // Clean up temp files regardless of outcome
        let _ = std::fs::remove_file(&todo_path);
        let _ = std::fs::remove_file(&script_path);

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            Err(AppError::Other(truncate_stderr(&String::from_utf8_lossy(&out.stderr))))
        }
    }.await;
    state.log_command("cmd_interactive_rebase", t, &r);
    r
}
