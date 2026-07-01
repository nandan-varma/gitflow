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
