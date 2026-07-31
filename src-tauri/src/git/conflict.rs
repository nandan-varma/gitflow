use serde::Serialize;
use std::path::Path;
use crate::{error::AppError, git::repository::resolve_within_workdir};

#[derive(Debug, Serialize)]
pub struct ConflictEntry {
    pub path: String,
    pub conflict_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ConflictDetail {
    pub path: String,
    pub ours: String,
    pub theirs: String,
    pub base: Option<String>,
    pub conflicts: Vec<ConflictBlock>,
    pub trailing_lines: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ConflictBlock {
    pub ours_lines: Vec<String>,
    pub theirs_lines: Vec<String>,
    pub before_lines: Vec<String>,
}

pub fn get_conflicts(repo: &git2::Repository) -> Result<Vec<ConflictEntry>, AppError> {
    let index = repo.index()?;
    if !index.has_conflicts() {
        return Ok(Vec::new());
    }

    let mut paths: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for conflict in index.conflicts()? {
        let conflict = conflict?;
        let path = conflict
            .our
            .or(conflict.their)
            .or(conflict.ancestor)
            .and_then(|e| {
                std::str::from_utf8(&e.path)
                    .ok()
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();
        *paths.entry(path).or_insert(0) += 1;
    }

    Ok(paths
        .into_iter()
        .map(|(path, conflict_count)| ConflictEntry { path, conflict_count })
        .collect())
}

/// Parse conflict markers out of file content. Returns the conflict blocks and
/// the lines after the last block (which must be preserved on resolve).
pub(crate) fn parse_conflicts(content: &str) -> (Vec<ConflictBlock>, Vec<String>) {
    #[derive(PartialEq)]
    enum State { Normal, Ours, Base, Theirs }
    let mut state = State::Normal;
    let mut conflicts: Vec<ConflictBlock> = Vec::new();
    let mut current_ours: Vec<String> = Vec::new();
    let mut current_theirs: Vec<String> = Vec::new();
    let mut current_before: Vec<String> = Vec::new();
    let mut before_buf: Vec<String> = Vec::new();

    for line in content.lines() {
        if (line.starts_with("<<<<<<< ") || line == "<<<<<<<") && state == State::Normal {
            state = State::Ours;
            current_before = std::mem::take(&mut before_buf);
        } else if (line.starts_with("||||||| ") || line == "|||||||") && state == State::Ours {
            // diff3 conflict style: base section, not shown in the two-pane editor
            state = State::Base;
        } else if line == "=======" && (state == State::Ours || state == State::Base) {
            state = State::Theirs;
        } else if (line.starts_with(">>>>>>> ") || line == ">>>>>>>") && state == State::Theirs {
            conflicts.push(ConflictBlock {
                ours_lines: std::mem::take(&mut current_ours),
                theirs_lines: std::mem::take(&mut current_theirs),
                before_lines: std::mem::take(&mut current_before),
            });
            state = State::Normal;
        } else {
            match state {
                State::Normal => before_buf.push(line.to_string()),
                State::Ours => current_ours.push(line.to_string()),
                State::Base => {}
                State::Theirs => current_theirs.push(line.to_string()),
            }
        }
    }

    (conflicts, before_buf)
}

pub fn get_conflict_detail(repo: &git2::Repository, path: &str) -> Result<ConflictDetail, AppError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::Other("Bare repository".into()))?;
    let full_path = resolve_within_workdir(workdir, path)?;
    let content = std::fs::read_to_string(&full_path)?;

    let (conflicts, trailing_lines) = parse_conflicts(&content);
    let ours: Vec<&str> = conflicts.iter().flat_map(|c| c.ours_lines.iter().map(String::as_str)).collect();
    let theirs: Vec<&str> = conflicts.iter().flat_map(|c| c.theirs_lines.iter().map(String::as_str)).collect();

    Ok(ConflictDetail {
        path: path.to_string(),
        ours: ours.join("\n"),
        theirs: theirs.join("\n"),
        base: None,
        conflicts,
        trailing_lines,
    })
}

pub fn resolve_conflict(
    repo: &git2::Repository,
    path: &str,
    resolution: &str,
) -> Result<(), AppError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::Other("Bare repository".into()))?;
    let full_path = resolve_within_workdir(workdir, path)?;
    // Text files end with a newline; the editor's textarea value doesn't.
    let mut resolution = resolution.to_string();
    if !resolution.is_empty() && !resolution.ends_with('\n') {
        resolution.push('\n');
    }
    std::fs::write(&full_path, resolution)?;

    // Stage the resolved file
    let mut index = repo.index()?;
    index.add_path(Path::new(path))?;
    index.write()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trailing_content_preserved() {
        let content = "top\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feat\nafter1\nafter2\nafter3\n";
        let (conflicts, trailing) = parse_conflicts(content);
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].before_lines, vec!["top"]);
        assert_eq!(trailing, vec!["after1", "after2", "after3"]);
    }

    #[test]
    fn diff3_base_section_excluded() {
        let content = "<<<<<<< ours\na\n||||||| base\nb\n=======\nc\n>>>>>>> theirs\n";
        let (conflicts, trailing) = parse_conflicts(content);
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].ours_lines, vec!["a"]);
        assert_eq!(conflicts[0].theirs_lines, vec!["c"]);
        assert!(trailing.is_empty());
    }

    #[test]
    fn multiple_blocks() {
        let content = "one\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> x\nmid\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> x\ntail\n";
        let (conflicts, trailing) = parse_conflicts(content);
        assert_eq!(conflicts.len(), 2);
        assert_eq!(conflicts[1].before_lines, vec!["mid"]);
        assert_eq!(conflicts[0].ours_lines, vec!["a"]);
        assert_eq!(conflicts[1].theirs_lines, vec!["d"]);
        assert_eq!(trailing, vec!["tail"]);
    }

    // Regression tests for the path-traversal fix: get_conflict_detail/resolve_conflict
    // must reject a `path` that escapes the repo workdir instead of joining it blindly.
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    /// Sets up `<tmp>/secret.txt` (outside the repo) and `<tmp>/repo` (a bare-bones
    /// git2 repo whose workdir is the traversal target's base).
    fn repo_with_outside_secret() -> (git2::Repository, std::path::PathBuf) {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let parent = std::env::temp_dir().join(format!("conflict_traversal_{}_{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&parent);
        let repo_dir = parent.join("repo");
        std::fs::create_dir_all(&repo_dir).unwrap();
        let secret = parent.join("secret.txt");
        std::fs::write(&secret, "top secret").unwrap();
        let repo = git2::Repository::init(&repo_dir).unwrap();
        (repo, secret)
    }

    #[test]
    fn get_conflict_detail_rejects_traversal() {
        let (repo, secret) = repo_with_outside_secret();
        let result = get_conflict_detail(&repo, "../secret.txt");
        assert!(matches!(result, Err(AppError::InvalidArgument(_))));
        let _ = std::fs::remove_dir_all(repo.workdir().unwrap().parent().unwrap());
        drop(secret);
    }

    #[test]
    fn resolve_conflict_rejects_traversal_and_does_not_write() {
        let (repo, secret) = repo_with_outside_secret();
        let result = resolve_conflict(&repo, "../secret.txt", "pwned");
        assert!(matches!(result, Err(AppError::InvalidArgument(_))));
        assert_eq!(std::fs::read_to_string(&secret).unwrap(), "top secret");
        let _ = std::fs::remove_dir_all(repo.workdir().unwrap().parent().unwrap());
    }
}
