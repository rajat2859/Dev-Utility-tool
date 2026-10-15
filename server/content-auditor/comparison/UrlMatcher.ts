import type { UrlCheck } from '../types/report';
import { normalizeUrl } from '../../../src/lib/utils';

const LABEL = /^\s*(?:(?:page|post|live|target|final|published)\s+)?(?:url(?:\s+slug)?|slug|permalink)\s*[:\-–|]\s*(\S+)/i;

function parse(u: string): URL | null {
  try {
    return new URL(normalizeUrl(u));
  } catch {
    return null;
  }
}

const pathOf = (p: URL) => p.pathname.replace(/\/+$/, '').toLowerCase() || '/';
const pageKey = (p: URL) => p.hostname.replace(/^www\./i, '').toLowerCase() + pathOf(p);

export function urlMatches(expected: string, live: string): boolean {
  const e = expected.trim().replace(/[)>.,;]+$/, '');
  const liveUrl = parse(live);
  if (!liveUrl) return false;
  if (/^https?:\/\//i.test(e) || /^[\w-]+(?:\.[\w-]+)+(?:\/|$)/.test(e)) {
    const exp = parse(e);
    return !!exp && pageKey(exp) === pageKey(liveUrl);
  }
  const livePath = pathOf(liveUrl);
  const p = '/' + e.toLowerCase().replace(/^\/+|\/+$/g, '');
  return e.startsWith('/') ? livePath === p : livePath === p || livePath.endsWith(p);
}

export function auditUrl(docLines: string[], liveUrl: string, canonical?: string): UrlCheck {
  const labeled = docLines.map((l) => l.match(LABEL)?.[1]).find(Boolean);
  const expected = labeled || docLines.flatMap((l) => l.match(/https?:\/\/[^\s"'<>]+/gi) ?? []).find((u) => urlMatches(u, liveUrl));
  if (!expected) return { expected: '', actual: liveUrl, status: 'NOT_IN_DOC', canonical };
  return {
    expected,
    actual: liveUrl,
    status: urlMatches(expected, liveUrl) ? 'MATCH' : 'MISMATCH',
    canonical,
    canonicalMatches: canonical ? urlMatches(expected, canonical) : undefined,
  };
}
