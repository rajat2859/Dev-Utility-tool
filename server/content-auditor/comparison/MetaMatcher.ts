import type { MetaCheck } from '../types/report';
import { compareTextSimilarity } from './TextMatcher';

const LABELS = {
  title: /^\s*(?:(?:meta|seo|page)\s+)?title(?:\s+tag)?\s*(?:\(\s*\d+\s*chars?\s*\))?\s*[:\-–|]\s*(.*)$/i,
  description: /^\s*(?:(?:meta|seo|page)\s+)?desc(?:ription|\.)?\s*(?:\(\s*\d+\s*chars?\s*\))?\s*[:\-–|]\s*(.*)$/i,
};

function findLabeled(docLines: string[], label: RegExp): string {
  for (let i = 0; i < docLines.length; i++) {
    const m = docLines[i].match(label);
    if (!m) continue;
    const value = m[1].trim() || docLines.slice(i + 1).find((l) => l.trim())?.trim() || '';
    return value.replace(/\s*\(\s*\d+\s*chars?\s*\)\s*$/i, '').trim();
  }
  return '';
}

export function auditMeta(docLines: string[], field: keyof typeof LABELS, actual = ''): MetaCheck {
  const expected = findLabeled(docLines, LABELS[field]);
  if (!expected) return { field, expected, actual, status: 'NOT_IN_DOC' };
  if (!actual.trim()) return { field, expected, actual, status: 'MISSING_ON_PAGE' };
  const { status } = compareTextSimilarity(expected, actual);
  return { field, expected, actual, status: status === 'EXACT' ? 'MATCH' : status === 'NEAR_EXACT' ? 'NEAR_MATCH' : 'MISMATCH' };
}
