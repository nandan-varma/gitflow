import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { ipc } from "../lib/ipc";
import { queryClient, queryKeys } from "../lib/queryClient";
import { useRepoStore } from "../store/repoStore";
import { useIpcEvent } from "./useIpcEvent";

export function useRepoInfo() {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath);

  return useQuery({
    queryKey: queryKeys.repoInfo,
    queryFn: () => ipc.getCurrentRepoInfo(),
    enabled: !!currentRepoPath,
  });
}

export function useRepoChangeListener() {
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["status"] });
    queryClient.invalidateQueries({ queryKey: ["branches"] });
    queryClient.invalidateQueries({ queryKey: ["stashes"] });
    queryClient.invalidateQueries({ queryKey: ["repo"] });
    queryClient.invalidateQueries({ queryKey: ["graph"] });
    queryClient.invalidateQueries({ queryKey: ["diff"] });
    queryClient.invalidateQueries({ queryKey: ["conflicts"] });
  }, []);

  useIpcEvent("repo-changed", invalidateAll);
}
