import { useQuery, useMutation } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryClient, queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";

export function useStashes() {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.stashes,
    queryFn: () => ipc.listStashes(),
    enabled: !!currentRepoPath,
  });
}

export function useStashPush() {
  return useMutation({
    mutationFn: ({ message, includeUntracked }: { message?: string; includeUntracked: boolean }) =>
      ipc.stashPush(message, includeUntracked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stashes"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });
}

export function useStashPop() {
  return useMutation({
    mutationFn: (index: number) => ipc.stashPop(index),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stashes"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });
}

export function useStashApply() {
  return useMutation({
    mutationFn: (index: number) => ipc.stashApply(index),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["stashes"] });
    },
  });
}

export function useStashDrop() {
  return useMutation({
    mutationFn: (index: number) => ipc.stashDrop(index),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stashes"] });
    },
  });
}
