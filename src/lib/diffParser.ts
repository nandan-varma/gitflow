import type { DiffLine, WordChange } from "../types/diff";

export function computeWordDiff(before: string, after: string): { before: WordChange[]; after: WordChange[] } {
  const beforeWords = tokenize(before);
  const afterWords = tokenize(after);
  const lcs = computeLCS(beforeWords, afterWords);

  const beforeResult: WordChange[] = [];
  const afterResult: WordChange[] = [];

  let bi = 0, ai = 0, li = 0;

  while (bi < beforeWords.length || ai < afterWords.length) {
    if (bi < beforeWords.length && (li >= lcs.length || beforeWords[bi] !== lcs[li])) {
      beforeResult.push({ type: "remove", text: beforeWords[bi++] });
    } else if (ai < afterWords.length && (li >= lcs.length || afterWords[ai] !== lcs[li])) {
      afterResult.push({ type: "add", text: afterWords[ai++] });
    } else if (li < lcs.length) {
      const word = lcs[li++];
      beforeResult.push({ type: "equal", text: beforeWords[bi++] });
      afterResult.push({ type: "equal", text: afterWords[ai++] });
    }
  }

  return { before: beforeResult, after: afterResult };
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / 86400 / 30)}mo ago`;
  return `${Math.floor(diff / 86400 / 365)}y ago`;
}
