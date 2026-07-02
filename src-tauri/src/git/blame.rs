use serde::Serialize;
use std::collections::HashMap;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct BlameLine {
    pub line_no: u32,
    pub content: String,
    pub oid: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub summary: String,
}

pub fn get_blame(repo: &git2::Repository, path: &str) -> Result<Vec<BlameLine>, AppError> {
    let p = std::path::Path::new(path);
    let blame = repo.blame_file(p, None)?;
    let head_tree = repo.head()?.peel_to_tree()?;
    let entry = head_tree
        .get_path(p)
        .map_err(|_| AppError::InvalidArgument(format!("{path} is not tracked in HEAD")))?;
    let blob = repo.find_blob(entry.id())?;
    let content = std::str::from_utf8(blob.content())
        .map_err(|_| AppError::Other("File is not valid UTF-8 text".into()))?
        .to_string();

    let mut summary_cache: HashMap<String, String> = HashMap::new();
    let mut lines = Vec::new();

    for (i, line_content) in content.lines().enumerate() {
        let line_no = (i + 1) as u32;
        if let Some(hunk) = blame.get_line(line_no as usize) {
            let commit_id = hunk.final_commit_id();
            let oid = commit_id.to_string();
            let sig = hunk.final_signature();

            let summary = summary_cache
                .entry(oid.clone())
                .or_insert_with(|| {
                    repo.find_commit(commit_id)
                        .map(|c| c.summary().unwrap_or("").to_string())
                        .unwrap_or_default()
                })
                .clone();

            lines.push(BlameLine {
                line_no,
                content: line_content.to_string(),
                oid,
                author_name: sig.name().unwrap_or("").to_string(),
                author_email: sig.email().unwrap_or("").to_string(),
                timestamp: sig.when().seconds(),
                summary,
            });
        }
    }

    Ok(lines)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn init_repo() -> git2::Repository {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!("test_blame_{}_{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let repo = git2::Repository::init(&tmp).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
        repo
    }

    fn commit_file(repo: &git2::Repository, name: &str, content: &str, msg: &str) {
        let workdir = repo.workdir().unwrap();
        std::fs::write(workdir.join(name), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new(name)).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let sig = repo.signature().unwrap();
        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents).unwrap();
    }

    fn cleanup(repo: git2::Repository) {
        let path = repo.path().parent().unwrap().to_path_buf();
        drop(repo);
        let _ = std::fs::remove_dir_all(&path);
    }

    #[test]
    fn blame_matches_head_not_workdir() {
        let repo = init_repo();
        // Commit a 3-line file
        commit_file(&repo, "f.txt", "line1\nline2\nline3\n", "initial");
        // Modify the workdir copy (prepend 2 lines, do not commit)
        std::fs::write(repo.workdir().unwrap().join("f.txt"), "pre1\npre2\nline1\nline2\nline3\n").unwrap();
        let blame = get_blame(&repo, "f.txt").unwrap();
        // Must blame 3 lines (HEAD content), not 5 (workdir content)
        assert_eq!(blame.len(), 3);
        assert_eq!(blame[0].content, "line1");
        assert_eq!(blame[1].content, "line2");
        assert_eq!(blame[2].content, "line3");
        cleanup(repo);
    }

    #[test]
    fn blame_untracked_path_errors() {
        let repo = init_repo();
        commit_file(&repo, "a.txt", "hello\n", "initial");
        let err = get_blame(&repo, "nope.txt");
        assert!(err.is_err(), "expected error for untracked path");
        cleanup(repo);
    }
}
