export interface PRAuthor {
  login: string;
}

export interface PRReview {
  author: PRAuthor;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
}

export interface PRCheckRollup {
  state: "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | null;
}

export interface PullRequest {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  headRefName: string;
  baseRefName: string;
  author: PRAuthor;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  isDraft: boolean;
  createdAt: string;
  url: string;
  statusCheckRollup: PRCheckRollup[] | null;
}

export interface PullRequestDetail extends PullRequest {
  body: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  latestReviews: PRReview[];
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: string;
  labels: { name: string; color: string }[];
}

export interface IssueLabel {
  name: string;
  color: string;
}

export interface IssueAssignee {
  login: string;
}

export interface Issue {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED";
  author: PRAuthor;
  labels: IssueLabel[];
  assignees: IssueAssignee[];
  createdAt: string;
  url: string;
  comments: number;
}

export interface IssueDetail extends Omit<Issue, "comments"> {
  body: string;
}

export type PRState = "open" | "closed" | "merged" | "all";
export type IssueState = "open" | "closed" | "all";
export type ActivityType = "both" | "prs" | "issues";

export type ActivityItem =
  | { kind: "pr"; data: PullRequest }
  | { kind: "issue"; data: Issue };
