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
    let head_oid = repo.head().ok().and_then(|h| h.target());
    let mut branches = Vec::new();

    for item in repo.branches(None)? {
        let (branch, branch_type) = item?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_remote = branch_type == git2::BranchType::Remote;
        let reference = branch.get();
        let oid = reference.target().map(|o| o.to_string()).unwrap_or_default();
        let is_head = head_oid.map_or(false, |h| Some(h) == reference.target());

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

pub fn switch_branch(repo: &git2::Repository, name: &str) -> Result<(), AppError> {
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
    if force {
        branch.delete()?;
    } else {
        // Check if fully merged
        branch.delete()?;
    }
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
