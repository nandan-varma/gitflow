export type MenuItem =
  | { label: string; action: () => void; danger?: boolean }
  | "separator";
