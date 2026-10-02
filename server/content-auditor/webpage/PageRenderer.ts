import fs from 'node:fs';
import { chromium, type Browser } from 'playwright-core';
import { validateSafeUrl } from './PageSecurity';

// Candidate browser executable paths on Windows and Unix systems
const CANDIDATE_BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function findBrowserPath(): string | undefined {
  for (const p of CANDIDATE_BROWSER_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return undefined;
}

export function shouldTriggerRenderFallback(html: string, detectedBlockCount: number): boolean {
  if (!html) return true;
  const trimmed = html.trim();
  if (trimmed.length < 50) return true;

  // SPA root containers with empty content
  const hasSpaRoot = /<div[^>]+id=["'](?:root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(trimmed);
  if (hasSpaRoot && detectedBlockCount <= 1) return true;

  // Very little visible text despite HTML having scripts
  const textOnly = trimmed.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (textOnly.length < 150 && /<script/i.test(trimmed) && detectedBlockCount === 0) {
    return true;
  }

  // Hydration shell marker
  if (trimmed.includes('data-reactroot=""') && textOnly.length < 100) {
    return true;
  }

  return false;
}

export async function renderPageWithBrowser(targetUrl: string, timeoutMs = 20000): Promise<{ html: string; success: boolean; error?: string }> {
  const browserPath = findBrowserPath();
  if (!browserPath) {
    return {
      html: '',
      success: false,
      error: 'No compatible Chromium/Edge browser found on system for JavaScript rendering fallback.',
    };
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    // Validate every request the page makes (navigation, redirects, subresources, XHR) so the
    // browser cannot be used to reach private/internal addresses. data:/blob:/about: carry no network
    // access and are allowed; anything else that is not safe http(s) is aborted.
    // Every route is always settled (continue or abort) so no request hangs; settling after the
    // browser has closed throws, which is ignored.
    await context.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      let allowed = false;
      try {
        allowed = /^(data|blob|about):/i.test(requestUrl) || (await validateSafeUrl(requestUrl)).valid;
      } catch {
        // fail closed
      }
      try {
        if (allowed) await route.continue();
        else await route.abort('blockedbyclient');
      } catch {
        // page or browser already closed
      }
    });

    const page = await context.newPage();
    // Navigate with timeout
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Wait short delay for client hydration / script execution
    try {
      await page.waitForLoadState('networkidle', { timeout: 3500 });
    } catch {}

    const html = await page.content();
    await browser.close();
    browser = null;

    return { html, success: true };
  } catch (err: any) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    return {
      html: '',
      success: false,
      error: `Rendering failed: ${err.message || err}`,
    };
  }
}
