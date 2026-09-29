import type { DiffWord } from '../types/report';

/**
 * Computes deterministic word-level differences between expected and actual text using LCS.
 */
export function computeWordDiff(expected: string, actual: string, caseSensitive = false): DiffWord[] {
  const comparisonKey = (word: string) => (caseSensitive ? word : word.toLowerCase());
  const expWords = expected.trim().split(/\s+/).filter(Boolean);
  const actWords = actual.trim().split(/\s+/).filter(Boolean);

  if (expWords.length === 0 && actWords.length === 0) {
    return [];
  }
  if (expWords.length === 0) {
    return actWords.map((w) => ({ value: w, added: true }));
  }
  if (actWords.length === 0) {
    return expWords.map((w) => ({ value: w, removed: true }));
  }

  // Build standard LCS matrix on normalized lowercase word tokens
  const n = expWords.length;
  const m = actWords.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const w1 = comparisonKey(expWords[i - 1]);
    for (let j = 1; j <= m; j++) {
      const w2 = comparisonKey(actWords[j - 1]);
      if (w1 === w2) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to assemble diff words
  const result: DiffWord[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && comparisonKey(expWords[i - 1]) === comparisonKey(actWords[j - 1])) {
      result.unshift({ value: actWords[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ value: actWords[j - 1], added: true });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({ value: expWords[i - 1], removed: true });
      i--;
    }
  }

  return result;
}
