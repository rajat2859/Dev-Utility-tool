import type { IssueTab, Priority, SeoAuditResult, SeoPage } from './types';
import { auditPage, failedPage } from './pageAudit';
import { normalizeUrl } from '../../src/lib/utils';

const MAX_URLS = 100;
const CONCURRENCY = 6;
const MAX_CHILD_SITEMAPS = 5;
const PASTED_HTML = '(pasted HTML)';

const isSitemap = (url: string) => /\.xml(\?|$)/i.test(url);

export function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

// Duplicate checks need the whole set of pages, so they run after every page is audited.
export function markDuplicates(pages: SeoPage[]): void {
  const checks: Array<[IssueTab, (p: SeoPage) => string | undefined, Priority]> = [
    ['Page Titles', (p) => p.title[0], 'High'],
    ['Meta Description', (p) => p.description[0], 'Low'],
    ['H1', (p) => p.h1[0], 'Low'],
    ['H2', (p) => p.h2[0], 'Low'],
  ];
  for (const [tab, value, priority] of checks) {
    const groups = new Map<string, SeoPage[]>();
    for (const page of pages) {
      const v = value(page)?.toLowerCase();
      if (v) groups.set(v, [...(groups.get(v) || []), page]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      group.forEach((p) => p.issues.push({ tab, name: 'Duplicate', priority, detail: `Shared with ${group.length - 1} other page(s).` }));
    }
  }
}

/**
 * Audits a list of URLs (or the URLs of a sitemap) and/or pasted HTML, Screaming Frog "list mode" style.
 * fetchHtml is injected so the caller's SSRF-safe fetcher is used for every request.
 */
export async function runSeoAudit(
  input: { urls: string[]; rawHtml?: string },
  fetchHtml: (url: string) => Promise<string>
): Promise<SeoAuditResult> {
  const notices: string[] = [];
  let urls = [...new Set(input.urls.map(normalizeUrl).filter(Boolean))];

  // A single sitemap URL is expanded into the pages it lists (one level of sitemap index deep).
  if (urls.length === 1 && isSitemap(urls[0])) {
    try {
      let locs = extractSitemapLocs(await fetchHtml(urls[0]));
      const children = locs.filter(isSitemap).slice(0, MAX_CHILD_SITEMAPS);
      if (children.length) {
        const childLocs = await mapPool(children, 3, async (c) => extractSitemapLocs(await fetchHtml(c)).filter((l) => !isSitemap(l)));
        locs = [...locs.filter((l) => !isSitemap(l)), ...childLocs.flat()];
      }
      urls = [...new Set(locs)];
      notices.push(`Sitemap expanded to ${urls.length} URL(s).`);
    } catch (e: any) {
      return { pages: [failedPage(urls[0], `Could not read sitemap: ${e.message || e}`)], notices };
    }
  }

  if (urls.length > MAX_URLS) {
    notices.push(`Only the first ${MAX_URLS} of ${urls.length} URLs were audited.`);
    urls = urls.slice(0, MAX_URLS);
  }

  const pages = await mapPool(urls, CONCURRENCY, async (url) => {
    try {
      return auditPage(await fetchHtml(url), url);
    } catch (e: any) {
      return failedPage(url, e.message || String(e));
    }
  });

  if (input.rawHtml?.trim()) pages.unshift(auditPage(input.rawHtml, PASTED_HTML));

  markDuplicates(pages.filter((p) => !p.error));
  return { pages, notices };
}
