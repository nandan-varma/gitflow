mod error;
mod state;
mod git;
mod watcher;
mod commands;

use state::AppState;
use tauri::Emitter;
use commands::{
    repo_commands::{open_repository, get_current_repo_info, cmd_get_status, cmd_list_tags},
    graph_commands::{cmd_get_commit_graph, cmd_get_commit_detail},
    diff_commands::{cmd_get_diff_workdir, cmd_get_diff_staged, cmd_get_diff_commit},
    staging_commands::{cmd_stage_file, cmd_unstage_file, cmd_stage_hunk, cmd_unstage_hunk, cmd_discard_changes},
    commit_commands::{cmd_create_commit, cmd_amend_commit},
    branch_commands::{cmd_list_branches, cmd_create_branch, cmd_switch_branch, cmd_delete_branch, cmd_merge_branch, cmd_abort_merge, cmd_rebase_branch, cmd_continue_rebase, cmd_abort_rebase},
    stash_commands::{cmd_list_stashes, cmd_stash_push, cmd_stash_apply, cmd_stash_pop, cmd_stash_drop},
    conflict_commands::{cmd_get_conflicts, cmd_get_conflict_detail, cmd_resolve_conflict},
};

use tokio::sync::mpsc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (log_tx, mut log_rx) = mpsc::unbounded_channel::<state::app_state::CommandLogEntry>();
    let app_state = AppState::new(log_tx);

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            open_repository,
            get_current_repo_info,
            cmd_get_status,
            cmd_get_commit_graph,
            cmd_get_commit_detail,
            cmd_get_diff_workdir,
            cmd_get_diff_staged,
            cmd_get_diff_commit,
            cmd_stage_file,
            cmd_unstage_file,
            cmd_stage_hunk,
            cmd_unstage_hunk,
            cmd_discard_changes,
            cmd_create_commit,
            cmd_amend_commit,
            cmd_list_branches,
            cmd_create_branch,
            cmd_switch_branch,
            cmd_delete_branch,
            cmd_merge_branch,
            cmd_abort_merge,
            cmd_rebase_branch,
            cmd_continue_rebase,
            cmd_abort_rebase,
            cmd_list_tags,
            cmd_list_stashes,
            cmd_stash_push,
            cmd_stash_apply,
            cmd_stash_pop,
            cmd_stash_drop,
            cmd_get_conflicts,
            cmd_get_conflict_detail,
            cmd_resolve_conflict,
        ])
        .setup(|app| {
            // Forward command log entries to the frontend as Tauri events
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(entry) = log_rx.recv().await {
                    app_handle.emit("command-log", &entry).ok();
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
