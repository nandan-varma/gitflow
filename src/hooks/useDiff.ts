import { useQuery } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";

export function useDiffWorkdir(path: string | null) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.diffWorkdir(path ?? ""),
    queryFn: () => ipc.getDiffWorkdir(path!),
    enabled: !!currentRepoPath && !!path,
  });
}

export function useDiffStaged(path: string | null) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.diffStaged(path ?? ""),
    queryFn: () => ipc.getDiffStaged(path!),
    enabled: !!currentRepoPath && !!path,
  });
}

export function useDiffCommit(oid: string | null, path: string | null) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.diffCommit(oid ?? "", path ?? ""),
    queryFn: () => ipc.getDiffCommit(oid!, path!),
    enabled: !!currentRepoPath && !!oid && !!path,
  });
}
