import type { LinkRef, NormalizedElement } from '../types/normalized';
import type { LinkCheck } from '../types/report';
import { normalizeText } from '../utils/textNormalizer';

// Query parameters that only track a click; they never change which page a link opens
const TRACKING_PARAM = /^(?:utm_\w+|gclid|gbraid|wbraid|fbclid|msclkid|dclid|yclid|mc_cid|mc_eid|_ga|_gl|_hsenc|_hsmi|hsctatracking|igshid|ref_src)$/i;

const MIN_ANCHOR_SIMILARITY = 0.5;

export interface ParsedLink {
  /** Comparable form of the URL, or null when it cannot be parsed */
  key: string | null;
  /** Fragment (#section), compared only when the doc link has one */
  hash: string;
}

/**
 * Comparable form of a link: scheme (http/https), "www.", default ports, a trailing slash, letter case
 * and tracking parameters are ignored; the remaining query parameters are sorted. Relative hrefs
 * resolve against `base`. mailto:/tel: compare by address/number.
 */
export function parseLinkUrl(href: string, base?: string): ParsedLink {
  let url: URL;
  try {
    url = new URL(href.trim(), base);
  } catch {
    return { key: null, hash: '' };
  }
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
    const target = decodeURIComponent(url.pathname).toLowerCase().replace(url.protocol === 'tel:' ? /[^\d+]/g : /\s/g, '');
    return { key: `${url.protocol}${target}`, hash: '' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { key: url.href.toLowerCase(), hash: '' };
  }
  let path = url.pathname;
  try {
    path = decodeURI(path);
  } catch {
    // malformed escape; compare as written
  }
  path = path.replace(/\/+$/, '').toLowerCase() || '/';
  const params = [...url.searchParams.entries()]
    .filter(([name]) => !TRACKING_PARAM.test(name))
    .map(([name, value]) => `${name.toLowerCase()}=${value}`)
    .sort();
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return {
    key: `${host}${url.port ? `:${url.port}` : ''}${path}${params.length ? `?${params.join('&')}` : ''}`,
    hash: url.hash.replace(/^#/, ''),
  };
}

export function sameLinkTarget(docHref: string, pageHref: string, pageUrl?: string): boolean {
  const doc = parseLinkUrl(docHref, pageUrl);
  const page = parseLinkUrl(pageHref, pageUrl);
  if (!doc.key || !page.key) return docHref.trim() === pageHref.trim();
  return doc.key === page.key && (!doc.hash || doc.hash === page.hash);
}

// Anchor text compared without case, punctuation or spacing differences
function anchorKey(text: string): string {
  return normalizeText(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function anchorSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `)) return 1;
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  let shared = 0;
  wordsA.forEach((w) => wordsB.has(w) && shared++);
  return (2 * shared) / (wordsA.size + wordsB.size);
}

// Links a page must not be checked against: in-page jumps and script handlers
function isComparablePageLink(link: LinkRef): boolean {
  const href = link.href.trim();
  return !!href && !href.startsWith('#') && !/^javascript:/i.test(href);
}

function describe(element: NormalizedElement): string {
  const label = element.type === 'heading' ? element.tag.toUpperCase() : element.type === 'list' ? 'List' : element.type === 'table' ? 'Table' : 'Paragraph';
  const text = element.text.length > 60 ? `${element.text.slice(0, 57)}…` : element.text;
  return `${label} "${text}"`;
}

/**
 * Checks every doc link against the links in the page's main content. Each page link is used once.
 * Passes run in order of confidence so a weak pairing never takes a page link a stronger one needs:
 * exact (text + URL) → same text, other URL → same URL, similar text → text unlinked or missing.
 */
export function auditLinks(
  docElements: NormalizedElement[],
  pageElements: NormalizedElement[],
  pageUrl?: string
): { links: LinkCheck[]; extraLinks: LinkRef[] } {
  const docLinks = docElements.flatMap((element) =>
    (element.links || []).map((link) => ({ ...link, key: anchorKey(link.text), context: describe(element) }))
  );
  const pageLinks = pageElements
    .flatMap((element) => element.links || [])
    .filter(isComparablePageLink)
    .map((link) => ({ ...link, key: anchorKey(link.text) }));

  const claimed = new Set<number>();
  const results: Array<LinkCheck | undefined> = docLinks.map(() => undefined);
  const claim = (i: number, j: number, status: LinkCheck['status']) => {
    claimed.add(j);
    const doc = docLinks[i];
    results[i] = {
      text: doc.text,
      expectedUrl: doc.href,
      status,
      actualText: pageLinks[j].text,
      actualUrl: pageLinks[j].href,
      context: doc.context,
    };
  };
  const pass = (status: LinkCheck['status'], fits: (i: number, j: number) => boolean) =>
    docLinks.forEach((_, i) => {
      if (results[i]) return;
      const j = pageLinks.findIndex((_, j) => !claimed.has(j) && fits(i, j));
      if (j !== -1) claim(i, j, status);
    });

  const sameTarget = (i: number, j: number) => sameLinkTarget(docLinks[i].href, pageLinks[j].href, pageUrl);
  pass('MATCH', (i, j) => docLinks[i].key === pageLinks[j].key && sameTarget(i, j));
  pass('WRONG_URL', (i, j) => docLinks[i].key === pageLinks[j].key);
  pass('ANCHOR_DIFFERS', (i, j) => sameTarget(i, j) && anchorSimilarity(docLinks[i].key, pageLinks[j].key) >= MIN_ANCHOR_SIMILARITY);

  const pageText = ` ${anchorKey(pageElements.map((el) => (el.type === 'list' ? el.items.join(' ') : el.text)).join(' '))} `;
  docLinks.forEach((doc, i) => {
    if (results[i]) return;
    results[i] = {
      text: doc.text,
      expectedUrl: doc.href,
      status: doc.key && pageText.includes(` ${doc.key} `) ? 'NOT_LINKED' : 'MISSING',
      context: doc.context,
    };
  });

  return {
    links: results as LinkCheck[],
    extraLinks: pageLinks.filter((_, j) => !claimed.has(j)).map(({ text, href }) => ({ text, href })),
  };
}
