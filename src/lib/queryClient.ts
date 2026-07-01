import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  repoInfo: ["repo", "info"] as const,
  status: ["status"] as const,
  branches: ["branches"] as const,
  tags: ["tags"] as const,
  stashes: ["stashes"] as const,
  conflicts: ["conflicts"] as const,
  graph: (limit: number, offset: number) => ["graph", limit, offset] as const,
  commitDetail: (oid: string) => ["graph", "commit", oid] as const,
  diffWorkdir: (path: string) => ["diff", "workdir", path] as const,
  diffStaged: (path: string) => ["diff", "staged", path] as const,
  diffCommit: (oid: string, path: string) => ["diff", "commit", oid, path] as const,
  conflictDetail: (path: string) => ["conflict", path] as const,
  pullRequests: (state: string) => ["github", "prs", state] as const,
  pullRequestDetail: (number: number) => ["github", "pr", number] as const,
  issues: (state: string) => ["github", "issues", state] as const,
  issueDetail: (number: number) => ["github", "issue", number] as const,
  fileHistory: (path: string) => ["file-history", path] as const,
  blame: (path: string) => ["blame", path] as const,
};
