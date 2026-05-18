import { useQuery, useMutation } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryClient, queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";

export function useBranches() {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);
  return useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => ipc.listBranches(),
    enabled: !!currentRepoPath,
  });
}

export function useSwitchBranch() {
  return useMutation({
    mutationFn: (name: string) => ipc.switchBranch(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["repo"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

export function useCreateBranch() {
  return useMutation({
    mutationFn: ({ name, fromOid }: { name: string; fromOid?: string }) =>
      ipc.createBranch(name, fromOid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

export function useDeleteBranch() {
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force: boolean }) =>
      ipc.deleteBranch(name, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

export function useMergeBranch() {
  return useMutation({
    mutationFn: (name: string) => ipc.mergeBranch(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["repo"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
    },
  });
}
