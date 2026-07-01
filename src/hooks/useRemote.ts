import { useMutation } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryClient } from "../lib/queryClient";

function invalidateAfterRemote() {
  queryClient.invalidateQueries({ queryKey: ["branches"] });
  queryClient.invalidateQueries({ queryKey: ["repo"] });
  queryClient.invalidateQueries({ queryKey: ["graph"] });
}

export function useFetch() {
  return useMutation({
    mutationFn: () => ipc.gitFetch(),
    onSuccess: invalidateAfterRemote,
  });
}

export function usePush() {
  return useMutation({
    mutationFn: ({ branch, setUpstream }: { branch: string; setUpstream: boolean }) =>
      ipc.gitPush(branch, setUpstream),
    onSuccess: invalidateAfterRemote,
  });
}

export function usePull() {
  return useMutation({
    mutationFn: () => ipc.gitPull(),
    onSuccess: invalidateAfterRemote,
  });
}
