import { useQuery, useMutation } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryClient, queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";
import type { PullRequest, PullRequestDetail, Issue, IssueDetail } from "../types/github";

export function usePullRequests(prState = "open", enabled = true) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.pullRequests(prState),
    queryFn: async () => {
      const json = await ipc.ghPrList(prState);
      return JSON.parse(json) as PullRequest[];
    },
    enabled: enabled && !!currentRepoPath,
    staleTime: 60_000,
    retry: false,
  });
}

export function usePullRequestDetail(number: number | null) {
  return useQuery({
    queryKey: queryKeys.pullRequestDetail(number ?? 0),
    queryFn: async () => {
      const json = await ipc.ghPrView(number!);
      return JSON.parse(json) as PullRequestDetail;
    },
    enabled: number !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useIssues(issueState = "open", enabled = true) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.issues(issueState),
    queryFn: async () => {
      const json = await ipc.ghIssueList(issueState);
      return JSON.parse(json) as Issue[];
    },
    enabled: enabled && !!currentRepoPath,
    staleTime: 60_000,
    retry: false,
  });
}

export function useIssueDetail(number: number | null) {
  return useQuery({
    queryKey: queryKeys.issueDetail(number ?? -1),
    queryFn: async () => {
      const json = await ipc.ghIssueView(number!);
      return JSON.parse(json) as IssueDetail;
    },
    enabled: number !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreatePR() {
  return useMutation({
    mutationFn: ({ title, body, base, draft }: { title: string; body: string; base: string; draft: boolean }) =>
      ipc.ghPrCreate(title, body, base, draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["github", "prs"] }),
  });
}

export function useCheckoutPR() {
  return useMutation({
    mutationFn: (number: number) => ipc.ghPrCheckout(number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["repo"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

export function useOpenPR() {
  return useMutation({ mutationFn: (number: number) => ipc.ghPrOpen(number) });
}

export function useMergePR() {
  return useMutation({
    mutationFn: ({ number, strategy, deleteBranch }: { number: number; strategy: string; deleteBranch: boolean }) =>
      ipc.ghPrMerge(number, strategy, deleteBranch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github", "prs"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

export function useOpenIssue() {
  return useMutation({ mutationFn: (number: number) => ipc.ghIssueOpen(number) });
}

export function useCreateIssueWeb() {
  return useMutation({ mutationFn: () => ipc.ghIssueCreateWeb() });
}
