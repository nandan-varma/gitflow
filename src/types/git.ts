export interface RepoInfo {
  path: string;
  head_branch: string | null;
  head_oid: string | null;
  is_bare: boolean;
  is_empty: boolean;
  state: string;
}

export interface FileStatus {
  path: string;
  old_path: string | null;
  status: "added" | "modified" | "deleted" | "renamed" | "conflict";
  staged: boolean;
  unstaged: boolean;
  conflict: boolean;
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  is_remote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  oid: string;
}

export interface StashEntry {
  index: number;
  message: string;
  oid: string;
  timestamp: number;
}

export interface MergeResult {
  fast_forwarded: boolean;
  committed: boolean;
  has_conflicts: boolean;
}

export interface ConflictEntry {
  path: string;
  conflict_count: number;
}

export interface ConflictBlock {
  ours_lines: string[];
  theirs_lines: string[];
  before_lines: string[];
}

export interface ConflictDetail {
  path: string;
  ours: string;
  theirs: string;
  base: string | null;
  conflicts: ConflictBlock[];
  trailing_lines: string[];
}

export interface TagEntry {
  name: string;
  target_oid: string;
  is_annotated: boolean;
  message: string | null;
}

export type CherryPickOutcome =
  | { type: "Success"; oid: string }
  | { type: "Conflicts" };

export type RebaseOutcome =
  | { type: "Success" }
  | { type: "Conflicts"; current_step: number; total_steps: number };

export interface CommandLogEntry {
  id: string;
  command: string;
  timestamp: number;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
}
