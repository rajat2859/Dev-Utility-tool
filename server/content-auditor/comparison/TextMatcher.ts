import { canonicalize, normalizeText, tokenizeWords } from '../reference/ReferenceNormalizer';
import type { BlockComparisonStatus } from '../types/report';

export interface MatchScoreResult {
  similarity: number; // 0.0 .. 1.0
  status: BlockComparisonStatus;
  exactNormalized: boolean;
}

/**
 * Standard Levenshtein distance with early-exit length optimizations
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const len1 = s1.length;
  const len2 = s2.length;

  let prevRow = new Array(len2 + 1);
  let currRow = new Array(len2 + 1);

  for (let j = 0; j <= len2; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    currRow[0] = i;
    const char1 = s1[i - 1];

    for (let j = 1; j <= len2; j++) {
      const cost = char1 === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,      // insertion
        prevRow[j] + 1,          // deletion
        prevRow[j - 1] + cost    // substitution
      );
    }

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[len2];
}

/**
 * Computes token Dice coefficient: 2 * |A ∩ B| / (|A| + |B|)
 */
export function diceTokenSimilarity(words1: string[], words2: string[]): number {
  if (words1.length === 0 && words2.length === 0) return 1.0;
  if (words1.length === 0 || words2.length === 0) return 0.0;

  const freq1 = new Map<string, number>();
  for (const w of words1) freq1.set(w, (freq1.get(w) || 0) + 1);

  let matches = 0;
  for (const w of words2) {
    const count = freq1.get(w) || 0;
    if (count > 0) {
      matches++;
      freq1.set(w, count - 1);
    }
  }

  return (2 * matches) / (words1.length + words2.length);
}

/**
 * Computes deterministic multi-signal similarity between two text snippets:
 * 1. Normalized exact match -> 1.0 (EXACT)
 * 2. Short texts (<15 chars): strict normalized edit distance
 * 3. Medium/Long texts: combination of token Dice similarity and Levenshtein similarity
 */
export function compareTextSimilarity(expected: string, actual: string): MatchScoreResult {
  const normExpected = normalizeText(expected);
  const normActual = normalizeText(actual);

  if (!normExpected && !normActual) {
    return { similarity: 1.0, status: 'EXACT', exactNormalized: true };
  }
  if (!normExpected || !normActual) {
    return { similarity: 0.0, status: 'MISMATCH', exactNormalized: false };
  }

  if (normExpected === normActual) {
    return { similarity: 1.0, status: 'EXACT', exactNormalized: true };
  }

  const canonExp = canonicalize(normExpected);
  const canonAct = canonicalize(normActual);

  if (canonExp === canonAct) {
    // Differs only by punctuation, smart quotes or case
    return { similarity: 0.99, status: 'NEAR_EXACT', exactNormalized: false };
  }

  // Length ratio filter (Fix 51)
  const maxLen = Math.max(canonExp.length, canonAct.length);
  const minLen = Math.min(canonExp.length, canonAct.length);
  const lengthRatio = minLen / maxLen;

  if (lengthRatio < 0.35 && Math.abs(canonExp.length - canonAct.length) > 20) {
    return { similarity: 0.2, status: 'MISMATCH', exactNormalized: false };
  }

  const expWords = tokenizeWords(canonExp);
  const actWords = tokenizeWords(canonAct);

  // For very short text (e.g. single word, navigation item), rely on character edit distance
  if (canonExp.length < 15 || expWords.length <= 2) {
    const dist = levenshteinDistance(canonExp, canonAct);
    const charSim = 1 - dist / maxLen;
    if (charSim >= 0.96) {
      return { similarity: charSim, status: 'NEAR_EXACT', exactNormalized: false };
    }
    if (charSim >= 0.85) {
      return { similarity: charSim, status: 'PARTIAL', exactNormalized: false };
    }
    return { similarity: Math.max(0, charSim), status: 'MISMATCH', exactNormalized: false };
  }

  // For medium to long text, blend token Dice and character similarity
  const tokenSim = diceTokenSimilarity(expWords, actWords);
  const dist = levenshteinDistance(canonExp, canonAct);
  const charSim = 1 - dist / maxLen;

  // 60% token similarity + 40% character similarity
  const combined = tokenSim * 0.6 + Math.max(0, charSim) * 0.4;
  const rounded = Math.round(combined * 100) / 100;

  if (rounded >= 0.96) {
    return { similarity: rounded, status: 'NEAR_EXACT', exactNormalized: false };
  }
  if (rounded >= 0.85) {
    return { similarity: rounded, status: 'PARTIAL', exactNormalized: false };
  }
  return { similarity: rounded, status: 'MISMATCH', exactNormalized: false };
}
