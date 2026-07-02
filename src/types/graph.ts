export interface GraphNode {
  oid: string;
  summary: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parents: string[];
  is_merge: boolean;
  refs: string[];
}

export interface GraphPage {
  nodes: GraphNode[];
  has_more: boolean;
}

export interface ChangedFile {
  path: string;
  old_path: string | null;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

export interface CommitDetail {
  oid: string;
  summary: string;
  body: string | null;
  author_name: string;
  author_email: string;
  committer_name: string;
  committer_email: string;
  timestamp: number;
  committer_timestamp: number;
  parents: string[];
  stats: {
    files_changed: number;
    insertions: number;
    deletions: number;
  };
  changed_files: ChangedFile[];
}

export interface FileHistoryEntry {
  oid: string;
  summary: string;
  author_name: string;
  timestamp: number;
}
