import { invoke } from "@tauri-apps/api/core";

export const toErrMsg = (e: unknown): string =>
  e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
import type { RepoInfo, FileStatus, BranchInfo, StashEntry, MergeResult, ConflictEntry, ConflictDetail, TagEntry, RebaseOutcome, CherryPickOutcome } from "../types/git";
import type { FileDiff, DiffLine, BlameLine } from "../types/diff";
import type { GraphPage, CommitDetail, FileHistoryEntry } from "../types/graph";

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

  // Graph extras
  getFileHistory: (path: string, limit: number) =>
    invoke<FileHistoryEntry[]>("cmd_get_file_history", { path, limit }),

  getBlame: (path: string) =>
    invoke<BlameLine[]>("cmd_get_blame", { path }),

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

  discardLines: (path: string, lines: DiffLine[]) =>
    invoke<void>("cmd_discard_lines", { path, lines }),

  // Commit
  createCommit: (message: string) =>
    invoke<string>("cmd_create_commit", { message }),

  amendCommit: (message?: string) =>
    invoke<string>("cmd_amend_commit", { message }),

  cherryPick: (oid: string) =>
    invoke<CherryPickOutcome>("cmd_cherry_pick", { oid }),

  cherryPickContinue: (oid: string) =>
    invoke<CherryPickOutcome>("cmd_cherry_pick_continue", { oid }),

  cherryPickAbort: () =>
    invoke<void>("cmd_cherry_pick_abort"),

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

  createTag: (name: string, oid: string, message?: string) =>
    invoke<void>("cmd_create_tag", { name, oid, message: message ?? null }),

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

  // Remote (git CLI)
  gitFetch: () =>
    invoke<string>("cmd_git_fetch"),

  gitPush: (branch: string, setUpstream: boolean) =>
    invoke<string>("cmd_git_push", { branch, setUpstream }),

  gitPull: (rebase = true) =>
    invoke<string>("cmd_git_pull", { rebase }),

  interactiveRebase: (base: string, steps: { action: string; oid: string; message: string }[]) =>
    invoke<string>("cmd_interactive_rebase", { base, steps }),

  // GitHub PRs (gh CLI)
  ghPrList: (prState: string) =>
    invoke<string>("cmd_gh_pr_list", { prState }),

  ghPrView: (number: number) =>
    invoke<string>("cmd_gh_pr_view", { number }),

  ghPrCreate: (title: string, body: string, base: string, draft: boolean) =>
    invoke<string>("cmd_gh_pr_create", { title, body, base, draft }),

  ghPrCheckout: (number: number) =>
    invoke<void>("cmd_gh_pr_checkout", { number }),

  ghPrOpen: (number: number) =>
    invoke<void>("cmd_gh_pr_open", { number }),

  ghPrMerge: (number: number, strategy: string, deleteBranch: boolean) =>
    invoke<void>("cmd_gh_pr_merge", { number, strategy, deleteBranch }),

  // GitHub Issues (gh CLI)
  ghIssueList: (issueState: string) =>
    invoke<string>("cmd_gh_issue_list", { issueState }),

  ghIssueView: (number: number) =>
    invoke<string>("cmd_gh_issue_view", { number }),

  ghIssueOpen: (number: number) =>
    invoke<void>("cmd_gh_issue_open", { number }),

  ghIssueCreateWeb: () =>
    invoke<void>("cmd_gh_issue_create_web"),

  // Opener (macOS external tools)
  openInVscode: (path: string) =>
    invoke<void>("cmd_open_in_vscode", { path }),

  revealInFinder: (path: string) =>
    invoke<void>("cmd_reveal_in_finder", { path }),

  openInTerminal: (path: string) =>
    invoke<void>("cmd_open_in_terminal", { path }),
};
