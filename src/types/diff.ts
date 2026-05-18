export interface DiffLine {
  origin: string; // '+' | '-' | ' ' | '\\'
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface HunkStats {
  additions: number;
  deletions: number;
}

export interface FileDiff {
  path: string;
  old_path: string | null;
  is_binary: boolean;
  hunks: DiffHunk[];
  stats: HunkStats;
}

export interface WordChange {
  type: "add" | "remove" | "equal";
  text: string;
}
