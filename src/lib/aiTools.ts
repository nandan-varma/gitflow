import type OpenAI from "openai";
import { ipc } from "./ipc";
import { queryClient } from "./queryClient";

// OpenAI-compatible tool definitions mapping 1:1 onto ipc.* — the AI goes
// through the same code path as the UI (command log, watcher, etc.).

const str = (description: string) => ({ type: "string" as const, description });
const num = (description: string) => ({ type: "number" as const, description });
const bool = (description: string) => ({ type: "boolean" as const, description });

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): OpenAI.ChatCompletionTool {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

export const tools: OpenAI.ChatCompletionTool[] = [
  // Repo / status
  tool("get_repo_info", "Get the currently open repository: path, current branch, and state (clean/merge/rebase). Call this first when you need context."),
  tool("get_status", "List working-directory and staged file changes (path, status, staged flag)."),

  // History
  tool("get_commit_graph", "Get a page of the commit history graph.", { limit: num("Max commits to return, e.g. 30"), offset: num("Number of commits to skip, 0 for the newest") }, ["limit", "offset"]),
  tool("get_commit_detail", "Get full details of one commit (message, author, changed files).", { oid: str("Commit SHA") }, ["oid"]),

  // Diffs
  tool("get_diff_workdir", "Get the unstaged diff of a file in the working directory.", { path: str("File path relative to repo root") }, ["path"]),
  tool("get_diff_staged", "Get the staged (index) diff of a file.", { path: str("File path relative to repo root") }, ["path"]),
  tool("get_diff_commit", "Get the diff of a file as changed in a specific commit.", { oid: str("Commit SHA"), path: str("File path relative to repo root") }, ["oid", "path"]),

  // Staging
  tool("stage_file", "Stage a file (add to index).", { path: str("File path relative to repo root") }, ["path"]),
  tool("unstage_file", "Unstage a file (remove from index, keep changes).", { path: str("File path relative to repo root") }, ["path"]),
  tool("discard_changes", "DESTRUCTIVE: permanently discard all unstaged changes to a file.", { path: str("File path relative to repo root") }, ["path"]),

  // Commits
  tool("create_commit", "Create a commit from currently staged changes.", { message: str("Commit message") }, ["message"]),
  tool("amend_commit", "Amend the last commit with staged changes and optionally a new message.", { message: str("New commit message; omit to keep the existing one") }),
  tool("cherry_pick", "Cherry-pick a commit onto the current branch. May report conflicts.", { oid: str("Commit SHA to cherry-pick") }, ["oid"]),
  tool("cherry_pick_continue", "Continue a cherry-pick after conflicts were resolved.", { oid: str("SHA of the commit being cherry-picked") }, ["oid"]),
  tool("cherry_pick_abort", "Abort an in-progress cherry-pick, discarding its conflict state."),

  // Branches
  tool("list_branches", "List local and remote branches with upstream/ahead-behind info."),
  tool("create_branch", "Create a new branch.", { name: str("Branch name"), fromOid: str("Commit SHA to branch from; omit for HEAD") }, ["name"]),
  tool("switch_branch", "Check out an existing branch.", { name: str("Branch name") }, ["name"]),
  tool("delete_branch", "DESTRUCTIVE: delete a local branch.", { name: str("Branch name"), force: bool("Force-delete even if unmerged") }, ["name", "force"]),
  tool("merge_branch", "Merge a branch into the current branch. May report conflicts.", { name: str("Branch to merge in") }, ["name"]),
  tool("abort_merge", "Abort an in-progress merge, discarding its conflict state."),
  tool("rebase_branch", "Rebase the current branch onto an upstream branch. May report conflicts.", { upstream: str("Branch to rebase onto") }, ["upstream"]),
  tool("continue_rebase", "Continue an in-progress rebase after conflicts were resolved."),
  tool("abort_rebase", "Abort an in-progress rebase, restoring the pre-rebase state."),

  // Tags
  tool("list_tags", "List tags in the repository."),
  tool("create_tag", "Create a tag at a commit.", { name: str("Tag name"), oid: str("Commit SHA to tag"), message: str("Annotation message; omit for a lightweight tag") }, ["name", "oid"]),

  // Stash
  tool("list_stashes", "List stash entries."),
  tool("stash_push", "Stash current changes.", { message: str("Stash description; optional"), includeUntracked: bool("Also stash untracked files") }),
  tool("stash_apply", "Apply a stash without removing it.", { index: num("Stash index, 0 is the newest") }, ["index"]),
  tool("stash_pop", "Apply a stash and remove it on success.", { index: num("Stash index, 0 is the newest") }, ["index"]),
  tool("stash_drop", "DESTRUCTIVE: delete a stash entry permanently.", { index: num("Stash index, 0 is the newest") }, ["index"]),

  // Conflicts
  tool("get_conflicts", "List files currently in conflict."),
  tool("get_conflict_detail", "Get ours/theirs/base content for a conflicted file.", { path: str("Conflicted file path") }, ["path"]),
  tool("resolve_conflict", "Write the resolved content for a conflicted file and mark it resolved. Overwrites the file.", { path: str("Conflicted file path"), resolution: str("Full resolved file content") }, ["path", "resolution"]),

  // Remote (git CLI)
  tool("git_fetch", "Fetch from the remote."),
  tool("git_push", "Push a branch to the remote.", { branch: str("Branch name to push"), setUpstream: bool("Set upstream tracking (-u), needed for new branches") }, ["branch", "setUpstream"]),
  tool("git_pull", "Pull from the remote.", { rebase: bool("Pull with rebase instead of merge; default true") }),

  // GitHub (gh CLI)
  tool("gh_pr_list", "List GitHub pull requests. Returns JSON from the gh CLI.", { prState: str("One of: open, closed, merged, all") }, ["prState"]),
  tool("gh_pr_view", "View one GitHub pull request in detail.", { number: num("PR number") }, ["number"]),
  tool("gh_pr_create", "Create a GitHub pull request from the current branch.", { title: str("PR title"), body: str("PR body markdown"), base: str("Base branch, e.g. main"), draft: bool("Create as draft") }, ["title", "body", "base", "draft"]),
  tool("gh_pr_checkout", "Check out a pull request's branch locally.", { number: num("PR number") }, ["number"]),
  tool("gh_pr_merge", "DESTRUCTIVE: merge a pull request on GitHub.", { number: num("PR number"), strategy: str("One of: merge, squash, rebase"), deleteBranch: bool("Delete the branch after merging") }, ["number", "strategy", "deleteBranch"]),
  tool("gh_issue_list", "List GitHub issues. Returns JSON from the gh CLI.", { issueState: str("One of: open, closed, all") }, ["issueState"]),
  tool("gh_issue_view", "View one GitHub issue in detail.", { number: num("Issue number") }, ["number"]),
];

// Tools that pause for an explicit user Approve/Deny in the chat UI.
export const DANGEROUS_TOOLS = new Set([
  "discard_changes",
  "amend_commit",      // rewrites published history
  "merge_branch",      // modifies branch structure, may be irreversible
  "delete_branch",
  "stash_drop",
  "git_push",
  "gh_pr_merge",
  "abort_merge",
  "abort_rebase",
  "cherry_pick_abort",
  "resolve_conflict",
]);

const READ_ONLY_TOOLS = new Set([
  "get_repo_info", "get_status", "get_commit_graph", "get_commit_detail",
  "get_diff_workdir", "get_diff_staged", "get_diff_commit",
  "list_branches", "list_tags", "list_stashes", "get_conflicts", "get_conflict_detail",
  "gh_pr_list", "gh_pr_view", "gh_issue_list", "gh_issue_view",
]);

/* eslint-disable @typescript-eslint/no-explicit-any */
const executors: Record<string, (a: any) => Promise<unknown>> = {
  get_repo_info: () => ipc.getCurrentRepoInfo(),
  get_status: () => ipc.getStatus(),
  get_commit_graph: (a) => ipc.getCommitGraph(a.limit, a.offset),
  get_commit_detail: (a) => ipc.getCommitDetail(a.oid),
  get_diff_workdir: (a) => ipc.getDiffWorkdir(a.path),
  get_diff_staged: (a) => ipc.getDiffStaged(a.path),
  get_diff_commit: (a) => ipc.getDiffCommit(a.oid, a.path),
  stage_file: (a) => ipc.stageFile(a.path),
  unstage_file: (a) => ipc.unstageFile(a.path),
  discard_changes: (a) => ipc.discardChanges(a.path),
  create_commit: (a) => ipc.createCommit(a.message),
  amend_commit: (a) => ipc.amendCommit(a.message),
  cherry_pick: (a) => ipc.cherryPick(a.oid),
  cherry_pick_continue: (a) => ipc.cherryPickContinue(a.oid),
  cherry_pick_abort: () => ipc.cherryPickAbort(),
  list_branches: () => ipc.listBranches(),
  create_branch: (a) => ipc.createBranch(a.name, a.fromOid),
  switch_branch: (a) => ipc.switchBranch(a.name),
  delete_branch: (a) => ipc.deleteBranch(a.name, a.force),
  merge_branch: (a) => ipc.mergeBranch(a.name),
  abort_merge: () => ipc.abortMerge(),
  rebase_branch: (a) => ipc.rebaseBranch(a.upstream),
  continue_rebase: () => ipc.continueRebase(),
  abort_rebase: () => ipc.abortRebase(),
  list_tags: () => ipc.listTags(),
  create_tag: (a) => ipc.createTag(a.name, a.oid, a.message),
  list_stashes: () => ipc.listStashes(),
  stash_push: (a) => ipc.stashPush(a.message, a.includeUntracked ?? false),
  stash_apply: (a) => ipc.stashApply(a.index),
  stash_pop: (a) => ipc.stashPop(a.index),
  stash_drop: (a) => ipc.stashDrop(a.index),
  get_conflicts: () => ipc.getConflicts(),
  get_conflict_detail: (a) => ipc.getConflictDetail(a.path),
  resolve_conflict: (a) => ipc.resolveConflict(a.path, a.resolution),
  git_fetch: () => ipc.gitFetch(),
  git_push: (a) => ipc.gitPush(a.branch, a.setUpstream),
  git_pull: (a) => ipc.gitPull(a.rebase ?? true),
  gh_pr_list: (a) => ipc.ghPrList(a.prState),
  gh_pr_view: (a) => ipc.ghPrView(a.number),
  gh_pr_create: (a) => ipc.ghPrCreate(a.title, a.body, a.base, a.draft),
  gh_pr_checkout: (a) => ipc.ghPrCheckout(a.number),
  gh_pr_merge: (a) => ipc.ghPrMerge(a.number, a.strategy, a.deleteBranch),
  gh_issue_list: (a) => ipc.ghIssueList(a.issueState),
  gh_issue_view: (a) => ipc.ghIssueView(a.number),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const MAX_RESULT_CHARS = 20000; // ponytail: hard truncation, paginate via tool args if it ever matters

export async function executeTool(name: string, args: unknown): Promise<string> {
  const fn = executors[name];
  if (!fn) return `Error: unknown tool "${name}"`;
  const result = await fn(args ?? {});
  if (!READ_ONLY_TOOLS.has(name)) {
    // Blanket invalidation — same effect the .git watcher produces on external changes.
    queryClient.invalidateQueries();
  }
  const text = result === undefined || result === null ? "ok" : JSON.stringify(result);
  return text.length > MAX_RESULT_CHARS
    ? text.slice(0, MAX_RESULT_CHARS) + `\n…[truncated, ${text.length} chars total]`
    : text;
}
