import { invoke } from "@tauri-apps/api/core";

export const toErrMsg = (e: unknown): string =>
  e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
import type { RepoInfo, FileStatus, BranchInfo, StashEntry, MergeResult, ConflictEntry, ConflictDetail, TagEntry, RebaseOutcome } from "../types/git";
import type { FileDiff, DiffLine } from "../types/diff";
import type { GraphPage, CommitDetail } from "../types/graph";

export const ipc = {
  // Repo
  openRepository: (path: string) =>
    invoke<RepoInfo>("open_repository", { path }),

  getCurrentRepoInfo: () =>
    invoke<RepoInfo>("get_current_repo_info"),

  getStatus: () =>
    invoke<FileStatus[]>("cmd_get_status"),

  // Graph
  getCommitGraph: (limit: number, offset: number) =>
    invoke<GraphPage>("cmd_get_commit_graph", { limit, offset }),

  getCommitDetail: (oid: string) =>
    invoke<CommitDetail>("cmd_get_commit_detail", { oid }),

  // Diff
  getDiffWorkdir: (path: string) =>
    invoke<FileDiff>("cmd_get_diff_workdir", { path }),

  getDiffStaged: (path: string) =>
    invoke<FileDiff>("cmd_get_diff_staged", { path }),

  getDiffCommit: (oid: string, path: string) =>
    invoke<FileDiff>("cmd_get_diff_commit", { oid, path }),

  // Staging
  stageFile: (path: string) =>
    invoke<void>("cmd_stage_file", { path }),

  unstageFile: (path: string) =>
    invoke<void>("cmd_unstage_file", { path }),

  stageHunk: (path: string, lines: DiffLine[]) =>
    invoke<void>("cmd_stage_hunk", { path, lines }),

  unstageHunk: (path: string, lines: DiffLine[]) =>
    invoke<void>("cmd_unstage_hunk", { path, lines }),

  discardChanges: (path: string) =>
    invoke<void>("cmd_discard_changes", { path }),

  // Commit
  createCommit: (message: string) =>
    invoke<string>("cmd_create_commit", { message }),

  amendCommit: (message?: string) =>
    invoke<string>("cmd_amend_commit", { message }),

  // Branches
  listBranches: () =>
    invoke<BranchInfo[]>("cmd_list_branches"),

  createBranch: (name: string, fromOid?: string) =>
    invoke<void>("cmd_create_branch", { name, fromOid: fromOid ?? null }),

  switchBranch: (name: string) =>
    invoke<void>("cmd_switch_branch", { name }),

  deleteBranch: (name: string, force: boolean) =>
    invoke<void>("cmd_delete_branch", { name, force }),

  mergeBranch: (name: string) =>
    invoke<MergeResult>("cmd_merge_branch", { name }),

  abortMerge: () =>
    invoke<void>("cmd_abort_merge"),

  rebaseBranch: (upstream: string) =>
    invoke<RebaseOutcome>("cmd_rebase_branch", { upstream }),

  continueRebase: () =>
    invoke<RebaseOutcome>("cmd_continue_rebase"),

  abortRebase: () =>
    invoke<void>("cmd_abort_rebase"),

  listTags: () =>
    invoke<TagEntry[]>("cmd_list_tags"),

  // Stash
  listStashes: () =>
    invoke<StashEntry[]>("cmd_list_stashes"),

  stashPush: (message?: string, includeUntracked = false) =>
    invoke<void>("cmd_stash_push", { message: message ?? null, includeUntracked }),

  stashApply: (index: number) =>
    invoke<void>("cmd_stash_apply", { index }),

  stashPop: (index: number) =>
    invoke<void>("cmd_stash_pop", { index }),

  stashDrop: (index: number) =>
    invoke<void>("cmd_stash_drop", { index }),

  // Conflicts
  getConflicts: () =>
    invoke<ConflictEntry[]>("cmd_get_conflicts"),

  getConflictDetail: (path: string) =>
    invoke<ConflictDetail>("cmd_get_conflict_detail", { path }),

  resolveConflict: (path: string, resolution: string) =>
    invoke<void>("cmd_resolve_conflict", { path, resolution }),
};
