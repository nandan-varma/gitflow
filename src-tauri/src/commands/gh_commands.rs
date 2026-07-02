use tauri::State;
use crate::{error::AppError, state::AppState};

async fn run_gh(args: &[&str], state: &AppState) -> Result<String, AppError> {
    let path = state.repo_path.lock().unwrap().clone().ok_or(AppError::NoRepository)?;
    let out = tokio::process::Command::new("gh")
        .args(args)
        .current_dir(&path)
        .output()
        .await
        .map_err(|e| AppError::Other(format!("gh CLI not found: {e}")))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(AppError::Other(crate::commands::remote_commands::truncate_stderr(&String::from_utf8_lossy(&out.stderr))))
    }
}

#[tauri::command]
pub async fn cmd_gh_pr_list(pr_state: String, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = run_gh(&[
        "pr", "list",
        "--state", &pr_state,
        "--json", "number,title,state,headRefName,baseRefName,author,reviewDecision,isDraft,createdAt,url,statusCheckRollup",
        "--limit", "100",
    ], &state).await;
    state.log_command("cmd_gh_pr_list", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_pr_view(number: u64, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let num_str = number.to_string();
    let r = run_gh(&[
        "pr", "view", &num_str,
        "--json", "number,title,body,state,headRefName,baseRefName,author,reviewDecision,isDraft,createdAt,url,additions,deletions,changedFiles,latestReviews,mergeable,mergeStateStatus,labels",
    ], &state).await;
    state.log_command("cmd_gh_pr_view", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_pr_create(
    title: String,
    body: String,
    base: String,
    draft: bool,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let mut args = vec!["pr", "create", "--title", &title, "--body", &body, "--base", &base];
    if draft { args.push("--draft"); }
    let r = run_gh(&args, &state).await;
    state.log_command("cmd_gh_pr_create", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_pr_checkout(number: u64, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let num_str = number.to_string();
    let r = run_gh(&["pr", "checkout", &num_str], &state).await.map(|_| ());
    state.log_command("cmd_gh_pr_checkout", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_pr_open(number: u64, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let num_str = number.to_string();
    let r = run_gh(&["pr", "view", &num_str, "--web"], &state).await.map(|_| ());
    state.log_command("cmd_gh_pr_open", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_pr_merge(
    number: u64,
    strategy: String,
    delete_branch: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    if !matches!(strategy.as_str(), "merge" | "squash" | "rebase") {
        let r = Err(AppError::InvalidArgument(format!("Invalid merge strategy: {strategy}")));
        state.log_command("cmd_gh_pr_merge", t, &r);
        return r;
    }
    let num_str = number.to_string();
    let flag = format!("--{}", strategy);
    let mut args = vec!["pr", "merge", &num_str, &flag];
    if delete_branch { args.push("--delete-branch"); }
    let r = run_gh(&args, &state).await.map(|_| ());
    state.log_command("cmd_gh_pr_merge", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_issue_list(issue_state: String, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = run_gh(&[
        "issue", "list",
        "--state", &issue_state,
        "--json", "number,title,state,author,labels,assignees,createdAt,url,comments",
        "--limit", "100",
    ], &state).await;
    state.log_command("cmd_gh_issue_list", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_issue_view(number: u64, state: State<'_, AppState>) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let num_str = number.to_string();
    let r = run_gh(&[
        "issue", "view", &num_str,
        "--json", "number,title,body,state,author,labels,assignees,createdAt,url",
    ], &state).await;
    state.log_command("cmd_gh_issue_view", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_issue_open(number: u64, state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let num_str = number.to_string();
    let r = run_gh(&["issue", "view", &num_str, "--web"], &state).await.map(|_| ());
    state.log_command("cmd_gh_issue_open", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_gh_issue_create_web(state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = run_gh(&["issue", "create", "--web"], &state).await.map(|_| ());
    state.log_command("cmd_gh_issue_create_web", t, &r);
    r
}
