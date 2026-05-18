use serde::Serialize;
use std::collections::HashMap;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct GraphNode {
    pub oid: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parents: Vec<String>,
    pub lane: usize,
    pub color_index: usize,
    pub is_merge: bool,
    pub refs: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct GraphEdge {
    pub from_oid: String,
    pub to_oid: String,
    pub from_lane: usize,
    pub to_lane: usize,
    pub color_index: usize,
}

#[derive(Debug, Serialize)]
pub struct GraphPage {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub total_lanes: usize,
    pub has_more: bool,
}

pub fn get_commit_graph(
    repo: &git2::Repository,
    limit: usize,
    offset: usize,
) -> Result<GraphPage, AppError> {
    // Collect all refs (branches + tags) for labeling
    let mut ref_map: HashMap<String, Vec<String>> = HashMap::new();
    for reference in repo.references()? {
        let r = reference?;
        if let Some(target) = r.target() {
            let name = r.shorthand().unwrap_or("?").to_string();
            ref_map.entry(target.to_string()).or_default().push(name);
        }
        // Also follow peeled tags to the commit
        if let Ok(peeled) = r.peel(git2::ObjectType::Commit) {
            let name = r.shorthand().unwrap_or("?").to_string();
            ref_map.entry(peeled.id().to_string()).or_default().push(name);
        }
    }

    // Topological walk with date sorting
    let mut walk = repo.revwalk()?;
    walk.push_head().ok();
    for r in repo.references()? {
        if let Ok(r) = r {
            if let Some(oid) = r.target() {
                walk.push(oid).ok();
            }
        }
    }
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;

    let all_oids: Vec<git2::Oid> = walk
        .filter_map(|r| r.ok())
        .skip(offset)
        .take(limit + 1)
        .collect();

    let has_more = all_oids.len() > limit;
    let oids: Vec<git2::Oid> = all_oids.into_iter().take(limit).collect();

    // Lane assignment — greedy free-list algorithm
    // active_lanes: maps oid-string of "expected child" → lane index
    let mut active_lanes: Vec<Option<(String, usize)>> = Vec::new(); // (child_oid, color)
    let mut free_lanes: Vec<usize> = Vec::new();
    let mut next_color: usize = 0;

    let mut nodes: Vec<GraphNode> = Vec::new();
    let mut edges: Vec<GraphEdge> = Vec::new();

    for oid in &oids {
        let commit = repo.find_commit(*oid)?;
        let oid_str = oid.to_string();

        // Find which lane this commit belongs to (if any active lane expects it)
        let assigned_lane = active_lanes
            .iter()
            .position(|slot| slot.as_ref().map_or(false, |(co, _)| co == &oid_str));

        let (lane, color_index) = if let Some(idx) = assigned_lane {
            let (_, color) = active_lanes[idx].take().unwrap();
            free_lanes.push(idx);
            (idx, color)
        } else {
            // New branch starts here — claim a free lane or extend
            let lane_idx = if let Some(free) = free_lanes.pop() {
                free
            } else {
                let idx = active_lanes.len();
                active_lanes.push(None);
                idx
            };
            let color = next_color;
            next_color += 1;
            (lane_idx, color)
        };

        let parents: Vec<String> = (0..commit.parent_count())
            .map(|i| commit.parent_id(i).unwrap().to_string())
            .collect();

        // Register parent edges — first parent continues the lane, others start new lanes
        for (i, parent_oid) in parents.iter().enumerate() {
            let (edge_lane, edge_color) = if i == 0 {
                // Continue in the same lane
                let existing = active_lanes
                    .iter()
                    .position(|s| s.as_ref().map_or(false, |(co, _)| co == parent_oid));
                if existing.is_none() {
                    // Claim slot back for first parent continuation
                    if lane < active_lanes.len() {
                        active_lanes[lane] = Some((parent_oid.clone(), color_index));
                        // Remove from free if we just put it back
                        free_lanes.retain(|&fl| fl != lane);
                    }
                }
                (lane, color_index)
            } else {
                // Merge parent — allocate a new lane
                let merge_lane = if let Some(free) = free_lanes.pop() {
                    free
                } else {
                    let idx = active_lanes.len();
                    active_lanes.push(None);
                    idx
                };
                let merge_color = next_color;
                next_color += 1;
                if merge_lane < active_lanes.len() {
                    active_lanes[merge_lane] = Some((parent_oid.clone(), merge_color));
                    free_lanes.retain(|&fl| fl != merge_lane);
                }
                (merge_lane, merge_color)
            };

            let parent_position = oids.iter().position(|o| &o.to_string() == parent_oid);
            if parent_position.is_some() {
                edges.push(GraphEdge {
                    from_oid: oid_str.clone(),
                    to_oid: parent_oid.clone(),
                    from_lane: lane,
                    to_lane: edge_lane,
                    color_index: edge_color,
                });
            }
        }

        let author = commit.author();
        let refs = ref_map.get(&oid_str).cloned().unwrap_or_default();

        // Deduplicate refs
        let mut unique_refs = refs;
        unique_refs.dedup();

        nodes.push(GraphNode {
            oid: oid_str,
            summary: commit.summary().unwrap_or("").to_string(),
            author_name: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parents,
            lane,
            color_index: color_index % 12,
            is_merge: commit.parent_count() > 1,
            refs: unique_refs,
        });
    }

    let total_lanes = active_lanes.iter().filter(|s| s.is_some()).count().max(
        nodes.iter().map(|n| n.lane + 1).max().unwrap_or(1)
    );

    Ok(GraphPage {
        nodes,
        edges,
        total_lanes,
        has_more,
    })
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

    let stats = if commit.parent_count() == 0 {
        let tree = commit.tree()?;
        let diff = repo.diff_tree_to_tree(None, Some(&tree), None)?;
        let s = diff.stats()?;
        DiffStats {
            files_changed: s.files_changed(),
            insertions: s.insertions(),
            deletions: s.deletions(),
        }
    } else {
        let parent_tree = commit.parent(0)?.tree()?;
        let tree = commit.tree()?;
        let diff = repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), None)?;
        let s = diff.stats()?;
        DiffStats {
            files_changed: s.files_changed(),
            insertions: s.insertions(),
            deletions: s.deletions(),
        }
    };

    let author = commit.author();
    let committer = commit.committer();
    let parents = (0..commit.parent_count())
        .map(|i| commit.parent_id(i).unwrap().to_string())
        .collect();

    Ok(CommitDetail {
        oid: oid_str.to_string(),
        summary: commit.summary().unwrap_or("").to_string(),
        body: commit.body().map(|s| s.to_string()),
        author_name: author.name().unwrap_or("").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        committer_name: committer.name().unwrap_or("").to_string(),
        committer_email: committer.email().unwrap_or("").to_string(),
        timestamp: commit.time().seconds(),
        committer_timestamp: committer.when().seconds(),
        parents,
        stats,
    })
}
