import type { docs_v1 } from 'googleapis';
import * as cheerio from 'cheerio';

/** Which tab was read, and whether the doc has others (a link opens one tab; audits must too) */
interface TabInfo {
  hasOtherTabs?: boolean;
}

export type GoogleDocData =
  | (docs_v1.Schema$Document & { isHtml?: false } & TabInfo)
  | ({ isHtml: true; html: string; title?: string } & TabInfo);

export class MissingTabError extends Error {}

function flattenTabs(tabs: docs_v1.Schema$Tab[] = []): docs_v1.Schema$Tab[] {
  return tabs.flatMap((tab) => [tab, ...flattenTabs(tab.childTabs || [])]);
}

// Visible text length of an export, to tell a one-tab export from the all-tabs export
function exportTextLength(html: string): number {
  return cheerio.load(html)('body').text().replace(/\s+/g, '').length;
}

/**
 * Reads one tab of a public doc: the tab in the link, or the first tab (the one Google opens) when the
 * link has none. Without a tab, Google's export returns every tab merged, which would audit a draft
 * tab and the final tab together.
 */
export async function fetchPublicGoogleDoc(
  documentId: string,
  tabId?: string
): Promise<GoogleDocData> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();

  // 1. If API key is present, attempt official Google Docs API v1 first
  if (apiKey) {
    let missingTab = false;
    try {
      const apiResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}?includeTabsContent=true&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (apiResponse.ok) {
        const doc = (await apiResponse.json()) as docs_v1.Schema$Document;
        const tabs = flattenTabs(doc.tabs || []);
        if (!tabs.length) return doc;
        const tab = tabId ? tabs.find((t) => t.tabProperties?.tabId === tabId) : tabs[0];
        if (tab?.documentTab) {
          return { ...doc, body: tab.documentTab.body, lists: tab.documentTab.lists, hasOtherTabs: tabs.length > 1 };
        }
        missingTab = !!tabId && !tab;
      } else {
        console.warn(
          `[GoogleDocsService] API key fetch failed (status ${apiResponse.status}), attempting public export fallback...`
        );
      }
    } catch {
      console.warn('[GoogleDocsService] API key fetch failed, attempting public export fallback...');
    }
    if (missingTab) {
      throw new MissingTabError(
        `This doc has no tab "${tabId}". Open the tab you want to audit in Google Docs and copy the link from the address bar.`
      );
    }
  }

  // 2. Fetch public document export (supported natively by Google Docs for shared links)
  try {
    const exportUrl = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/export?format=html`;
    // Status, final URL and body in one step, so a download that stalls mid-body also hits the timeout
    const exportFetch = async (url: string) => {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      return { status: r.status, ok: r.ok, url: r.url, html: r.ok ? await r.text() : '' };
    };
    // Google's export occasionally stalls (seen: 50 s for a request that normally takes 2 s) or
    // returns a 5xx/429; one retry turns that into a slower audit instead of a failed one
    const exportWithRetry = async (url: string) => {
      try {
        const first = await exportFetch(url);
        if (first.status !== 429 && first.status < 500) return first;
      } catch (err: any) {
        if (err?.name !== 'TimeoutError' && err?.name !== 'AbortError' && !(err instanceof TypeError)) throw err;
      }
      return exportFetch(url);
    };
    // With a tab parameter the export holds only that tab (an unknown id gets the first tab, which is
    // what t.0 relies on). The tab-less export holds every tab: fetched alongside only to tell whether
    // other tabs exist, so its failure never fails the audit.
    const [res, allTabs] = await Promise.all([
      exportWithRetry(`${exportUrl}&tab=${encodeURIComponent(tabId || 't.0')}`),
      exportFetch(exportUrl)
        .then((r) => (r.ok ? r.html : undefined))
        .catch(() => undefined),
    ]);

    if (res.status === 404) {
      throw new Error(
        'Google Doc not found. Please check that the URL is correct and the document exists.'
      );
    }

    if (!res.ok) {
      throw new Error(`Google Doc export returned HTTP ${res.status}.`);
    }

    // A private doc redirects to the Google sign-in page; checking the doc's own HTML
    // for "accounts.google.com" misfires on public docs that mention that address
    const { html } = res;
    if (/^https:\/\/accounts\.google\.com\//i.test(res.url) || html.includes('ServiceLogin')) {
      throw new Error(
        'This Google Doc could not be read publicly.\n\nMake sure sharing is set to:\nAnyone with the link → Viewer'
      );
    }

    // shortcut: a near-empty extra tab (under ~50 characters) is not reported; it cannot skew the audit anyway
    const hasOtherTabs = allTabs === undefined ? undefined : exportTextLength(allTabs) > exportTextLength(html) + 50;
    return { isHtml: true, html, title: '', ...(hasOtherTabs !== undefined && { hasOtherTabs }) };
  } catch (err: any) {
    const message = err.message || 'Failed to fetch Google Doc.';
    // Sharing and not-found errors are the real cause, with or without an API key
    if (
      message.includes('Anyone with the link') ||
      message.includes('Google Doc not found')
    ) {
      throw err;
    }

    if (!apiKey) {
      throw new Error(
        `Public document fetch failed: ${message}. Make sure sharing is set to "Anyone with the link → Viewer", or set GOOGLE_API_KEY in your environment (.env file).`
      );
    }

    throw new Error(`Failed to fetch Google Doc: ${message}`);
  }
}

