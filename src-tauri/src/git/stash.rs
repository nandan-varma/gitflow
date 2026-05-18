use serde::Serialize;
use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct StashEntry {
    pub index: usize,
    pub message: String,
    pub oid: String,
    pub timestamp: i64,
}

pub fn list_stashes(repo: &mut git2::Repository) -> Result<Vec<StashEntry>, AppError> {
    let mut entries = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        entries.push(StashEntry {
            index,
            message: message.to_string(),
            oid: oid.to_string(),
            timestamp: 0,
        });
        true
    })?;
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
