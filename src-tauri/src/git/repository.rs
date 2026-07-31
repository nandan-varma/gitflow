use std::path::{Path, PathBuf};
use serde::Serialize;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct TagEntry {
    pub name: String,
    pub target_oid: String,
    pub is_annotated: bool,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RepoInfo {
    pub path: String,
    pub head_branch: Option<String>,
    pub head_oid: Option<String>,
    pub is_bare: bool,
    pub is_empty: bool,
    pub state: String,
}

pub fn open_repo(path: &str) -> Result<(git2::Repository, String), AppError> {
    let repo = git2::Repository::discover(path)
        .map_err(|_| AppError::Git(format!("No git repository found at or above {path}")))?;
    let workdir = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .unwrap()
        .to_string_lossy()
        .to_string();
    Ok((repo, workdir))
}

pub fn get_repo_info(repo: &git2::Repository) -> Result<RepoInfo, AppError> {
    let path = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .unwrap()
        .to_string_lossy()
        .to_string();

    let (head_branch, head_oid) = match repo.head() {
        Ok(head) => {
            let oid = head.target().map(|o| o.to_string());
            let branch = if head.is_branch() {
                head.shorthand().map(|s| s.to_string())
            } else {
                oid.as_deref().map(|s| &s[..8]).map(|s| format!("(detached) {s}"))
            };
            (branch, oid)
        }
        Err(_) => (None, None),
    };

    let state = match repo.state() {
        git2::RepositoryState::Clean => "clean",
        git2::RepositoryState::Merge => "merge",
        git2::RepositoryState::Revert | git2::RepositoryState::RevertSequence => "revert",
        git2::RepositoryState::CherryPick | git2::RepositoryState::CherryPickSequence => "cherry-pick",
        git2::RepositoryState::Bisect => "bisect",
        git2::RepositoryState::Rebase
        | git2::RepositoryState::RebaseInteractive
        | git2::RepositoryState::RebaseMerge => "rebase",
        git2::RepositoryState::ApplyMailbox | git2::RepositoryState::ApplyMailboxOrRebase => "am",
    };

    Ok(RepoInfo {
        path,
        head_branch,
        head_oid,
        is_bare: repo.is_bare(),
        is_empty: repo.is_empty().unwrap_or(false),
        state: state.to_string(),
    })
}

/// Resolve a repo-relative path against `base` and verify it stays inside
/// `base` (rejects `..` traversal and absolute-path overrides). Both sides
/// are canonicalized, so `user_path` must name an existing file or directory.
pub fn resolve_within_workdir(base: &Path, user_path: &str) -> Result<PathBuf, AppError> {
    let base = base
        .canonicalize()
        .map_err(|_| AppError::Other("Repository path missing".into()))?;
    let joined = if user_path.is_empty() { base.clone() } else { base.join(user_path) };
    let canonical = joined
        .canonicalize()
        .map_err(|_| AppError::InvalidArgument(format!("Path does not exist: {user_path}")))?;
    if !canonical.starts_with(&base) {
        return Err(AppError::InvalidArgument("Path is outside repository".into()));
    }
    Ok(canonical)
}

pub fn list_tags(repo: &git2::Repository) -> Result<Vec<TagEntry>, AppError> {
    let mut tags = Vec::new();
    repo.tag_foreach(|oid, name| {
        let name = std::str::from_utf8(name)
            .unwrap_or("")
            .trim_start_matches("refs/tags/")
            .to_string();
        let (is_annotated, message, target_oid) = if let Ok(tag) = repo.find_tag(oid) {
            let peeled = tag.target().ok().map(|t| t.id()).unwrap_or(oid);
            (true, tag.message().map(|m| m.trim().to_string()), peeled.to_string())
        } else {
            (false, None, oid.to_string())
        };
        tags.push(TagEntry { name, target_oid, is_annotated, message });
        true
    })?;
    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn tmp_dir() -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("resolve_within_workdir_{}", n))
    }

    #[test]
    fn rejects_parent_traversal() {
        let dir = tmp_dir();
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let result = resolve_within_workdir(&dir, "../outside");
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_traversal_to_existing_sibling_file() {
        // Same shape of attack as `../outside`, but against a path that actually
        // exists — the case `get_conflict_detail`/`resolve_conflict` need covered,
        // since canonicalize() only succeeds on real paths.
        let parent = tmp_dir();
        let _ = fs::remove_dir_all(&parent);
        let base = parent.join("repo");
        let sibling = parent.join("secret.txt");
        fs::create_dir_all(&base).unwrap();
        fs::write(&sibling, "top secret").unwrap();
        let result = resolve_within_workdir(&base, "../secret.txt");
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&parent);
    }

    #[test]
    fn accepts_inner_file() {
        let dir = tmp_dir();
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let inner = dir.join("foo.txt");
        fs::write(&inner, "hi").unwrap();
        let result = resolve_within_workdir(&dir, "foo.txt");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), inner.canonicalize().unwrap());
        let _ = fs::remove_dir_all(&dir);
    }
}
