use crate::error::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct HunkLine {
    pub origin: char,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

pub fn stage_file(repo: &git2::Repository, path: &str) -> Result<(), AppError> {
    let mut index = repo.index()?;
    index.add_path(std::path::Path::new(path))?;
    index.write()?;
    Ok(())
}

pub fn unstage_file(repo: &git2::Repository, path: &str) -> Result<(), AppError> {
    let p = std::path::Path::new(path);
    let mut index = repo.index()?;

    // Find the HEAD tree entry for this path (None if new file or no HEAD).
    let head_entry = repo
        .head().ok()
        .and_then(|h| h.peel_to_tree().ok())
        .and_then(|tree| tree.get_path(p).ok());

    match head_entry {
        Some(entry) => {
            // File exists in HEAD: restore index entry to the HEAD version.
            let ie = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0, ino: 0, mode: entry.filemode() as u32,
                uid: 0, gid: 0, file_size: 0,
                id: entry.id(),
                flags: 0, flags_extended: 0,
                path: path.as_bytes().iter().copied().chain(std::iter::once(0)).collect(),
            };
            index.add(&ie)?;
        }
        None => {
            // New file (not in HEAD): remove from index entirely.
            index.remove_path(p)?;
        }
    }

    index.write()?;
    Ok(())
}

pub fn stage_hunk(
    repo: &git2::Repository,
    path: &str,
    lines: &[HunkLine],
) -> Result<(), AppError> {
    let patch = build_patch(path, lines);
    apply_patch_to_index(repo, &patch)
}

pub fn unstage_hunk(
    repo: &git2::Repository,
    path: &str,
    lines: &[HunkLine],
) -> Result<(), AppError> {
    // Reverse the lines to unapply from index
    let reversed: Vec<HunkLine> = lines
        .iter()
        .map(|l| HunkLine {
            origin: match l.origin {
                '+' => '-',
                '-' => '+',
                c => c,
            },
            content: l.content.clone(),
            old_lineno: l.new_lineno,
            new_lineno: l.old_lineno,
        })
        .collect();
    let patch = build_patch(path, &reversed);
    apply_patch_to_index(repo, &patch)
}

pub fn discard_changes(repo: &git2::Repository, path: &str) -> Result<(), AppError> {
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.path(path).force();
    repo.checkout_index(None, Some(&mut checkout))?;
    Ok(())
}

pub fn discard_lines(repo: &git2::Repository, path: &str, lines: &[HunkLine]) -> Result<(), AppError> {
    // Frontend pre-processes lines (reverses selected change lines to apply as workdir patch)
    let patch = build_patch(path, lines);
    let diff = git2::Diff::from_buffer(patch.as_bytes())?;
    repo.apply(&diff, git2::ApplyLocation::WorkDir, None)?;
    Ok(())
}

fn build_patch(path: &str, lines: &[HunkLine]) -> String {
    let additions: i32 = lines.iter().filter(|l| l.origin == '+').count() as i32;
    let deletions: i32 = lines.iter().filter(|l| l.origin == '-').count() as i32;
    let context: i32 = lines.iter().filter(|l| l.origin == ' ').count() as i32;

    let old_start = lines.iter().find_map(|l| l.old_lineno).unwrap_or(1);
    let new_start = lines.iter().find_map(|l| l.new_lineno).unwrap_or(1);
    let old_count = deletions + context;
    let new_count = additions + context;

    let mut patch = String::new();
    patch.push_str(&format!("diff --git a/{path} b/{path}\n"));
    patch.push_str(&format!("--- a/{path}\n"));
    patch.push_str(&format!("+++ b/{path}\n"));
    patch.push_str(&format!(
        "@@ -{old_start},{old_count} +{new_start},{new_count} @@\n"
    ));
    for line in lines {
        patch.push(line.origin);
        patch.push_str(&line.content);
        if !line.content.ends_with('\n') {
            patch.push('\n');
        }
    }
    patch
}

fn apply_patch_to_index(repo: &git2::Repository, patch: &str) -> Result<(), AppError> {
    let diff = git2::Diff::from_buffer(patch.as_bytes())?;
    repo.apply(&diff, git2::ApplyLocation::Index, None)?;
    Ok(())
}
