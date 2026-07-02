use serde::Serialize;
use crate::error::AppError;

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum CherryPickOutcome {
    Success { oid: String },
    Conflicts,
}

pub fn cherry_pick(repo: &git2::Repository, oid_str: &str) -> Result<CherryPickOutcome, AppError> {
    let oid = git2::Oid::from_str(oid_str)
        .map_err(|_| AppError::InvalidArgument(format!("Invalid OID: {oid_str}")))?;
    let commit = repo.find_commit(oid)?;

    repo.cherrypick(&commit, None)?;

    let has_conflicts = repo.index()?.has_conflicts();
    if has_conflicts {
        return Ok(CherryPickOutcome::Conflicts);
    }

    let sig = repo.signature()?;
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let parent_commit = repo.head()?.peel_to_commit()?;
    let msg = commit.message().unwrap_or("cherry-pick");
    let oid = repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &[&parent_commit])?;
    // repo.commit is plumbing — it does not remove CHERRY_PICK_HEAD
    repo.cleanup_state()?;

    Ok(CherryPickOutcome::Success { oid: oid.to_string() })
}

/// Continue an in-progress cherry-pick. When `oid_str` is None, the source
/// commit is read from CHERRY_PICK_HEAD (survives app restarts).
pub fn cherry_pick_continue(repo: &git2::Repository, oid_str: Option<&str>) -> Result<CherryPickOutcome, AppError> {
    let oid = match oid_str {
        Some(s) => git2::Oid::from_str(s)
            .map_err(|_| AppError::InvalidArgument(format!("Invalid OID: {s}")))?,
        None => {
            let content = std::fs::read_to_string(repo.path().join("CHERRY_PICK_HEAD"))
                .map_err(|_| AppError::Other("No cherry-pick in progress".into()))?;
            git2::Oid::from_str(content.trim())
                .map_err(|_| AppError::Other("Corrupt CHERRY_PICK_HEAD".into()))?
        }
    };
    let commit = repo.find_commit(oid)?;

    let mut index = repo.index()?;
    if index.has_conflicts() {
        return Err(AppError::Other("Conflicts must be resolved before continuing cherry-pick".into()));
    }

    let sig = repo.signature()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let parent_commit = repo.head()?.peel_to_commit()?;
    let msg = commit.message().unwrap_or("cherry-pick");
    let new_oid = repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &[&parent_commit])?;
    repo.cleanup_state()?;

    Ok(CherryPickOutcome::Success { oid: new_oid.to_string() })
}

pub fn abort_cherry_pick(repo: &git2::Repository) -> Result<(), AppError> {
    if repo.find_reference("CHERRY_PICK_HEAD").is_err() {
        return Err(AppError::Other("No cherry-pick in progress".into()));
    }
    let head_commit = repo.head()?.peel_to_commit()?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    repo.reset(head_commit.as_object(), git2::ResetType::Mixed, None)?;
    repo.checkout_head(Some(&mut checkout))?;
    // Mixed reset does not remove CHERRY_PICK_HEAD; clear it explicitly
    repo.cleanup_state()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn init_repo() -> git2::Repository {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!("test_cherry_pick_{}_{}", std::process::id(), n));
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
    fn test_invalid_oid_returns_error() {
        let repo = init_repo();
        let result = cherry_pick(&repo, "not-an-oid");
        assert!(result.is_err());
        cleanup(repo);
    }

    #[test]
    fn cherry_pick_clears_state() {
        let repo = init_repo();
        let base = commit_file(&repo, "a.txt", "a\n", "base");
        let main_ref = repo.head().unwrap().name().unwrap().to_string();
        // feature branch with an extra file
        repo.branch("feat", &repo.find_commit(base).unwrap(), false).unwrap();
        repo.set_head("refs/heads/feat").unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force())).unwrap();
        let feat_oid = commit_file(&repo, "b.txt", "b\n", "feat: add b");
        // back to the default branch, cherry-pick the feature commit
        repo.set_head(&main_ref).unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force())).unwrap();
        let outcome = cherry_pick(&repo, &feat_oid.to_string()).unwrap();
        assert!(matches!(outcome, CherryPickOutcome::Success { .. }));
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        cleanup(repo);
    }

    #[test]
    fn continue_reads_cherry_pick_head() {
        let repo = init_repo();
        let base = commit_file(&repo, "a.txt", "a\n", "base");
        let main_ref = repo.head().unwrap().name().unwrap().to_string();
        repo.branch("feat", &repo.find_commit(base).unwrap(), false).unwrap();
        repo.set_head("refs/heads/feat").unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force())).unwrap();
        let feat_oid = commit_file(&repo, "b.txt", "b from feat\n", "feat: add b");
        repo.set_head(&main_ref).unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force())).unwrap();
        // Simulate an in-progress cherry-pick: staged content + CHERRY_PICK_HEAD
        std::fs::write(repo.workdir().unwrap().join("b.txt"), "b from feat\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("b.txt")).unwrap();
        index.write().unwrap();
        std::fs::write(repo.path().join("CHERRY_PICK_HEAD"), format!("{feat_oid}\n")).unwrap();

        let outcome = cherry_pick_continue(&repo, None).unwrap();
        match outcome {
            CherryPickOutcome::Success { oid } => {
                let c = repo.find_commit(git2::Oid::from_str(&oid).unwrap()).unwrap();
                assert_eq!(c.message().unwrap(), "feat: add b");
            }
            CherryPickOutcome::Conflicts => panic!("unexpected conflicts"),
        }
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        cleanup(repo);
    }
}
