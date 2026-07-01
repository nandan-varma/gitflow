import { useMutation, useQuery } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryClient, queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";
import type { DiffLine } from "../types/diff";

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

export function useBlame(path: string | null) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.blame(path ?? ""),
    queryFn: () => ipc.getBlame(path!),
    enabled: !!currentRepoPath && !!path,
  });
}

export function useFileHistory(path: string | null, limit = 100) {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.fileHistory(path ?? ""),
    queryFn: () => ipc.getFileHistory(path!, limit),
    enabled: !!currentRepoPath && !!path,
  });
}

export function useDiscardLines() {
  return useMutation({
    mutationFn: ({ path, lines }: { path: string; lines: DiffLine[] }) =>
      ipc.discardLines(path, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["diff"] });
    },
  });
}
