import { validateSafeUrl } from './PageSecurity';
import { renderPageWithBrowser, shouldTriggerRenderFallback } from './PageRenderer';

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

export interface FetchResult {
  html: string;
  finalUrl: string;
  httpStatus: number;
  fetchMethod: 'direct-http' | 'rendered-browser';
  rendered: boolean;
  htmlSize: number;
  notes: string[];
}

/**
 * Fetches webpage HTML server-side with SSRF protection, redirect verification,
 * size limits, and automatic browser rendering fallback.
 */
export async function fetchWebpage(targetUrl: string, enableRenderFallback = true): Promise<FetchResult> {
  const notes: string[] = [];
  let currentUrl = targetUrl;
  let redirectsCount = 0;
  let res: Response | null = null;

  while (redirectsCount <= MAX_REDIRECTS) {
    const check = await validateSafeUrl(currentUrl);
    if (!check.valid) {
      throw new Error(`Security validation failed: ${check.reason}`);
    }

    try {
      res = await fetch(currentUrl, {
        headers: BROWSER_HEADERS,
        redirect: 'manual', // Manually validate each hop for SSRF
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        throw new Error(`Connection timed out after ${DEFAULT_TIMEOUT_MS / 1000}s while fetching ${currentUrl}`);
      }
      throw new Error(`Failed to connect to ${currentUrl}: ${err.message || err}`);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      redirectsCount++;
      if (redirectsCount > MAX_REDIRECTS) {
        throw new Error(`Exceeded maximum redirect limit of ${MAX_REDIRECTS} redirects.`);
      }
      const location = res.headers.get('location');
      if (!location) {
        throw new Error(`Server returned redirect status ${res.status} without a Location header.`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      notes.push(`Redirected (${res.status}) to ${currentUrl}`);
      continue;
    }

    break;
  }

  if (!res) {
    throw new Error(`No HTTP response received for ${targetUrl}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} received from target URL.`);
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_HTML_SIZE) {
    throw new Error(`Webpage HTML size (${Math.round(contentLength / 1024)} KB) exceeds maximum limit of 10 MB.`);
  }

  const rawHtml = await res.text();
  if (rawHtml.length > MAX_HTML_SIZE) {
    throw new Error(`Webpage content exceeds maximum allowed size of 10 MB.`);
  }

  // Check if rendering fallback should be triggered (SPA or empty shell)
  if (enableRenderFallback && shouldTriggerRenderFallback(rawHtml, 0)) {
    notes.push('Detected potential SPA / client-rendered content shell. Attempting browser rendering fallback...');
    const renderResult = await renderPageWithBrowser(currentUrl);
    if (renderResult.success && renderResult.html.length > rawHtml.length) {
      notes.push('Successfully extracted rendered DOM via headless browser.');
      return {
        html: renderResult.html,
        finalUrl: currentUrl,
        httpStatus: res.status,
        fetchMethod: 'rendered-browser',
        rendered: true,
        htmlSize: renderResult.html.length,
        notes,
      };
    } else if (renderResult.error) {
      notes.push(`Render fallback attempted but failed: ${renderResult.error}`);
    }
  }

  return {
    html: rawHtml,
    finalUrl: currentUrl,
    httpStatus: res.status,
    fetchMethod: 'direct-http',
    rendered: false,
    htmlSize: rawHtml.length,
    notes,
  };
}
