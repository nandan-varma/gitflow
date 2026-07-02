use tauri::State;
use serde::Deserialize;
use crate::{
    error::AppError,
    git::cherry_pick::{self, CherryPickOutcome},
    state::AppState,
};

#[tauri::command]
pub async fn cmd_cherry_pick(oid: String, state: State<'_, AppState>) -> Result<CherryPickOutcome, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; cherry_pick::cherry_pick(&repo, &oid) })();
    state.log_command("cmd_cherry_pick", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_cherry_pick_continue(oid: Option<String>, state: State<'_, AppState>) -> Result<CherryPickOutcome, AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; cherry_pick::cherry_pick_continue(&repo, oid.as_deref()) })();
    state.log_command("cmd_cherry_pick_continue", t, &r);
    r
}

#[tauri::command]
pub async fn cmd_cherry_pick_abort(state: State<'_, AppState>) -> Result<(), AppError> {
    let t = std::time::Instant::now();
    let r = (|| { let repo = state.open_repo()?; cherry_pick::abort_cherry_pick(&repo) })();
    state.log_command("cmd_cherry_pick_abort", t, &r);
    r
}

#[derive(Deserialize)]
pub struct SignatureInput {
    pub name: String,
    pub email: String,
}

pub(crate) fn create_commit_inner(
    repo: &git2::Repository,
    message: &str,
    author: Option<(&str, &str)>,
) -> Result<String, AppError> {
    let sig = match author {
        Some((name, email)) => git2::Signature::now(name, email)?,
        None => repo.signature()?,
    };
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let head_parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    // Mid-merge: MERGE_HEAD(s) become additional parents so the merge isn't flattened.
    // (Read the file directly — mergehead_foreach needs &mut Repository.)
    let mut merge_parents: Vec<git2::Commit> = Vec::new();
    if repo.state() == git2::RepositoryState::Merge {
        if let Ok(content) = std::fs::read_to_string(repo.path().join("MERGE_HEAD")) {
            for line in content.lines() {
                if let Ok(oid) = git2::Oid::from_str(line.trim()) {
                    if let Ok(c) = repo.find_commit(oid) {
                        merge_parents.push(c);
                    }
                }
            }
        }
    }
    let parents: Vec<&git2::Commit> = head_parent.iter().chain(merge_parents.iter()).collect();
    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
    // Clear MERGE_HEAD / CHERRY_PICK_HEAD etc. now that the commit landed
    repo.cleanup_state()?;
    Ok(oid.to_string())
}

#[tauri::command]
pub async fn cmd_create_commit(
    message: String,
    author: Option<SignatureInput>,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = (|| {
        let repo = state.open_repo()?;
        create_commit_inner(
            &repo,
            &message,
            author.as_ref().map(|a| (a.name.as_str(), a.email.as_str())),
        )
    })();
    state.log_command("cmd_create_commit", t, &r);
    r
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn init_repo() -> git2::Repository {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!("test_commit_cmd_{}_{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let repo = git2::Repository::init(&tmp).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
        repo
    }

    fn commit_file(repo: &git2::Repository, name: &str, content: &str, msg: &str) -> git2::Oid {
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
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents).unwrap()
    }

    fn cleanup(repo: git2::Repository) {
        let path = repo.path().parent().unwrap().to_path_buf();
        drop(repo);
        let _ = std::fs::remove_dir_all(&path);
    }

    #[test]
    fn normal_commit_single_parent() {
        let repo = init_repo();
        commit_file(&repo, "a.txt", "a\n", "base");
        std::fs::write(repo.workdir().unwrap().join("a.txt"), "a2\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("a.txt")).unwrap();
        index.write().unwrap();
        let oid = create_commit_inner(&repo, "second", None).unwrap();
        let parent_count = repo.find_commit(git2::Oid::from_str(&oid).unwrap()).unwrap().parent_count();
        assert_eq!(parent_count, 1);
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        cleanup(repo);
    }

    #[test]
    fn merge_commit_has_two_parents() {
        let repo = init_repo();
        let base = commit_file(&repo, "a.txt", "a\n", "base");
        let main_ref = repo.head().unwrap().name().unwrap().to_string();
        // divergent branch touching a different file (conflict-free merge)
        repo.branch("feat", &repo.find_commit(base).unwrap(), false).unwrap();
        repo.set_head("refs/heads/feat").unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force())).unwrap();
        commit_file(&repo, "b.txt", "b\n", "feat: add b");
        repo.set_head(&main_ref).unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force())).unwrap();
        commit_file(&repo, "c.txt", "c\n", "main: add c");

        let result = crate::git::branches::merge_branch(&repo, "feat").unwrap();
        assert!(!result.has_conflicts);
        assert_eq!(repo.state(), git2::RepositoryState::Merge);

        let oid = create_commit_inner(&repo, "merge feat", None).unwrap();
        let parent_count = repo.find_commit(git2::Oid::from_str(&oid).unwrap()).unwrap().parent_count();
        assert_eq!(parent_count, 2);
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        cleanup(repo);
    }
}

#[tauri::command]
pub async fn cmd_amend_commit(
    message: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let t = std::time::Instant::now();
    let r = (|| {
        let repo = state.open_repo()?;
        let head_commit = repo.head()?.peel_to_commit()?;
        let mut index = repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;
        let msg = message.as_deref().unwrap_or_else(|| head_commit.message().unwrap_or(""));
        let sig = repo.signature()?;
        let oid = head_commit.amend(Some("HEAD"), Some(&sig), Some(&sig), None, Some(msg), Some(&tree))?;
        Ok(oid.to_string())
    })();
    state.log_command("cmd_amend_commit", t, &r);
    r
}
