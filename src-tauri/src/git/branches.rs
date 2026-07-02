use serde::Serialize;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub oid: String,
}

#[derive(Debug, Serialize)]
pub struct MergeResult {
    pub fast_forwarded: bool,
    pub committed: bool,
    pub has_conflicts: bool,
}

pub fn list_branches(repo: &git2::Repository) -> Result<Vec<BranchInfo>, AppError> {
    let mut branches = Vec::new();

    for item in repo.branches(None)? {
        let (branch, branch_type) = item?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_remote = branch_type == git2::BranchType::Remote;
        // Compare ref names, not OIDs — two branches at the same commit are not both HEAD
        let is_head = !is_remote && branch.is_head();
        let reference = branch.get();
        let oid = reference.target().map(|o| o.to_string()).unwrap_or_default();

        let upstream_name = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        let (ahead, behind) = if let Ok(upstream) = branch.upstream() {
            if let (Some(local_oid), Some(upstream_oid)) =
                (reference.target(), upstream.get().target())
            {
                repo.graph_ahead_behind(local_oid, upstream_oid)
                    .unwrap_or((0, 0))
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        branches.push(BranchInfo {
            name,
            is_head,
            is_remote,
            upstream: upstream_name,
            ahead,
            behind,
            oid,
        });
    }

    Ok(branches)
}

pub fn create_branch(
    repo: &git2::Repository,
    name: &str,
    from_oid: Option<&str>,
) -> Result<(), AppError> {
    let commit = if let Some(oid_str) = from_oid {
        let oid = git2::Oid::from_str(oid_str)
            .map_err(|_| AppError::InvalidArgument(format!("Invalid OID: {oid_str}")))?;
        repo.find_commit(oid)?
    } else {
        let head = repo.head()?;
        head.peel_to_commit()?
    };

    repo.branch(name, &commit, false)?;
    Ok(())
}

/// Check out a remote-tracking branch by creating (or reusing) a local branch
/// that tracks it, then switching to that local branch. Plain `set_head` on a
/// remote ref would leave HEAD in a state git never produces.
pub fn checkout_remote_branch(repo: &git2::Repository, remote_name: &str) -> Result<(), AppError> {
    let local_name = remote_name
        .split_once('/')
        .map(|(_, rest)| rest)
        .ok_or_else(|| AppError::InvalidArgument(format!("Not a remote branch: {remote_name}")))?;

    if repo.find_branch(local_name, git2::BranchType::Local).is_err() {
        let remote = repo.find_branch(remote_name, git2::BranchType::Remote)?;
        let target = remote.get().peel_to_commit()?;
        let mut created = repo.branch(local_name, &target, false)?;
        created.set_upstream(Some(remote_name))?;
    }

    let local = repo.find_branch(local_name, git2::BranchType::Local)?;
    let refname = local
        .get()
        .name()
        .ok_or_else(|| AppError::Git("Invalid branch ref name".into()))?
        .to_string();
    let object = local.get().peel(git2::ObjectType::Commit)?;
    repo.checkout_tree(&object, None)?;
    repo.set_head(&refname)?;
    Ok(())
}

pub fn switch_branch(repo: &git2::Repository, name: &str) -> Result<(), AppError> {
    if repo.find_branch(name, git2::BranchType::Remote).is_ok() {
        return checkout_remote_branch(repo, name);
    }
    let (object, reference) = repo.revparse_ext(name)?;
    repo.checkout_tree(&object, None)?;
    match reference {
        Some(r) => repo.set_head(r.name().unwrap_or(name))?,
        None => repo.set_head_detached(object.id())?,
    }
    Ok(())
}

pub fn delete_branch(repo: &git2::Repository, name: &str, force: bool) -> Result<(), AppError> {
    let mut branch = repo.find_branch(name, git2::BranchType::Local)?;
    if !force {
        let branch_oid = branch.get().target()
            .ok_or_else(|| AppError::Git("Branch has no target".into()))?;
        if let Ok(head) = repo.head() {
            if let Some(head_oid) = head.target() {
                let is_merged = repo.graph_ahead_behind(branch_oid, head_oid)
                    .map(|(ahead, _)| ahead == 0)
                    .unwrap_or(false);
                if !is_merged {
                    return Err(AppError::Git(format!(
                        "Branch '{name}' is not fully merged. Use force delete to override."
                    )));
                }
            }
        }
    }
    branch.delete()?;
    Ok(())
}

pub fn merge_branch(repo: &git2::Repository, name: &str) -> Result<MergeResult, AppError> {
    let annotated = {
        let branch = repo.find_branch(name, git2::BranchType::Local)?;
        let oid = branch
            .get()
            .target()
            .ok_or_else(|| AppError::Git("Branch has no target".into()))?;
        repo.find_annotated_commit(oid)?
    };

    let analysis = repo.merge_analysis(&[&annotated])?;

    if analysis.0.is_fast_forward() {
        let target_oid = annotated.id();
        let target_commit = repo.find_commit(target_oid)?;
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.safe();
        repo.checkout_tree(target_commit.as_object(), Some(&mut checkout))?;
        let mut head = repo.head()?;
        head.set_target(target_oid, "merge: fast-forward")?;
        return Ok(MergeResult {
            fast_forwarded: true,
            committed: false,
            has_conflicts: false,
        });
    }

    if analysis.0.is_up_to_date() {
        return Ok(MergeResult {
            fast_forwarded: false,
            committed: false,
            has_conflicts: false,
        });
    }

    let mut merge_opts = git2::MergeOptions::new();
    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.safe();
    repo.merge(&[&annotated], Some(&mut merge_opts), Some(&mut checkout_opts))?;

    let has_conflicts = repo.index()?.has_conflicts();
    Ok(MergeResult {
        fast_forwarded: false,
        committed: false,
        has_conflicts,
    })
}

pub fn abort_merge(repo: &git2::Repository) -> Result<(), AppError> {
    let head_commit = repo.head()?.peel_to_commit()?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    repo.reset(head_commit.as_object(), git2::ResetType::Hard, Some(&mut checkout))?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum RebaseOutcome {
    Success,
    Conflicts { current_step: usize, total_steps: usize },
}

pub fn start_rebase(repo: &git2::Repository, upstream_name: &str) -> Result<RebaseOutcome, AppError> {
    let upstream = repo.find_branch(upstream_name, git2::BranchType::Local)?;
    let upstream_ac = repo.reference_to_annotated_commit(upstream.get())?;
    let sig = repo.signature()?;
    let mut rebase = repo.rebase(None, Some(&upstream_ac), None, None)?;
    process_rebase_ops(repo, &mut rebase, &sig)
}

pub fn continue_rebase(repo: &git2::Repository) -> Result<RebaseOutcome, AppError> {
    let sig = repo.signature()?;
    let mut rebase = repo.open_rebase(None)?;
    rebase.commit(None, &sig, None)?;
    process_rebase_ops(repo, &mut rebase, &sig)
}

pub fn abort_rebase(repo: &git2::Repository) -> Result<(), AppError> {
    let mut rebase = repo.open_rebase(None)?;
    Ok(rebase.abort()?)
}

fn process_rebase_ops(
    repo: &git2::Repository,
    rebase: &mut git2::Rebase,
    sig: &git2::Signature,
) -> Result<RebaseOutcome, AppError> {
    let total = rebase.len();
    let mut current_step = 0usize;
    while let Some(op) = rebase.next() {
        op?;
        if repo.index()?.has_conflicts() {
            return Ok(RebaseOutcome::Conflicts { current_step, total_steps: total });
        }
        rebase.commit(None, sig, None)?;
        current_step += 1;
    }
    rebase.finish(None)?;
    Ok(RebaseOutcome::Success)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn init_repo() -> git2::Repository {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!("test_branches_{}_{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let repo = git2::Repository::init(&tmp).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
        repo
    }

    fn commit_file(repo: &git2::Repository, name: &str, content: &str) -> git2::Oid {
        std::fs::write(repo.workdir().unwrap().join(name), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new(name)).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let sig = repo.signature().unwrap();
        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, "commit", &tree, &parents).unwrap()
    }

    fn cleanup(repo: git2::Repository) {
        let path = repo.path().parent().unwrap().to_path_buf();
        drop(repo);
        let _ = std::fs::remove_dir_all(&path);
    }

    #[test]
    fn is_head_only_for_checked_out_branch() {
        let repo = init_repo();
        let oid = commit_file(&repo, "a.txt", "a\n");
        // second branch at the exact same commit
        repo.branch("twin", &repo.find_commit(oid).unwrap(), false).unwrap();
        let head_name = repo.head().unwrap().shorthand().unwrap().to_string();

        let branches = list_branches(&repo).unwrap();
        let heads: Vec<&BranchInfo> = branches.iter().filter(|b| b.is_head).collect();
        assert_eq!(heads.len(), 1);
        assert_eq!(heads[0].name, head_name);
        cleanup(repo);
    }

    #[test]
    fn checkout_remote_branch_creates_tracking_local() {
        let repo = init_repo();
        let oid = commit_file(&repo, "a.txt", "a\n");
        repo.remote("origin", "https://example.invalid/repo.git").unwrap();
        repo.reference("refs/remotes/origin/feat", oid, false, "test").unwrap();

        switch_branch(&repo, "origin/feat").unwrap();

        {
            let head = repo.head().unwrap();
            assert!(head.is_branch());
            assert_eq!(head.name().unwrap(), "refs/heads/feat");
            let local = repo.find_branch("feat", git2::BranchType::Local).unwrap();
            let upstream = local.upstream().unwrap();
            assert_eq!(upstream.name().unwrap().unwrap(), "origin/feat");
        }
        cleanup(repo);
    }

    #[test]
    fn switch_branch_local_still_works() {
        let repo = init_repo();
        let oid = commit_file(&repo, "a.txt", "a\n");
        repo.branch("other", &repo.find_commit(oid).unwrap(), false).unwrap();
        switch_branch(&repo, "other").unwrap();
        assert_eq!(repo.head().unwrap().name().unwrap(), "refs/heads/other");
        cleanup(repo);
    }
}
