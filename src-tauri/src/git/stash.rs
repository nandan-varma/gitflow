use serde::Serialize;
use crate::error::AppError;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stash_list_on_empty_repo() {
        let mut repo = git2::Repository::init(std::env::temp_dir().join("test_stash_empty")).unwrap();
        let result = list_stashes(&mut repo).unwrap();
        assert!(result.is_empty());
        let _ = std::fs::remove_dir_all(repo.path().parent().unwrap());
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct StashEntry {
    pub index: usize,
    pub message: String,
    pub oid: String,
    pub timestamp: i64,
}

pub fn list_stashes(repo: &mut git2::Repository) -> Result<Vec<StashEntry>, AppError> {
    let mut entries = Vec::new();
    let stash_oids: Vec<git2::Oid> = {
        let mut oids = Vec::new();
        repo.stash_foreach(|_index, _message, oid| {
            oids.push(*oid);
            true
        })?;
        oids
    };
    for (i, oid) in stash_oids.into_iter().enumerate() {
        let commit = repo.find_commit(oid)?;
        entries.push(StashEntry {
            index: i,
            message: commit.summary().unwrap_or("WIP").to_string(),
            oid: oid.to_string(),
            timestamp: commit.time().seconds(),
        });
    }
    Ok(entries)
}

pub fn stash_push(
    repo: &mut git2::Repository,
    message: Option<&str>,
    include_untracked: bool,
) -> Result<(), AppError> {
    let sig = repo.signature()?;
    let msg = message.unwrap_or("WIP");
    let flags = if include_untracked {
        Some(git2::StashFlags::INCLUDE_UNTRACKED)
    } else {
        None
    };
    repo.stash_save(&sig, msg, flags)?;
    Ok(())
}

pub fn stash_apply(repo: &mut git2::Repository, index: usize) -> Result<(), AppError> {
    repo.stash_apply(index, None)?;
    Ok(())
}

pub fn stash_pop(repo: &mut git2::Repository, index: usize) -> Result<(), AppError> {
    repo.stash_pop(index, None)?;
    Ok(())
}

pub fn stash_drop(repo: &mut git2::Repository, index: usize) -> Result<(), AppError> {
    repo.stash_drop(index)?;
    Ok(())
}
