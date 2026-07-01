export interface GraphNode {
  oid: string;
  summary: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parents: string[];
  lane: number;
  color_index: number;
  is_merge: boolean;
  refs: string[];
}

export interface GraphEdge {
  from_oid: string;
  to_oid: string;
  from_lane: number;
  to_lane: number;
  color_index: number;
}

export interface GraphPage {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_lanes: number;
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
