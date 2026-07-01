import { create } from "zustand";
import { ipc, toErrMsg } from "../lib/ipc";
import type { RepoInfo } from "../types/git";

interface RepoStore {
  currentRepoPath: string | null;
  repoInfo: RepoInfo | null;
  recentRepos: string[];
  isOpening: boolean;
  openError: string | null;
  openRepository: (path: string) => Promise<void>;
  setRepoInfo: (info: RepoInfo) => void;
  closeRepository: () => void;
  addRecentRepo: (path: string) => void;
}

const RECENT_REPOS_KEY = "gitflow:recent-repos";

function loadRecentRepos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_REPOS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentRepos(repos: string[]) {
  localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos));
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  currentRepoPath: null,
  repoInfo: null,
  recentRepos: loadRecentRepos(),
  isOpening: false,
  openError: null,

  openRepository: async (path: string) => {
    set({ isOpening: true, openError: null });
    try {
      const info = await ipc.openRepository(path);
      set({ currentRepoPath: info.path, repoInfo: info, isOpening: false });
      get().addRecentRepo(info.path);
    } catch (e: unknown) {
      set({ isOpening: false, openError: toErrMsg(e) });
      throw e;
    }
  },

  setRepoInfo: (info: RepoInfo) => set({ repoInfo: info }),

  closeRepository: () => set({ currentRepoPath: null, repoInfo: null }),

  addRecentRepo: (path: string) => {
    const recent = [path, ...get().recentRepos.filter((r) => r !== path)].slice(0, 10);
    set({ recentRepos: recent });
    saveRecentRepos(recent);
  },
}));
