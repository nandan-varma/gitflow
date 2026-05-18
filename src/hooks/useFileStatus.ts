import { useQuery } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";
import { queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";

export function useFileStatus() {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);

  return useQuery({
    queryKey: queryKeys.status,
    queryFn: () => ipc.getStatus(),
    enabled: !!currentRepoPath,
    refetchInterval: false,
  });
}
