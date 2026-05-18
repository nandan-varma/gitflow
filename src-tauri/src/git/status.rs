use serde::Serialize;
use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub conflict: bool,
}

pub fn get_status(repo: &git2::Repository) -> Result<Vec<FileStatus>, AppError> {
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .renames_from_rewrites(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut result = Vec::new();

    for entry in statuses.iter() {
        let flags = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        if flags.is_empty() {
            continue;
        }

        let conflict = flags.intersects(
            git2::Status::CONFLICTED
        );

        let staged = flags.intersects(
            git2::Status::INDEX_NEW
                | git2::Status::INDEX_MODIFIED
                | git2::Status::INDEX_DELETED
                | git2::Status::INDEX_RENAMED
                | git2::Status::INDEX_TYPECHANGE,
        );

        let unstaged = flags.intersects(
            git2::Status::WT_MODIFIED
                | git2::Status::WT_DELETED
                | git2::Status::WT_RENAMED
                | git2::Status::WT_TYPECHANGE
                | git2::Status::WT_NEW,
        );

        let status_str = if conflict {
            "conflict"
        } else if flags.contains(git2::Status::INDEX_NEW) || flags.contains(git2::Status::WT_NEW) {
            "added"
        } else if flags.intersects(git2::Status::INDEX_DELETED | git2::Status::WT_DELETED) {
            "deleted"
        } else if flags.intersects(git2::Status::INDEX_RENAMED | git2::Status::WT_RENAMED) {
            "renamed"
        } else {
            "modified"
        };

        let old_path = entry.head_to_index().and_then(|d| {
            d.old_file().path().map(|p| p.to_string_lossy().to_string())
        }).filter(|p| p != &path);

        result.push(FileStatus {
            path,
            old_path,
            status: status_str.to_string(),
            staged,
            unstaged,
            conflict,
        });
    }

    Ok(result)
}

