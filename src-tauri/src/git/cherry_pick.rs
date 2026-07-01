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

pub fn cherry_pick(repo: &git2::Repository, oid_str: &str) -> Result<(), AppError> {
    let oid = git2::Oid::from_str(oid_str)
        .map_err(|_| AppError::InvalidArgument(format!("Invalid OID: {oid_str}")))?;
    let commit = repo.find_commit(oid)?;
    let sig = repo.signature()?;

    repo.cherrypick(&commit, None)?;

    let has_conflicts = repo.index()?.has_conflicts();
    if has_conflicts {
        return Err(AppError::Git("Cherry-pick resulted in conflicts".into()));
    }

    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let parent_commit = repo.head()?.peel_to_commit()?;
    let msg = commit.message().unwrap_or("cherry-pick");
    repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &[&parent_commit])?;

    Ok(())
}


