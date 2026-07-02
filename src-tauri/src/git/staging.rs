use crate::{error::AppError, git::diff::DiffLine};

pub type HunkLine = DiffLine;

/// Stage one path into an already-open index (no write). Deleted files are
/// staged as removals — add_path errors on missing workdir files.
fn stage_in_index(repo: &git2::Repository, index: &mut git2::Index, path: &str) -> Result<(), AppError> {
    let p = std::path::Path::new(path);
    let workdir = repo.workdir().ok_or_else(|| AppError::Other("Bare repository".into()))?;
    if workdir.join(p).exists() {
        index.add_path(p)?;
    } else {
        index.remove_path(p)?;
    }
    Ok(())
}

fn unstage_in_index(repo: &git2::Repository, index: &mut git2::Index, path: &str) -> Result<(), AppError> {
    let p = std::path::Path::new(path);

    // Find the HEAD tree entry for this path (None if new file or no HEAD).
    let head_entry = repo
        .head().ok()
        .and_then(|h| h.peel_to_tree().ok())
        .and_then(|tree| tree.get_path(p).ok());

    match head_entry {
        Some(entry) => {
            // File exists in HEAD: restore index entry to the HEAD version.
            let ie = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0, ino: 0, mode: entry.filemode() as u32,
                uid: 0, gid: 0, file_size: 0,
                id: entry.id(),
                flags: 0, flags_extended: 0,
                path: path.as_bytes().to_vec(),
            };
            index.add(&ie)?;
        }
        None => {
            // New file (not in HEAD): remove from index entirely.
            index.remove_path(p)?;
        }
    }
    Ok(())
}

pub fn stage_file(repo: &git2::Repository, path: &str) -> Result<(), AppError> {
    let mut index = repo.index()?;
    stage_in_index(repo, &mut index, path)?;
    index.write()?;
    Ok(())
}

/// Batch variant: one index open, one write — avoids the index.lock races that
/// concurrent per-file invokes caused.
pub fn stage_files(repo: &git2::Repository, paths: &[String]) -> Result<(), AppError> {
    let mut index = repo.index()?;
    for path in paths {
        stage_in_index(repo, &mut index, path)?;
    }
    index.write()?;
    Ok(())
}

pub fn unstage_file(repo: &git2::Repository, path: &str) -> Result<(), AppError> {
    let mut index = repo.index()?;
    unstage_in_index(repo, &mut index, path)?;
    index.write()?;
    Ok(())
}

pub fn unstage_files(repo: &git2::Repository, paths: &[String]) -> Result<(), AppError> {
    let mut index = repo.index()?;
    for path in paths {
        unstage_in_index(repo, &mut index, path)?;
    }
    index.write()?;
    Ok(())
}

pub fn stage_hunk(
    repo: &git2::Repository,
    path: &str,
    lines: &[HunkLine],
) -> Result<(), AppError> {
    let patch = build_patch(path, lines);
    apply_patch_to_index(repo, &patch)
}

pub fn unstage_hunk(
    repo: &git2::Repository,
    path: &str,
    lines: &[HunkLine],
) -> Result<(), AppError> {
    // Reverse the lines to unapply from index
    let reversed: Vec<HunkLine> = lines
        .iter()
        .map(|l| HunkLine {
            origin: match l.origin {
                '+' => '-',
                '-' => '+',
                c => c,
            },
            content: l.content.clone(),
            old_lineno: l.new_lineno,
            new_lineno: l.old_lineno,
        })
        .collect();
    let patch = build_patch(path, &reversed);
    apply_patch_to_index(repo, &patch)
}

pub fn discard_changes(repo: &git2::Repository, path: &str) -> Result<(), AppError> {
    let p = std::path::Path::new(path);
    // Untracked file: checkout_index is a silent no-op, so delete it instead.
    let in_index = repo.index()?.get_path(p, 0).is_some();
    let in_head = repo.head().ok()
        .and_then(|h| h.peel_to_tree().ok())
        .map(|t| t.get_path(p).is_ok())
        .unwrap_or(false);
    if !in_index && !in_head {
        let workdir = repo.workdir().ok_or_else(|| AppError::Other("Bare repository".into()))?;
        std::fs::remove_file(workdir.join(p))?;
        return Ok(());
    }
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.path(path).force();
    repo.checkout_index(None, Some(&mut checkout))?;
    Ok(())
}

pub fn discard_lines(repo: &git2::Repository, path: &str, lines: &[HunkLine]) -> Result<(), AppError> {
    // Frontend pre-processes lines (reverses selected change lines to apply as workdir patch)
    let patch = build_patch(path, lines);
    let diff = git2::Diff::from_buffer(patch.as_bytes())?;
    repo.apply(&diff, git2::ApplyLocation::WorkDir, None)?;
    Ok(())
}

fn build_patch(path: &str, lines: &[HunkLine]) -> String {
    let additions: i32 = lines.iter().filter(|l| l.origin == '+').count() as i32;
    let deletions: i32 = lines.iter().filter(|l| l.origin == '-').count() as i32;
    let context: i32 = lines.iter().filter(|l| l.origin == ' ').count() as i32;

    let old_start = lines.iter().find_map(|l| l.old_lineno).unwrap_or(1);
    let new_start = lines.iter().find_map(|l| l.new_lineno).unwrap_or(1);
    let old_count = deletions + context;
    let new_count = additions + context;

    let mut patch = String::new();
    patch.push_str(&format!("diff --git a/{path} b/{path}\n"));
    patch.push_str(&format!("--- a/{path}\n"));
    patch.push_str(&format!("+++ b/{path}\n"));
    patch.push_str(&format!(
        "@@ -{old_start},{old_count} +{new_start},{new_count} @@\n"
    ));
    for line in lines {
        patch.push(line.origin);
        patch.push_str(&line.content);
        if !line.content.ends_with('\n') {
            patch.push('\n');
        }
    }
    patch
}

fn apply_patch_to_index(repo: &git2::Repository, patch: &str) -> Result<(), AppError> {
    let diff = git2::Diff::from_buffer(patch.as_bytes())?;
    repo.apply(&diff, git2::ApplyLocation::Index, None)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn init_repo() -> git2::Repository {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!("test_staging_{}_{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let repo = git2::Repository::init(&tmp).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
        repo
    }

    fn commit_file(repo: &git2::Repository, name: &str, content: &str) {
        std::fs::write(repo.workdir().unwrap().join(name), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new(name)).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let sig = repo.signature().unwrap();
        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, "commit", &tree, &parents).unwrap();
    }

    fn cleanup(repo: git2::Repository) {
        let path = repo.path().parent().unwrap().to_path_buf();
        drop(repo);
        let _ = std::fs::remove_dir_all(&path);
    }

    #[test]
    fn stage_deleted_file() {
        let repo = init_repo();
        commit_file(&repo, "a.txt", "a\n");
        std::fs::remove_file(repo.workdir().unwrap().join("a.txt")).unwrap();
        stage_file(&repo, "a.txt").unwrap();
        {
            let statuses = repo.statuses(None).unwrap();
            let entry = statuses.iter().find(|e| e.path() == Some("a.txt")).unwrap();
            assert!(entry.status().contains(git2::Status::INDEX_DELETED));
        }
        cleanup(repo);
    }

    #[test]
    fn stage_files_batch() {
        let repo = init_repo();
        commit_file(&repo, "a.txt", "a\n");
        for name in ["a.txt", "b.txt", "c.txt"] {
            std::fs::write(repo.workdir().unwrap().join(name), "changed\n").unwrap();
        }
        stage_files(&repo, &["a.txt".into(), "b.txt".into(), "c.txt".into()]).unwrap();
        let index = repo.index().unwrap();
        for name in ["a.txt", "b.txt", "c.txt"] {
            assert!(index.get_path(std::path::Path::new(name), 0).is_some(), "{name} not staged");
        }
        cleanup(repo);
    }

    #[test]
    fn discard_untracked_removes_file() {
        let repo = init_repo();
        commit_file(&repo, "a.txt", "a\n");
        let untracked = repo.workdir().unwrap().join("new.txt");
        std::fs::write(&untracked, "temp\n").unwrap();
        discard_changes(&repo, "new.txt").unwrap();
        assert!(!untracked.exists());
        cleanup(repo);
    }

    #[test]
    fn discard_modified_restores_content() {
        let repo = init_repo();
        commit_file(&repo, "a.txt", "original\n");
        let path = repo.workdir().unwrap().join("a.txt");
        std::fs::write(&path, "modified\n").unwrap();
        discard_changes(&repo, "a.txt").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "original\n");
        cleanup(repo);
    }
}
