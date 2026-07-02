use serde::Serialize;
use std::{cell::RefCell, rc::Rc};
use crate::error::AppError;



#[derive(Debug, Serialize)]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub is_binary: bool,
    pub hunks: Vec<DiffHunk>,
    pub stats: HunkStats,
}

#[derive(Debug, Serialize)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffLine {
    pub origin: char,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Serialize, Default)]
pub struct HunkStats {
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug)]
enum DiffEvent {
    Hunk { header: String, old_start: u32, old_lines: u32, new_start: u32, new_lines: u32 },
    Line(DiffLine),
    Binary,
    FileMeta { path: String, old_path: Option<String> },
}

fn diff_to_file_diff(diff: &git2::Diff, requested_path: &str) -> Result<FileDiff, AppError> {
    // Use Rc<RefCell> so all four foreach callbacks can share the events vec
    let events: Rc<RefCell<Vec<DiffEvent>>> = Rc::new(RefCell::new(Vec::new()));

    let e_file = Rc::clone(&events);
    let e_bin  = Rc::clone(&events);
    let e_hunk = Rc::clone(&events);
    let e_line = Rc::clone(&events);

    diff.foreach(
        &mut |delta, _| {
            let new_p = delta.new_file().path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let old_p = delta.old_file().path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let old_path = if old_p != new_p && !old_p.is_empty() { Some(old_p) } else { None };
            e_file.borrow_mut().push(DiffEvent::FileMeta { path: new_p, old_path });
            true
        },
        Some(&mut |_delta, _binary| {
            e_bin.borrow_mut().push(DiffEvent::Binary);
            true
        }),
        Some(&mut |_delta, hunk| {
            let header = std::str::from_utf8(hunk.header()).unwrap_or("").trim().to_string();
            e_hunk.borrow_mut().push(DiffEvent::Hunk {
                header,
                old_start: hunk.old_start(),
                old_lines: hunk.old_lines(),
                new_start: hunk.new_start(),
                new_lines: hunk.new_lines(),
            });
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let origin = line.origin();
            let content = std::str::from_utf8(line.content()).unwrap_or("").to_string();
            e_line.borrow_mut().push(DiffEvent::Line(DiffLine {
                origin,
                content,
                old_lineno: line.old_lineno(),
                new_lineno: line.new_lineno(),
            }));
            true
        }),
    )?;

    drop((e_file, e_bin, e_hunk, e_line));
    let all_events = match Rc::try_unwrap(events) {
        Ok(inner) => inner.into_inner(),
        Err(_) => {
            log::error!("diff_to_file_diff: Rc<RefCell> still has references after drop");
            Vec::new()
        },
    };

    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut is_binary = false;
    let mut stats = HunkStats::default();
    let mut actual_path = requested_path.to_string();
    let mut old_path: Option<String> = None;

    for event in all_events {
        match event {
            DiffEvent::FileMeta { path, old_path: op } => {
                actual_path = path;
                old_path = op;
            }
            DiffEvent::Binary => { is_binary = true; }
            DiffEvent::Hunk { header, old_start, old_lines, new_start, new_lines } => {
                hunks.push(DiffHunk { header, old_start, old_lines, new_start, new_lines, lines: Vec::new() });
            }
            DiffEvent::Line(line) => {
                match line.origin {
                    '+' => stats.additions += 1,
                    '-' => stats.deletions += 1,
                    _ => {}
                }
                if let Some(h) = hunks.last_mut() {
                    h.lines.push(line);
                }
            }
        }
    }

    Ok(FileDiff { path: actual_path, old_path, is_binary, hunks, stats })
}

pub fn get_diff_workdir(repo: &git2::Repository, path: &str) -> Result<FileDiff, AppError> {
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path).context_lines(3).interhunk_lines(0);
    let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
    diff_to_file_diff(&diff, path)
}

pub fn get_diff_staged(repo: &git2::Repository, path: &str) -> Result<FileDiff, AppError> {
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path).context_lines(3).interhunk_lines(0);
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))?;
    diff_to_file_diff(&diff, path)
}

pub fn get_diff_commit(repo: &git2::Repository, oid_str: &str, path: &str) -> Result<FileDiff, AppError> {
    let oid = git2::Oid::from_str(oid_str)
        .map_err(|_| AppError::InvalidArgument(format!("Invalid OID: {oid_str}")))?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path).context_lines(3).interhunk_lines(0);
    let diff = if commit.parent_count() == 0 {
        repo.diff_tree_to_tree(None, Some(&tree), Some(&mut opts))?
    } else {
        let parent_tree = commit.parent(0)?.tree()?;
        repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(&mut opts))?
    };
    diff_to_file_diff(&diff, path)
}
