use serde::Serialize;
use crate::error::AppError;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_oid_returns_error() {
        let repo = git2::Repository::init(std::env::temp_dir().join("test_cherry_pick_invalid")).unwrap();
        let result = cherry_pick(&repo, "not-an-oid");
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(repo.path().parent().unwrap());
    }
}

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

    Ok(CherryPickOutcome::Success { oid: oid.to_string() })
}

pub fn cherry_pick_continue(repo: &git2::Repository, oid_str: &str) -> Result<CherryPickOutcome, AppError> {
    let oid = git2::Oid::from_str(oid_str)
        .map_err(|_| AppError::InvalidArgument(format!("Invalid OID: {oid_str}")))?;
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
    Ok(())
}
