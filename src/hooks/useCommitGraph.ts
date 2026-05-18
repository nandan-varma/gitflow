import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";

const PAGE_SIZE = 200;

export function useCommitGraph() {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);

  return useInfiniteQuery({
    queryKey: queryKeys.graph(PAGE_SIZE, 0),
    queryFn: ({ pageParam = 0 }) =>
      ipc.getCommitGraph(PAGE_SIZE, pageParam as number),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: !!currentRepoPath,
  });
}

export function useCommitDetail(oid: string | null) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);

  return useQuery({
    queryKey: queryKeys.commitDetail(oid ?? ""),
    queryFn: () => ipc.getCommitDetail(oid!),
    enabled: !!currentRepoPath && !!oid,
  });
}
