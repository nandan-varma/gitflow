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
    pub trailing_lines: Vec<String>,
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

/// Parse conflict markers out of file content. Returns the conflict blocks and
/// the lines after the last block (which must be preserved on resolve).
pub(crate) fn parse_conflicts(content: &str) -> (Vec<ConflictBlock>, Vec<String>) {
    #[derive(PartialEq)]
    enum State { Normal, Ours, Base, Theirs }
    let mut state = State::Normal;
    let mut conflicts: Vec<ConflictBlock> = Vec::new();
    let mut current_ours: Vec<String> = Vec::new();
    let mut current_theirs: Vec<String> = Vec::new();
    let mut current_before: Vec<String> = Vec::new();
    let mut before_buf: Vec<String> = Vec::new();

    for line in content.lines() {
        if (line.starts_with("<<<<<<< ") || line == "<<<<<<<") && state == State::Normal {
            state = State::Ours;
            current_before = std::mem::take(&mut before_buf);
        } else if (line.starts_with("||||||| ") || line == "|||||||") && state == State::Ours {
            // diff3 conflict style: base section, not shown in the two-pane editor
            state = State::Base;
        } else if line == "=======" && (state == State::Ours || state == State::Base) {
            state = State::Theirs;
        } else if (line.starts_with(">>>>>>> ") || line == ">>>>>>>") && state == State::Theirs {
            conflicts.push(ConflictBlock {
                ours_lines: std::mem::take(&mut current_ours),
                theirs_lines: std::mem::take(&mut current_theirs),
                before_lines: std::mem::take(&mut current_before),
            });
            state = State::Normal;
        } else {
            match state {
                State::Normal => before_buf.push(line.to_string()),
                State::Ours => current_ours.push(line.to_string()),
                State::Base => {}
                State::Theirs => current_theirs.push(line.to_string()),
            }
        }
    }

    (conflicts, before_buf)
}

pub fn get_conflict_detail(repo: &git2::Repository, path: &str) -> Result<ConflictDetail, AppError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::Other("Bare repository".into()))?;
    let full_path = workdir.join(path);
    let content = std::fs::read_to_string(&full_path)?;

    let (conflicts, trailing_lines) = parse_conflicts(&content);
    let ours: Vec<&str> = conflicts.iter().flat_map(|c| c.ours_lines.iter().map(String::as_str)).collect();
    let theirs: Vec<&str> = conflicts.iter().flat_map(|c| c.theirs_lines.iter().map(String::as_str)).collect();

    Ok(ConflictDetail {
        path: path.to_string(),
        ours: ours.join("\n"),
        theirs: theirs.join("\n"),
        base: None,
        conflicts,
        trailing_lines,
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
    // Text files end with a newline; the editor's textarea value doesn't.
    let mut resolution = resolution.to_string();
    if !resolution.is_empty() && !resolution.ends_with('\n') {
        resolution.push('\n');
    }
    std::fs::write(&full_path, resolution)?;

    // Stage the resolved file
    let mut index = repo.index()?;
    index.add_path(Path::new(path))?;
    index.write()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trailing_content_preserved() {
        let content = "top\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feat\nafter1\nafter2\nafter3\n";
        let (conflicts, trailing) = parse_conflicts(content);
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].before_lines, vec!["top"]);
        assert_eq!(trailing, vec!["after1", "after2", "after3"]);
    }

    #[test]
    fn diff3_base_section_excluded() {
        let content = "<<<<<<< ours\na\n||||||| base\nb\n=======\nc\n>>>>>>> theirs\n";
        let (conflicts, trailing) = parse_conflicts(content);
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].ours_lines, vec!["a"]);
        assert_eq!(conflicts[0].theirs_lines, vec!["c"]);
        assert!(trailing.is_empty());
    }

    #[test]
    fn multiple_blocks() {
        let content = "one\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> x\nmid\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> x\ntail\n";
        let (conflicts, trailing) = parse_conflicts(content);
        assert_eq!(conflicts.len(), 2);
        assert_eq!(conflicts[1].before_lines, vec!["mid"]);
        assert_eq!(conflicts[0].ours_lines, vec!["a"]);
        assert_eq!(conflicts[1].theirs_lines, vec!["d"]);
        assert_eq!(trailing, vec!["tail"]);
    }
}
