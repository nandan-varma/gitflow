use tauri::State;
use serde::Deserialize;
use crate::{error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct SignatureInput {
    pub name: String,
    pub email: String,
}

#[tauri::command]
pub async fn cmd_create_commit(
    message: String,
    author: Option<SignatureInput>,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let repo = state.open_repo()?;

    let sig = if let Some(a) = author {
        git2::Signature::now(&a.name, &a.email)?
    } else {
        repo.signature()?
    };

    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    let oid = repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)?;
    Ok(oid.to_string())
}

#[tauri::command]
pub async fn cmd_amend_commit(
    message: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let repo = state.open_repo()?;
    let head_commit = repo.head()?.peel_to_commit()?;

    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    let msg = message.as_deref().unwrap_or_else(|| head_commit.message().unwrap_or(""));
    let sig = repo.signature()?;

    let oid = head_commit.amend(Some("HEAD"), Some(&sig), Some(&sig), None, Some(msg), Some(&tree))?;
    Ok(oid.to_string())
}
