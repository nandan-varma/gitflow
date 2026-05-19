use serde::Serialize;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct TagEntry {
    pub name: String,
    pub target_oid: String,
    pub is_annotated: bool,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RepoInfo {
    pub path: String,
    pub head_branch: Option<String>,
    pub head_oid: Option<String>,
    pub is_bare: bool,
    pub is_empty: bool,
    pub state: String,
}

pub fn open_repo(path: &str) -> Result<(git2::Repository, String), AppError> {
    let repo = git2::Repository::discover(path)
        .map_err(|_| AppError::Git(format!("No git repository found at or above {path}")))?;
    let workdir = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .unwrap()
        .to_string_lossy()
        .to_string();
    Ok((repo, workdir))
}

pub fn get_repo_info(repo: &git2::Repository) -> Result<RepoInfo, AppError> {
    let path = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .unwrap()
        .to_string_lossy()
        .to_string();

    let (head_branch, head_oid) = match repo.head() {
        Ok(head) => {
            let oid = head.target().map(|o| o.to_string());
            let branch = if head.is_branch() {
                head.shorthand().map(|s| s.to_string())
            } else {
                oid.as_deref().map(|s| &s[..8]).map(|s| format!("(detached) {s}"))
            };
            (branch, oid)
        }
        Err(_) => (None, None),
    };

    let state = match repo.state() {
        git2::RepositoryState::Clean => "clean",
        git2::RepositoryState::Merge => "merge",
        git2::RepositoryState::Revert | git2::RepositoryState::RevertSequence => "revert",
        git2::RepositoryState::CherryPick | git2::RepositoryState::CherryPickSequence => "cherry-pick",
        git2::RepositoryState::Bisect => "bisect",
        git2::RepositoryState::Rebase
        | git2::RepositoryState::RebaseInteractive
        | git2::RepositoryState::RebaseMerge => "rebase",
        git2::RepositoryState::ApplyMailbox | git2::RepositoryState::ApplyMailboxOrRebase => "am",
    };

    Ok(RepoInfo {
        path,
        head_branch,
        head_oid,
        is_bare: repo.is_bare(),
        is_empty: repo.is_empty().unwrap_or(false),
        state: state.to_string(),
    })
}

pub fn list_tags(repo: &git2::Repository) -> Result<Vec<TagEntry>, AppError> {
    let mut tags = Vec::new();
    repo.tag_foreach(|oid, name| {
        let name = std::str::from_utf8(name)
            .unwrap_or("")
            .trim_start_matches("refs/tags/")
            .to_string();
        let (is_annotated, message, target_oid) = if let Ok(tag) = repo.find_tag(oid) {
            let peeled = tag.target().ok().map(|t| t.id()).unwrap_or(oid);
            (true, tag.message().map(|m| m.trim().to_string()), peeled.to_string())
        } else {
            (false, None, oid.to_string())
        };
        tags.push(TagEntry { name, target_oid, is_annotated, message });
        true
    })?;
    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}
