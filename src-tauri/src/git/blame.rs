use serde::Serialize;
use std::collections::HashMap;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct BlameLine {
    pub line_no: u32,
    pub content: String,
    pub oid: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub summary: String,
}

pub fn get_blame(repo: &git2::Repository, path: &str) -> Result<Vec<BlameLine>, AppError> {
    let blame = repo.blame_file(std::path::Path::new(path), None)?;
    let workdir = repo.workdir().ok_or_else(|| AppError::Other("Bare repository".into()))?;
    let content = std::fs::read_to_string(workdir.join(path))?;

    let mut summary_cache: HashMap<String, String> = HashMap::new();
    let mut lines = Vec::new();

    for (i, line_content) in content.lines().enumerate() {
        let line_no = (i + 1) as u32;
        if let Some(hunk) = blame.get_line(line_no as usize) {
            let commit_id = hunk.final_commit_id();
            let oid = commit_id.to_string();
            let sig = hunk.final_signature();

            let summary = summary_cache
                .entry(oid.clone())
                .or_insert_with(|| {
                    repo.find_commit(commit_id)
                        .map(|c| c.summary().unwrap_or("").to_string())
                        .unwrap_or_default()
                })
                .clone();

            lines.push(BlameLine {
                line_no,
                content: line_content.to_string(),
                oid,
                author_name: sig.name().unwrap_or("").to_string(),
                author_email: sig.email().unwrap_or("").to_string(),
                timestamp: sig.when().seconds(),
                summary,
            });
        }
    }

    Ok(lines)
}
