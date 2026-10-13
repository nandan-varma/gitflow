use serde::Serialize;
use std::{cell::RefCell, collections::HashMap, rc::Rc};
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct GraphNode {
    pub oid: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parents: Vec<String>,
    pub is_merge: bool,
    pub refs: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct GraphPage {
    pub nodes: Vec<GraphNode>,
    pub has_more: bool,
}

/// Walk every commit reachable from HEAD or any ref, topologically sorted.
/// This is the expensive part of building the graph — callers that page
/// through history should compute it once (see `compute_state_key`) and
/// reuse the result across pages instead of calling this per-page.
pub fn list_all_oids(repo: &git2::Repository) -> Result<Vec<git2::Oid>, AppError> {
    let mut walk = repo.revwalk()?;
    walk.push_head().ok();
    for reference in repo.references()? {
        let r = reference?;
        if let Some(oid) = r.target() {
            walk.push(oid).ok();
        }
    }
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;
    Ok(walk.filter_map(|r| r.ok()).collect())
}

/// Cheap, order-independent fingerprint of everything that could change what
/// `list_all_oids` returns: HEAD's target plus every ref's target oid. Two
/// calls returning the same key mean a cached oid list is still valid —
/// this avoids re-walking all of history just to check for staleness.
pub fn compute_state_key(repo: &git2::Repository) -> Result<u64, AppError> {
    use std::hash::{Hash, Hasher};
    let mut entries: Vec<String> = Vec::new();
    if let Ok(head) = repo.head() {
        if let Some(oid) = head.target() {
            entries.push(format!("HEAD:{oid}"));
        }
    }
    for reference in repo.references()? {
        let r = reference?;
        if let (Ok(name), Some(oid)) = (r.name(), r.target()) {
            entries.push(format!("{name}:{oid}"));
        }
    }
    entries.sort_unstable();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    entries.hash(&mut hasher);
    Ok(hasher.finish())
}

/// Label map from commit oid (as string) to the branch/tag names pointing at it.
fn build_ref_map(repo: &git2::Repository) -> Result<HashMap<String, Vec<String>>, AppError> {
    let mut ref_map: HashMap<String, Vec<String>> = HashMap::new();
    for reference in repo.references()? {
        let r = reference?;
        let name = r.name().unwrap_or("");
        if name.starts_with("refs/heads/") || name.starts_with("refs/tags/") {
            let shorthand = r.shorthand().unwrap_or("?").to_string();
            if let Ok(peeled) = r.peel(git2::ObjectType::Commit) {
                ref_map.entry(peeled.id().to_string()).or_default().push(shorthand);
            }
        }
    }
    Ok(ref_map)
}

fn nodes_for_oids(
    repo: &git2::Repository,
    oids: &[git2::Oid],
    ref_map: &HashMap<String, Vec<String>>,
) -> Result<Vec<GraphNode>, AppError> {
    let mut nodes = Vec::with_capacity(oids.len());
    for oid in oids {
        let commit = repo.find_commit(*oid)?;
        let oid_str = oid.to_string();

        let parents: Vec<String> = (0..commit.parent_count())
            .map(|i| commit.parent_id(i).unwrap().to_string())
            .collect();

        let author = commit.author();
        let refs = ref_map.get(&oid_str).cloned().unwrap_or_default();

        // Deduplicate refs
        let unique_refs: Vec<String> = {
            let set: std::collections::BTreeSet<String> = refs.into_iter().collect();
            set.into_iter().collect()
        };

        nodes.push(GraphNode {
            oid: oid_str,
            summary: commit.summary().ok().flatten().unwrap_or("").to_string(),
            author_name: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parents,
            is_merge: commit.parent_count() > 1,
            refs: unique_refs,
        });
    }
    Ok(nodes)
}

/// Slice a page of nodes out of a precomputed, fully-ordered oid list — the
/// cheap path once `list_all_oids` has already run once for the current
/// repo state.
pub fn page_from_oids(
    repo: &git2::Repository,
    all_oids: &[git2::Oid],
    limit: usize,
    offset: usize,
) -> Result<GraphPage, AppError> {
    let start = offset.min(all_oids.len());
    let end = offset.saturating_add(limit).saturating_add(1).min(all_oids.len());
    let slice = &all_oids[start..end];
    let has_more = slice.len() > limit;
    let page_oids = &slice[..slice.len().min(limit)];

    let ref_map = build_ref_map(repo)?;
    let nodes = nodes_for_oids(repo, page_oids, &ref_map)?;
    Ok(GraphPage { nodes, has_more })
}

#[derive(Debug, Serialize)]
pub struct ChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Serialize)]
pub struct FileHistoryEntry {
    pub oid: String,
    pub summary: String,
    pub author_name: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize)]
pub struct CommitDetail {
    pub oid: String,
    pub summary: String,
    pub body: Option<String>,
    pub author_name: String,
    pub author_email: String,
    pub committer_name: String,
    pub committer_email: String,
    pub timestamp: i64,
    pub committer_timestamp: i64,
    pub parents: Vec<String>,
    pub stats: DiffStats,
    pub changed_files: Vec<ChangedFile>,
}

#[derive(Debug, Serialize, Default)]
pub struct DiffStats {
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
}

pub fn get_commit_detail(repo: &git2::Repository, oid_str: &str) -> Result<CommitDetail, AppError> {
    let oid = git2::Oid::from_str(oid_str)
        .map_err(|_| AppError::InvalidArgument(format!("Invalid OID: {oid_str}")))?;
    let commit = repo.find_commit(oid)?;

    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
    let tree = commit.tree()?;
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;

    let s = diff.stats()?;
    let stats = DiffStats {
        files_changed: s.files_changed(),
        insertions: s.insertions(),
        deletions: s.deletions(),
    };

    let changed_files: Rc<RefCell<Vec<ChangedFile>>> = Rc::new(RefCell::new(Vec::new()));
    let cf_file = Rc::clone(&changed_files);
    let cf_line = Rc::clone(&changed_files);

    diff.foreach(
        &mut |delta, _| {
            let new_p = delta.new_file().path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let old_p = delta.old_file().path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let old_path = if old_p != new_p && !old_p.is_empty() { Some(old_p) } else { None };
            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Renamed => "renamed",
                _ => "modified",
            }.to_string();
            cf_file.borrow_mut().push(ChangedFile { path: new_p, old_path, status, additions: 0, deletions: 0 });
            true
        },
        None,
        None,
        Some(&mut |_, _, line| {
            match line.origin() {
                '+' => { if let Some(f) = cf_line.borrow_mut().last_mut() { f.additions += 1; } }
                '-' => { if let Some(f) = cf_line.borrow_mut().last_mut() { f.deletions += 1; } }
                _ => {}
            }
            true
        }),
    )?;

    drop((cf_file, cf_line));
    let changed_files = Rc::try_unwrap(changed_files)
        .map_err(|_| AppError::Other("internal: diff Rc still borrowed".into()))?
        .into_inner();

    let author = commit.author();
    let committer = commit.committer();
    let parents = (0..commit.parent_count())
        .map(|i| commit.parent_id(i).unwrap().to_string())
        .collect();

    Ok(CommitDetail {
        oid: oid_str.to_string(),
        summary: commit.summary().ok().flatten().unwrap_or("").to_string(),
        body: commit.body().ok().flatten().map(|s| s.to_string()),
        author_name: author.name().unwrap_or("").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        committer_name: committer.name().unwrap_or("").to_string(),
        committer_email: committer.email().unwrap_or("").to_string(),
        timestamp: commit.time().seconds(),
        committer_timestamp: committer.when().seconds(),
        parents,
        stats,
        changed_files,
    })
}

pub fn get_file_history(
    repo: &git2::Repository,
    path: &str,
    limit: usize,
) -> Result<Vec<FileHistoryEntry>, AppError> {
    let mut walk = repo.revwalk()?;
    walk.push_head().ok();
    for r in repo.references()?.flatten() {
        if let Some(oid) = r.target() { walk.push(oid).ok(); }
    }
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;

    let p = std::path::Path::new(path);
    let mut entries = Vec::new();

    'outer: for oid_result in walk {
        let oid = oid_result?;
        let commit = repo.find_commit(oid)?;
        let tree = commit.tree()?;

        // Quick check: does the path exist in this commit or its parent?
        // If not, skip the expensive diff entirely.
        let in_current = tree.get_path(p).is_ok();
        let in_parent = commit.parent(0).ok()
            .and_then(|pc| pc.tree().ok())
            .map(|pt| pt.get_path(p).is_ok())
            .unwrap_or(false);
        if !in_current && !in_parent {
            continue;
        }

        let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
        let mut opts = git2::DiffOptions::new();
        opts.pathspec(path);
        let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;

        let mut touched = false;
        diff.foreach(
            &mut |delta, _| {
                if delta.new_file().path() == Some(p) || delta.old_file().path() == Some(p) {
                    touched = true;
                }
                true
            },
            None, None, None,
        )?;

        if touched {
            let author = commit.author();
            entries.push(FileHistoryEntry {
                oid: oid.to_string(),
                summary: commit.summary().ok().flatten().unwrap_or("").to_string(),
                author_name: author.name().unwrap_or("").to_string(),
                timestamp: commit.time().seconds(),
            });
            if entries.len() >= limit { break 'outer; }
        }
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn init_repo() -> git2::Repository {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!("test_graph_{}_{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let repo = git2::Repository::init(&tmp).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();

        let sig = repo.signature().unwrap();
        let tree_oid = {
            let mut index = repo.index().unwrap();
            index.write_tree().unwrap()
        };
        let empty_tree = repo.find_tree(tree_oid).unwrap();

        // Create 3 linear commits on main
        let mut parent: Option<git2::Oid> = None;
        let mut oids = Vec::new();
        for i in 0..3 {
            let msg = format!("commit {i}");
            let commit = parent.and_then(|oid| repo.find_commit(oid).ok());
            let parents: Vec<&git2::Commit> = commit.iter().collect();
            let oid = repo.commit(
                Some("refs/heads/main"),
                &sig, &sig, &msg, &empty_tree, &parents,
            ).unwrap();
            oids.push(oid);
            parent = Some(oid);
        }

        // Create a branch from commit 1 and add 2 more commits
        {
            let branch_commit = repo.find_commit(oids[1]).unwrap();
            repo.branch("feature", &branch_commit, false).unwrap();
        }
        parent = Some(oids[1]);
        for i in 0..2 {
            let msg = format!("feature commit {i}");
            let commit = parent.and_then(|oid| repo.find_commit(oid).ok());
            let parents: Vec<&git2::Commit> = commit.iter().collect();
            let oid = repo.commit(
                Some("refs/heads/feature"),
                &sig, &sig, &msg, &empty_tree, &parents,
            ).unwrap();
            oids.push(oid);
            parent = Some(oid);
        }

        // Drop empty_tree before returning repo to avoid borrow conflict
        drop(empty_tree);
        repo
    }

    fn cleanup(repo: git2::Repository) {
        let path = repo.path().parent().unwrap().to_path_buf();
        drop(repo);
        let _ = std::fs::remove_dir_all(&path);
    }

    /// One-shot page (walk + slice) — what `get_commit_graph` used to do
    /// directly, before the caching split. Production code now goes through
    /// `list_all_oids` once and `page_from_oids` per page instead.
    fn get_commit_graph(repo: &git2::Repository, limit: usize, offset: usize) -> Result<GraphPage, AppError> {
        let all_oids = list_all_oids(repo)?;
        page_from_oids(repo, &all_oids, limit, offset)
    }

    #[test]
    fn test_graph_returns_all_commits() {
        let repo = init_repo();
        let result = get_commit_graph(&repo, 10, 0).unwrap();
        assert_eq!(result.nodes.len(), 5);
        // All 5 commits present regardless of order
        let summaries: Vec<&str> = result.nodes.iter().map(|n| n.summary.as_str()).collect();
        assert!(summaries.contains(&"commit 0"));
        assert!(summaries.contains(&"commit 1"));
        assert!(summaries.contains(&"commit 2"));
        assert!(summaries.contains(&"feature commit 0"));
        assert!(summaries.contains(&"feature commit 1"));
        cleanup(repo);
    }

    #[test]
    fn test_graph_has_parent_relationships() {
        let repo = init_repo();
        let result = get_commit_graph(&repo, 10, 0).unwrap();
        // 5 commits total; root has 0 parents, rest have 1 each → 4 parent refs
        let total_parents: usize = result.nodes.iter().map(|n| n.parents.len()).sum();
        assert_eq!(total_parents, 4);
        // Non-root nodes have non-empty parent OIDs
        for node in result.nodes.iter().filter(|n| !n.parents.is_empty()) {
            for p in &node.parents {
                assert!(!p.is_empty());
            }
        }
        cleanup(repo);
    }

    #[test]
    fn test_graph_refs_include_branch_names() {
        let repo = init_repo();
        let result = get_commit_graph(&repo, 10, 0).unwrap();
        let main_refs: Vec<&str> = result.nodes[0].refs.iter().map(|r| r.as_str()).collect();
        // The most recent commit should be on a branch
        assert!(main_refs.contains(&"feature") || main_refs.contains(&"main"));
        cleanup(repo);
    }

    #[test]
    fn test_graph_pagination_has_more() {
        let repo = init_repo();
        let result = get_commit_graph(&repo, 3, 0).unwrap();
        assert_eq!(result.nodes.len(), 3);
        assert!(result.has_more);
        cleanup(repo);
    }

    #[test]
    fn test_graph_pagination_offset() {
        let repo = init_repo();
        let result = get_commit_graph(&repo, 10, 5).unwrap();
        // With 5 commits total and offset 5, should have 0 commits
        assert_eq!(result.nodes.len(), 0);
        assert!(!result.has_more);
        cleanup(repo);
    }

    #[test]
    fn test_get_commit_detail_returns_correct_data() {
        let repo = init_repo();
        let result = get_commit_graph(&repo, 10, 0).unwrap();
        let first_oid = &result.nodes[result.nodes.len() - 1].oid; // oldest commit
        let detail = get_commit_detail(&repo, first_oid).unwrap();
        assert_eq!(detail.oid, *first_oid);
        assert!(detail.summary.contains("commit 0"));
        assert!(detail.parents.is_empty()); // root commit
        cleanup(repo);
    }

    #[test]
    fn test_file_history_empty_for_nonexistent_path() {
        let repo = init_repo();
        let result = get_file_history(&repo, "nonexistent.txt", 10).unwrap();
        assert!(result.is_empty());
        cleanup(repo);
    }

    #[test]
    fn test_page_from_oids_consecutive_pages_cover_all_commits_once() {
        let repo = init_repo();
        let all_oids = list_all_oids(&repo).unwrap();
        assert_eq!(all_oids.len(), 5);

        // Simulates infinite-scroll paging against one cached oid list: every
        // commit appears exactly once across consecutive pages, in the same
        // order as the full walk, regardless of page size.
        for page_size in [1, 2, 3, 10] {
            let mut seen: Vec<String> = Vec::new();
            let mut offset = 0;
            loop {
                let page = page_from_oids(&repo, &all_oids, page_size, offset).unwrap();
                let got = page.nodes.len();
                seen.extend(page.nodes.into_iter().map(|n| n.oid));
                offset += got;
                if !page.has_more { break; }
            }
            let expected: Vec<String> = all_oids.iter().map(|o| o.to_string()).collect();
            assert_eq!(seen, expected, "page_size={page_size}");
        }
        cleanup(repo);
    }

    #[test]
    fn test_page_from_oids_offset_past_end_is_empty() {
        let repo = init_repo();
        let all_oids = list_all_oids(&repo).unwrap();
        let page = page_from_oids(&repo, &all_oids, 10, 999).unwrap();
        assert!(page.nodes.is_empty());
        assert!(!page.has_more);
        cleanup(repo);
    }

    #[test]
    fn test_state_key_stable_without_changes() {
        let repo = init_repo();
        let k1 = compute_state_key(&repo).unwrap();
        let k2 = compute_state_key(&repo).unwrap();
        assert_eq!(k1, k2);
        cleanup(repo);
    }

    #[test]
    fn test_state_key_changes_on_new_commit() {
        let repo = init_repo();
        let before = compute_state_key(&repo).unwrap();

        // init_repo() commits directly onto refs/heads/main (not HEAD, which
        // may still point at git2's default `refs/heads/master`).
        let sig = repo.signature().unwrap();
        {
            let main_commit = repo.find_branch("main", git2::BranchType::Local).unwrap().get().peel_to_commit().unwrap();
            let tree = main_commit.tree().unwrap();
            repo.commit(Some("refs/heads/main"), &sig, &sig, "one more", &tree, &[&main_commit]).unwrap();
        }

        let after = compute_state_key(&repo).unwrap();
        assert_ne!(before, after);
        cleanup(repo);
    }
}
