use serde::Serialize;
use std::path::Path;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct ConflictEntry {
    pub path: String,
    pub conflict_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ConflictDetail {
    pub path: String,
    pub ours: String,
    pub theirs: String,
    pub base: Option<String>,
    pub conflicts: Vec<ConflictBlock>,
}

#[derive(Debug, Serialize)]
pub struct ConflictBlock {
    pub ours_lines: Vec<String>,
    pub theirs_lines: Vec<String>,
    pub before_lines: Vec<String>,
}

pub fn get_conflicts(repo: &git2::Repository) -> Result<Vec<ConflictEntry>, AppError> {
    let index = repo.index()?;
    if !index.has_conflicts() {
        return Ok(Vec::new());
    }

    let mut paths: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for conflict in index.conflicts()? {
        let conflict = conflict?;
        let path = conflict
            .our
            .or(conflict.their)
            .or(conflict.ancestor)
            .and_then(|e| {
                std::str::from_utf8(&e.path)
                    .ok()
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();
        *paths.entry(path).or_insert(0) += 1;
    }

    Ok(paths
        .into_iter()
        .map(|(path, conflict_count)| ConflictEntry { path, conflict_count })
        .collect())
}

pub fn get_conflict_detail(repo: &git2::Repository, path: &str) -> Result<ConflictDetail, AppError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::Other("Bare repository".into()))?;
    let full_path = workdir.join(path);
    let content = std::fs::read_to_string(&full_path)?;

    let mut ours_lines = Vec::new();
    let mut theirs_lines = Vec::new();
    let mut before_lines_section: Vec<String> = Vec::new();
    let mut conflicts: Vec<ConflictBlock> = Vec::new();

    #[derive(PartialEq)]
    enum State { Normal, Ours, Theirs }
    let mut state = State::Normal;
    let mut current_ours: Vec<String> = Vec::new();
    let mut current_theirs: Vec<String> = Vec::new();
    let mut current_before: Vec<String> = Vec::new();
    let mut before_buf: Vec<String> = Vec::new();

    for line in content.lines() {
        if line.starts_with("<<<<<<<") {
            state = State::Ours;
            current_before = before_buf.clone();
            before_buf.clear();
        } else if line.starts_with("=======") && state == State::Ours {
            state = State::Theirs;
        } else if line.starts_with(">>>>>>>") && state == State::Theirs {
            conflicts.push(ConflictBlock {
                ours_lines: current_ours.clone(),
                theirs_lines: current_theirs.clone(),
                before_lines: current_before.clone(),
            });
            ours_lines.extend(current_ours.drain(..));
            theirs_lines.extend(current_theirs.drain(..));
            state = State::Normal;
        } else {
            match state {
                State::Normal => before_buf.push(line.to_string()),
                State::Ours => current_ours.push(line.to_string()),
                State::Theirs => current_theirs.push(line.to_string()),
            }
        }
    }

    Ok(ConflictDetail {
        path: path.to_string(),
        ours: ours_lines.join("\n"),
        theirs: theirs_lines.join("\n"),
        base: None,
        conflicts,
    })
}

pub fn resolve_conflict(
    repo: &git2::Repository,
    path: &str,
    resolution: &str,
) -> Result<(), AppError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::Other("Bare repository".into()))?;
    let full_path = workdir.join(path);
    std::fs::write(&full_path, resolution)?;

    // Stage the resolved file
    let mut index = repo.index()?;
    index.add_path(Path::new(path))?;
    index.write()?;
    Ok(())
}
