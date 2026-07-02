use tauri::State;
use serde::Deserialize;
use crate::{error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct RebaseStep {
    pub action: String,
    pub oid: String,
}

pub fn truncate_stderr(stderr: &str) -> String {
    let lines: Vec<&str> = stderr.lines().filter(|l| !l.is_empty()).collect();
    let joined = lines.iter().take(5).map(|l| l.to_string()).collect::<Vec<_>>().join("\n");
    if joined.len() > 500 {
        format!("{}…", joined.chars().take(500).collect::<String>())
    } else {
        joined
    }
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
    force: bool,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let mut args = vec!["push"];
    if set_upstream {
        args.extend(["--set-upstream", "origin", branch.as_str()]);
    } else {
        args.extend(["origin", branch.as_str()]);
    }
    if force { args.push("--force-with-lease"); }
    let r = run_git(&args, &state).await;
    state.log_command("cmd_git_push", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_delete_tag(name: String, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = run_git(&["tag", "-d", &name], &state).await;
    state.log_command("cmd_delete_tag", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_git_revert(oid: String, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = run_git(&["revert", "--no-commit", &oid], &state).await;
    state.log_command("cmd_git_revert", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_git_reset(oid: String, mode: String, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let mode_flag = match mode.as_str() {
        "soft" | "mixed" | "hard" => format!("--{mode}"),
        _ => return Err(AppError::InvalidArgument("mode must be soft, mixed, or hard".into())),
    };
    let r = run_git(&["reset", &mode_flag, &oid], &state).await;
    state.log_command("cmd_git_reset", t, &r);
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

pub(crate) fn build_rebase_todo(steps: &[RebaseStep]) -> Result<String, AppError> {
    for s in steps {
        if !matches!(s.action.as_str(), "pick" | "fixup" | "drop") {
            return Err(AppError::InvalidArgument(format!("Unsupported rebase action: {}", s.action)));
        }
        if s.oid.len() < 7 || !s.oid.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(AppError::InvalidArgument(format!("Invalid commit OID: {}", s.oid)));
        }
    }
    let lines: Vec<String> = steps.iter()
        .map(|s| {
            let short = &s.oid[..7];
            format!("{} {}", s.action, short)
        })
        .collect();
    Ok(lines.join("\n"))
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

        let todo_content = build_rebase_todo(&steps)?;

        let dir = tempfile::tempdir()?;
        let todo_path = dir.path().join("todo");
        let script_path = dir.path().join("editor.sh");
        std::fs::write(&todo_path, todo_content)?;
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
            .env("GIT_EDITOR", "true")
            .env("GITFLOW_TODO_FILE", &todo_path)
            .current_dir(&path)
            .output()
            .await
            .map_err(|e| AppError::Other(format!("git not found: {e}")))?;

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            Err(AppError::Other(truncate_stderr(&String::from_utf8_lossy(&out.stderr))))
        }
    }.await;
    state.log_command("cmd_interactive_rebase", t, &r);
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn todo_formats_pick_lines() {
        let steps = vec![
            RebaseStep { action: "pick".into(), oid: "a1b2c3d4e5f6".into() },
            RebaseStep { action: "fixup".into(), oid: "aabbccddee".into() },
        ];
        let todo = build_rebase_todo(&steps).unwrap();
        assert_eq!(todo, "pick a1b2c3d\nfixup aabbccd");
    }

    #[test]
    fn todo_rejects_bad_action() {
        let steps = vec![
            RebaseStep { action: "exec".into(), oid: "a1b2c3d4".into() },
        ];
        let err = build_rebase_todo(&steps).unwrap_err();
        assert!(matches!(err, AppError::InvalidArgument(_)));
        assert!(format!("{err}").contains("exec"));
    }

    #[test]
    fn todo_rejects_bad_oid() {
        let steps = vec![
            RebaseStep { action: "pick".into(), oid: "not-hex!".into() },
        ];
        let err = build_rebase_todo(&steps).unwrap_err();
        assert!(matches!(err, AppError::InvalidArgument(_)));
    }

    #[test]
    fn todo_rejects_short_oid() {
        let steps = vec![
            RebaseStep { action: "pick".into(), oid: "abc123".into() },
        ];
        let err = build_rebase_todo(&steps).unwrap_err();
        assert!(matches!(err, AppError::InvalidArgument(_)));
    }

    #[test]
    fn truncate_stderr_empty() {
        assert_eq!(truncate_stderr(""), "");
    }

    #[test]
    fn truncate_stderr_multiple_lines() {
        let input = "line1\n\nline2\nline3\nline4\nline5\nline6";
        let result = truncate_stderr(input);
        assert_eq!(result.lines().count(), 5);
        assert!(!result.contains("line6"));
    }

    #[test]
    fn truncate_stderr_short_lines_no_truncation() {
        let input = "error: something went wrong\n  at src/foo.rs:42";
        let result = truncate_stderr(input);
        assert!(result.len() <= 500);
        assert!(result.contains("error:"));
    }
}
