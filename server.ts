import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import Tesseract from "tesseract.js";
import compression from "compression";

dotenv.config();

// Tesseract's Node worker can emit an 'error' outside any promise chain (bypassing
// every try/catch around performLocalOcr), which Node treats as a fatal uncaught
// exception. That one OCR failure would otherwise kill the whole server for every
// user, so keep the process alive and just log it.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept alive):', err);
});

const app = express();
const PORT = Number(process.env.PORT) || 2000;

// Compress all responses (static JS/CSS bundles & JSON API payloads)
app.use(compression());

// Increase body-parser limits for the base64 screenshot upload
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Shared HTML micro-parsing helpers (used by both parseFullSeoAndSchemas and parseHtml)
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HTML_NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™'
};

// Extracted text is compared/displayed as-is elsewhere, so undecoded entities (a real page's
// apostrophes/ampersands almost always export as &#x27;/&amp;) would otherwise show up literally
// in the report instead of the character they represent.
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return HTML_NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function stripTags(fragment: string): string {
  return decodeHtmlEntities(fragment.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
}

function extractPageTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return stripTags(titleMatch[1]);
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i) ||
                       html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:title["']/i);
  return ogTitleMatch ? stripTags(ogTitleMatch[1]) : '';
}

function extractMetaDescriptionTag(html: string): string {
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
  return descMatch ? stripTags(descMatch[1]) : '';
}

// Best-effort "featured image" for the page: og:image, then twitter:image, then the first <img>.
function extractOgImage(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([\s\S]*?)["']/i) ||
             html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:image["']/i);
  if (og) return og[1].trim();
  const twitter = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([\s\S]*?)["']/i) ||
                  html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']twitter:image["']/i);
  if (twitter) return twitter[1].trim();
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return img ? img[1].trim() : '';
}

// The page's own declared URL — <link rel="canonical">, falling back to og:url — read straight
// from the HTML source, rather than trusting whatever URL was typed into the input box (which
// may not match after redirects, trailing slashes, or a copy-pasted staging link).
function extractCanonicalUrl(html: string): string {
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["']/i) ||
                     html.match(/<link[^>]+href=["']([\s\S]*?)["'][^>]+rel=["']canonical["']/i);
  if (canonical) return canonical[1].trim();
  const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([\s\S]*?)["']/i) ||
                html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:url["']/i);
  return ogUrl ? ogUrl[1].trim() : '';
}

interface FaqQA { question: string; answer: string }

// Finds a FAQPage JSON-LD block (directly, inside @graph, or inside an array) and pulls out
// its question/answer pairs, so the Auditor can check both "is it there" and "does it match the doc".
function extractFaqSchema(html: string): { present: boolean; raw: any | null; qa: FaqQA[] } {
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const rawScriptContent = scriptMatch[1].trim();
    if (!rawScriptContent) continue;
    try {
      const cleanedJson = rawScriptContent.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1').trim();
      const parsed = JSON.parse(cleanedJson);

      const findFaq = (obj: any): any | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = findFaq(item);
            if (found) return found;
          }
          return null;
        }
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) {
            const found = findFaq(item);
            if (found) return found;
          }
          return null;
        }
        const type = obj['@type'] || obj['type'];
        const typeStr = Array.isArray(type) ? type.join(',') : String(type || '');
        return typeStr.includes('FAQPage') ? obj : null;
      };

      const faqObj = findFaq(parsed);
      if (faqObj) {
        const mainEntity = Array.isArray(faqObj.mainEntity) ? faqObj.mainEntity : [];
        const qa: FaqQA[] = mainEntity
          .map((q: any) => ({
            question: stripTags(String(q?.name || '')),
            answer: stripTags(String(q?.acceptedAnswer?.text || ''))
          }))
          .filter((q: FaqQA) => q.question || q.answer);
        return { present: true, raw: faqObj, qa };
      }
    } catch {
      // Malformed JSON-LD block — skip it and keep scanning the rest of the page.
    }
  }
  return { present: false, raw: null, qa: [] };
}

function extractAllHeadings(html: string): { level: string; text: string }[] {
  const results: { level: string; text: string }[] = [];
  const headingRegex = /<(h1|h2|h3|h4|h5|h6)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = headingRegex.exec(html)) !== null) {
    results.push({ level: m[1].toLowerCase(), text: stripTags(m[2]) });
  }
  return results;
}

// Robust server-side SEO & Schema parser for Meta Title, Description, Social Cards & Schema.org JSON-LD / Microdata
function parseFullSeoAndSchemas(html: string, pageUrl?: string) {
  const title = extractPageTitle(html);
  const description = extractMetaDescriptionTag(html);

  // Meta Keywords
  let keywords = '';
  const kwMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([\s\S]*?)["']/i) ||
                  html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']keywords["']/i);
  if (kwMatch) keywords = kwMatch[1].trim();

  // Canonical URL
  let canonical = '';
  const canMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["']/i) ||
                   html.match(/<link[^>]+href=["']([\s\S]*?)["'][^>]+rel=["']canonical["']/i);
  if (canMatch) canonical = canMatch[1].trim();

  // Robots
  let robots = '';
  const robMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([\s\S]*?)["']/i) ||
                   html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']robots["']/i);
  if (robMatch) robots = robMatch[1].trim();

  // Viewport
  let viewport = '';
  const vpMatch = html.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([\s\S]*?)["']/i) ||
                  html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']viewport["']/i);
  if (vpMatch) viewport = vpMatch[1].trim();

  // Open Graph & Twitter Social Tags
  const extractMeta = (propName: string, attrName = 'property') => {
    const reg = new RegExp(`<meta[^>]+${attrName}=["']${propName.replace(':', '\\:')}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i');
    const reg2 = new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attrName}=["']${propName.replace(':', '\\:')}["']`, 'i');
    const m = html.match(reg) || html.match(reg2);
    return m ? m[1].trim() : undefined;
  };

  const ogTitle = extractMeta('og:title');
  const ogDescription = extractMeta('og:description');
  const ogImage = extractMeta('og:image');
  const ogUrl = extractMeta('og:url');
  const ogType = extractMeta('og:type');
  const ogSiteName = extractMeta('og:site_name');

  const twitterCard = extractMeta('twitter:card', 'name');
  const twitterTitle = extractMeta('twitter:title', 'name');
  const twitterDescription = extractMeta('twitter:description', 'name');
  const twitterImage = extractMeta('twitter:image', 'name');

  // Headings
  const allHeadings = extractAllHeadings(html);
  const h1s = allHeadings.filter(h => h.level === 'h1' && h.text).map(h => h.text);
  const h2Count = allHeadings.filter(h => h.level === 'h2').length;
  const h3Count = allHeadings.filter(h => h.level === 'h3').length;
  const h4Count = allHeadings.filter(h => h.level === 'h4').length;

  // Image alt check
  let totalImages = 0;
  let missingAltCount = 0;
  const imgRegex = /<img[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    totalImages++;
    const imgTag = imgMatch[0];
    if (!/alt=["']/i.test(imgTag) || /alt=["']\s*["']/i.test(imgTag)) {
      missingAltCount++;
    }
  }

  // Title Audit
  const titleLen = title.length;
  let titleStatus: 'optimal' | 'too_short' | 'too_long' | 'missing' = 'optimal';
  let titleMsg = 'Title length is optimal for Google SERP display (50 - 60 characters).';
  if (titleLen === 0) {
    titleStatus = 'missing';
    titleMsg = 'Meta title tag is completely missing! This severely harms SEO ranking.';
  } else if (titleLen < 30) {
    titleStatus = 'too_short';
    titleMsg = `Title is too short (${titleLen} chars). Expand to 50-60 characters to include target keywords and branding.`;
  } else if (titleLen > 60) {
    titleStatus = 'too_long';
    titleMsg = `Title is too long (${titleLen} chars). Google will truncate titles beyond ~60 characters on desktop/mobile.`;
  }

  // Description Audit
  const descLen = description.length;
  let descStatus: 'optimal' | 'too_short' | 'too_long' | 'missing' = 'optimal';
  let descMsg = 'Meta description length is optimal for search snippets (120 - 160 characters).';
  if (descLen === 0) {
    descStatus = 'missing';
    descMsg = 'Meta description is missing! Search engines will auto-generate snippets from body text.';
  } else if (descLen < 70) {
    descStatus = 'too_short';
    descMsg = `Description is too short (${descLen} chars). Expand to 120-160 characters to improve click-through rates.`;
  } else if (descLen > 160) {
    descStatus = 'too_long';
    descMsg = `Description is too long (${descLen} chars). Snippets over 160 characters will be truncated with ellipsis.`;
  }

  // Schema extraction (JSON-LD)
  const schemas: any[] = [];
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const rawScriptContent = scriptMatch[1].trim();
    if (!rawScriptContent) continue;
    try {
      const cleanedJson = rawScriptContent.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1').trim();
      const parsed = JSON.parse(cleanedJson);
      
      const processSchemaObj = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        if (Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(item => processSchemaObj(item));
          return;
        }

        if (Array.isArray(obj)) {
          obj.forEach(item => processSchemaObj(item));
          return;
        }

        const schemaType = obj['@type'] || obj['type'] || 'UnknownSchema';
        const issues: { type: 'error' | 'warning' | 'info'; message: string; field?: string }[] = [];

        const typeStr = Array.isArray(schemaType) ? schemaType.join(', ') : String(schemaType);
        
        if (typeStr.includes('Article') || typeStr.includes('BlogPosting') || typeStr.includes('NewsArticle')) {
          if (!obj.headline && !obj.name) issues.push({ type: 'warning', message: 'Missing "headline" property.', field: 'headline' });
          if (!obj.image) issues.push({ type: 'warning', message: 'Missing "image" property (recommended for Rich Snippets).', field: 'image' });
          if (!obj.datePublished) issues.push({ type: 'info', message: 'Missing "datePublished" property.', field: 'datePublished' });
          if (!obj.author) issues.push({ type: 'info', message: 'Missing "author" property.', field: 'author' });
        } else if (typeStr.includes('Product')) {
          if (!obj.name) issues.push({ type: 'error', message: 'Missing required "name" property.', field: 'name' });
          if (!obj.image) issues.push({ type: 'warning', message: 'Missing "image" property.', field: 'image' });
          if (!obj.offers && !obj.aggregateRating && !obj.review) {
            issues.push({ type: 'warning', message: 'Missing "offers" or "aggregateRating" for Product rich results.', field: 'offers' });
          }
        } else if (typeStr.includes('Organization') || typeStr.includes('LocalBusiness')) {
          if (!obj.name) issues.push({ type: 'error', message: 'Missing required "name" property.', field: 'name' });
          if (!obj.url) issues.push({ type: 'warning', message: 'Missing "url" property.', field: 'url' });
          if (!obj.logo && !obj.image) issues.push({ type: 'info', message: 'Missing "logo" or "image" property.', field: 'logo' });
        } else if (typeStr.includes('BreadcrumbList')) {
          if (!obj.itemListElement || !Array.isArray(obj.itemListElement) || obj.itemListElement.length === 0) {
            issues.push({ type: 'error', message: 'BreadcrumbList requires "itemListElement" array.', field: 'itemListElement' });
          }
        } else if (typeStr.includes('FAQPage')) {
          if (!obj.mainEntity || !Array.isArray(obj.mainEntity)) {
            issues.push({ type: 'error', message: 'FAQPage requires "mainEntity" array of Question/Answer items.', field: 'mainEntity' });
          }
        }

        if (!obj['@type']) {
          issues.push({ type: 'error', message: 'Missing @type property in JSON-LD object.' });
        }

        schemas.push({
          schemaType: typeStr,
          source: 'json-ld',
          rawJson: obj,
          issues,
          valid: issues.filter(i => i.type === 'error').length === 0
        });
      };

      processSchemaObj(parsed);
    } catch (jsonErr: any) {
      schemas.push({
        schemaType: 'Invalid JSON-LD',
        source: 'json-ld',
        rawJson: { raw: rawScriptContent.slice(0, 300) },
        issues: [{ type: 'error', message: `JSON syntax error: ${jsonErr.message}` }],
        valid: false
      });
    }
  }

  // Microdata Check
  const microdataRegex = /<[^>]+itemscope[^>]*>/gi;
  let mdMatch;
  while ((mdMatch = microdataRegex.exec(html)) !== null) {
    const tag = mdMatch[0];
    const typeMatch = tag.match(/itemtype=["']([^"']+)["']/i);
    const itemType = typeMatch ? typeMatch[1].split('/').pop() || typeMatch[1] : 'MicrodataItem';
    schemas.push({
      schemaType: itemType,
      source: 'microdata',
      rawJson: { htmlTag: tag },
      issues: [],
      valid: true
    });
  }

  // Calculate Health Score (0 - 100)
  let titleScore = titleStatus === 'optimal' ? 20 : titleStatus === 'too_short' || titleStatus === 'too_long' ? 12 : 0;
  let descriptionScore = descStatus === 'optimal' ? 20 : descStatus === 'too_short' || descStatus === 'too_long' ? 12 : 0;
  let headingsScore = h1s.length === 1 ? 15 : h1s.length > 1 ? 8 : 0;
  let socialScore = (ogTitle && ogDescription && ogImage ? 10 : ogTitle || ogDescription ? 5 : 0) + (twitterCard ? 5 : 0);
  let technicalScore = (canonical ? 8 : 0) + (viewport ? 7 : 0);
  let schemaScore = schemas.length > 0 && schemas.some(s => s.valid) ? 15 : schemas.length > 0 ? 8 : 0;

  const totalScore = titleScore + descriptionScore + headingsScore + socialScore + technicalScore + schemaScore;

  return {
    title: {
      text: title,
      length: titleLen,
      status: titleStatus,
      message: titleMsg,
      pixelWidthEst: Math.round(titleLen * 8.2)
    },
    description: {
      text: description,
      length: descLen,
      status: descStatus,
      message: descMsg
    },
    keywords,
    canonical,
    robots,
    viewport,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
      url: ogUrl,
      type: ogType,
      siteName: ogSiteName,
      hasOgTags: !!(ogTitle || ogDescription || ogImage)
    },
    twitterCard: {
      card: twitterCard,
      title: twitterTitle,
      description: twitterDescription,
      image: twitterImage,
      hasTwitterTags: !!(twitterCard || twitterTitle || twitterImage)
    },
    headings: {
      h1Count: h1s.length,
      h1Texts: h1s,
      h2Count,
      h3Count,
      h4Count,
      status: h1s.length === 1 ? 'good' : h1s.length === 0 ? 'missing_h1' : 'multiple_h1',
      message: h1s.length === 1 ? 'Perfect! Exactly 1 H1 heading tag found.' : h1s.length === 0 ? 'Missing H1 tag. Every SEO-friendly page should have exactly one main H1 tag.' : `Found ${h1s.length} H1 tags. It is recommended to have exactly one H1 tag per page.`
    },
    images: {
      total: totalImages,
      missingAltCount,
      imagesWithoutAlt: []
    },
    schemas,
    overallHealthScore: totalScore,
    scoreBreakdown: {
      titleScore,
      descriptionScore,
      headingsScore,
      socialScore,
      technicalScore,
      schemaScore
    }
  };
}

// Helper to fetch webpage HTML with multi-tier proxies & browser headers
async function fetchWebpageHtml(targetUrl: string): Promise<{ html: string; notice?: string }> {
  const sanitizedUrl = normalizeUrl(targetUrl);

  const browserHeaders = {
    "User-Agent": DESKTOP_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };

  // 1. Direct fetch with real browser headers
  try {
    const res = await fetch(sanitizedUrl, {
      headers: browserHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    const text = await res.text();
    if (text && text.trim().length > 30) {
      return { html: text };
    }
  } catch (err: any) {
    console.warn(`Direct fetch failed for ${sanitizedUrl}:`, err.message || err);
  }

  // 2. Gateway Proxy 1: AllOrigins
  try {
    const proxy1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(sanitizedUrl)}`;
    const res1 = await fetch(proxy1, {
      headers: { "User-Agent": browserHeaders["User-Agent"] },
      signal: AbortSignal.timeout(10000)
    });
    if (res1.ok) {
      const text1 = await res1.text();
      if (text1 && text1.trim().length > 30) {
        return { html: text1, notice: "Fetched webpage via web proxy gateway." };
      }
    }
  } catch (err1: any) {
    console.warn(`Proxy 1 failed for ${sanitizedUrl}:`, err1.message || err1);
  }

  // 3. Gateway Proxy 2: CorsProxy.io
  try {
    const proxy2 = `https://corsproxy.io/?${encodeURIComponent(sanitizedUrl)}`;
    const res2 = await fetch(proxy2, {
      headers: { "User-Agent": browserHeaders["User-Agent"] },
      signal: AbortSignal.timeout(10000)
    });
    if (res2.ok) {
      const text2 = await res2.text();
      if (text2 && text2.trim().length > 30) {
        return { html: text2, notice: "Fetched webpage via CORS fallback gateway." };
      }
    }
  } catch (err2: any) {
    console.warn(`Proxy 2 failed for ${sanitizedUrl}:`, err2.message || err2);
  }

  // 4. Gateway Proxy 3: ThingProxy
  try {
    const proxy3 = `https://thingproxy.freeboard.io/fetch/${sanitizedUrl}`;
    const res3 = await fetch(proxy3, {
      headers: { "User-Agent": browserHeaders["User-Agent"] },
      signal: AbortSignal.timeout(10000)
    });
    if (res3.ok) {
      const text3 = await res3.text();
      if (text3 && text3.trim().length > 30) {
        return { html: text3, notice: "Fetched webpage via secure proxy gateway." };
      }
    }
  } catch (err3: any) {
    console.warn(`Proxy 3 failed for ${sanitizedUrl}:`, err3.message || err3);
  }

  throw new Error(`Could not retrieve HTML from target URL (${sanitizedUrl}). The target site may be blocking automated crawlers. Try using "Paste Raw HTML" mode.`);
}

// Extracts the plain text of a publicly-viewable Google Doc via its export endpoint
async function fetchGoogleDocText(docUrl: string): Promise<string> {
  const idMatch = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) {
    throw new Error('That does not look like a Google Docs URL (expected .../document/d/<id>/...).');
  }
  const docId = idMatch[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  const res = await fetch(exportUrl, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? 'This Google Doc is not public. Set sharing to "Anyone with the link" and try again.'
        : `Could not fetch Google Doc (status ${res.status}).`
    );
  }

  const text = (await res.text()).trim();
  if (!text || text.length < 5) {
    throw new Error('Google Doc appears to be empty.');
  }
  return text;
}

// Endpoint to resolve a Google Doc share link to its plain text, used as the Auditor's reference copy
app.post("/api/content-checker/resolve-google-doc", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: "Missing Google Doc URL." });
    }
    const text = await fetchGoogleDocText(url.trim());
    return res.json({ success: true, text });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to fetch Google Doc content." });
  }
});

// Endpoint to audit SEO meta tags, Title, Description, and Schema.org structured data
app.post("/api/seo-checker/analyze", async (req, res) => {
  try {
    const { url, rawHtml } = req.body;
    let htmlContent = "";
    let pageUrlStr = url || "";
    let fetchNotice: string | undefined = undefined;

    if (rawHtml && rawHtml.trim()) {
      htmlContent = rawHtml.trim();
    } else if (url && url.trim()) {
      const sanitizedUrl = normalizeUrl(url);
      pageUrlStr = sanitizedUrl;

      try {
        const fetched = await fetchWebpageHtml(sanitizedUrl);
        htmlContent = fetched.html;
        fetchNotice = fetched.notice;
      } catch (fetchErr: any) {
        return res.status(400).json({ error: fetchErr.message || `Could not connect to target URL (${sanitizedUrl}).` });
      }
    } else {
      return res.status(400).json({ error: "Please provide a Webpage URL or paste raw HTML code." });
    }

    const auditResult = parseFullSeoAndSchemas(htmlContent, pageUrlStr);
    return res.json({
      success: true,
      data: auditResult,
      pageUrl: pageUrlStr,
      fetchNotice
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to audit SEO and Schemas." });
  }
});

// Robust server-side parser for metadata, headings, paragraphs, lists, and tables
function parseHtml(html: string) {
  // Many blog pages skip (or duplicate) the <title>/og:title tag but always have a visible H1 —
  // fall back to it so the audit still has something real to compare against the reference.
  let title = extractPageTitle(html);
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) title = stripTags(h1Match[1]);
  }

  // Meta description, falling back to og:description / twitter:description
  let description = extractMetaDescriptionTag(html);
  if (!description) {
    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                      html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["']/i) ||
                      html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([\s\S]*?)["']/i);
    if (descMatch) description = stripTags(descMatch[1]);
  }

  // Extract headers: h1 through h6
  const headings = extractAllHeadings(html).filter(h => h.text);

  // Extract explicit <p> paragraph tags
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const pText = stripTags(pMatch[1]);
    if (pText) {
      paragraphs.push(pText);
    }
  }

  // Extract List items (<li>)
  const listItems: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(html)) !== null) {
    const liText = stripTags(liMatch[1]);
    if (liText) {
      listItems.push(liText);
    }
  }

  // Extract Tables (<table>, <tr>, <th>, <td>) — cells are read per-row in document order so a
  // <th> used as a row label inside a data row (a common accessibility pattern: first column
  // <th scope="row">, rest <td>) is kept as part of that row instead of being pulled out into
  // the headers list. Only a first row made up entirely of <th> cells is treated as the header.
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const headers: string[] = [];
    const rows: string[][] = [];

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    let rowIndex = 0;
    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const trHtml = trMatch[1];
      const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
      let cellMatch;
      const cells: string[] = [];
      let isHeaderRow = true;
      while ((cellMatch = cellRegex.exec(trHtml)) !== null) {
        if (cellMatch[1].toLowerCase() !== 'th') isHeaderRow = false;
        // A cell can hold multiple paragraphs (e.g. a bolded label paragraph plus a description
        // paragraph) — split on those so each one is its own comparable value instead of being
        // flattened into a single run-on blob that can't match either paragraph individually.
        const innerParagraphs = cellMatch[2].match(/<p[^>]*>[\s\S]*?<\/p>/gi);
        if (innerParagraphs && innerParagraphs.length > 1) {
          innerParagraphs.forEach((p) => {
            const text = stripTags(p);
            if (text) cells.push(text);
          });
        } else {
          const cellText = stripTags(cellMatch[2]);
          if (cellText) cells.push(cellText);
        }
      }
      if (cells.length > 0) {
        if (rowIndex === 0 && isHeaderRow) headers.push(...cells);
        else rows.push(cells);
      }
      rowIndex++;
    }

    if (headers.length > 0 || rows.length > 0) {
      tables.push({ headers, rows });
    }
  }

  // Extract body copy text (strip script, style, comments and tags)
  let cleanText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  cleanText = cleanText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  cleanText = cleanText.replace(/<!--[\s\S]*?-->/g, ' ');
  cleanText = cleanText.replace(/<[^>]*>/g, ' ');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  if (cleanText.length > 15000) {
    cleanText = cleanText.substring(0, 15000) + '... [truncated]';
  }

  return {
    title,
    description,
    headings,
    paragraphs,
    listItems,
    tables,
    canonicalUrl: extractCanonicalUrl(html),
    faqSchema: extractFaqSchema(html),
    featureImage: extractOgImage(html),
    bodyText: cleanText
  };
}

// Local OCR helper for server-side text extraction from reference screenshots
async function performLocalOcr(imageBase64: string): Promise<string> {
  if (!imageBase64) return '';
  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    // Pin to the bundled eng.traineddata and forbid network re-downloads: tesseract.js
    // defaults to fetching/overwriting this file over the network, and an interrupted
    // download leaves it corrupted, crashing every OCR call afterward.
    const ocrPromise = Tesseract.recognize(imageBuffer, 'eng', {
      langPath: process.cwd(),
      cacheMethod: 'readOnly',
    });
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
    
    const result: any = await Promise.race([ocrPromise, timeoutPromise]);
    return result?.data?.text || '';
  } catch (err: any) {
    console.log("Local OCR extraction note:", err?.message || err);
    return '';
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function stringSimilarity(s1: string, s2: string): number {
  const norm1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const norm2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm1 && !norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;
  if (norm1 === norm2) return 1.0;

  const len1 = norm1.length;
  const len2 = norm2.length;
  // Fast length check optimization
  if (Math.abs(len1 - len2) / Math.max(len1, len2) > 0.6) {
    return 0.3;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

// Splits a reference (Google Doc export, or OCR output) into ordered text blocks, one per line.
// Google Docs' plain-text export doesn't word-wrap — every paragraph, heading, and list item is
// exported as exactly one line, with blank lines appearing only at occasional author-inserted
// visual gaps rather than at every paragraph boundary. So a block boundary has to be "one line",
// not "one blank-line-delimited chunk" — the latter would merge genuinely separate blocks (e.g. a
// heading and the very next paragraph) whenever the author didn't happen to leave a blank line
// between them, which is the normal case. Table rows/cells (Docs exports each as its own
// tab-indented line, or a whole row as one tab-separated line) are kept, not dropped — .trim()
// below strips the leading tab so they flow through as regular reference lines to check against
// the page's table content.
function splitReferenceBlocks(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.replace(/^[*\-•]\s*/, '').trim())
    .filter((l) => l.length > 0)
    // Drop visual-only divider lines (Google Docs horizontal rules export as a run of
    // underscores/dashes) — not real content, so they'd otherwise show up as a fake mismatch.
    .filter((l) => !/^[_\-=]{3,}$/.test(l));
}

// Real pages surround the article with nav menus, sidebars, related-post lists, author bios, and
// footer links — all built from the same h1-h6/p/li tags parseOrderedContentBlocks looks for. Left
// unscoped, that chrome pollutes the sequence and throws off every position after it. Scope to from
// the first <h1> (the real title usually sits just outside <article>, in a header/hero section)
// through </article> or <footer>, whichever comes first.
function scopeToMainContent(html: string): string {
  const h1Idx = html.search(/<h1[\s>]/i);
  const articleIdx = html.search(/<article[\s>]/i);
  const starts = [h1Idx, articleIdx].filter((i) => i >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : 0;

  const articleCloseIdx = html.toLowerCase().lastIndexOf('</article>');
  const footerIdx = html.search(/<footer[\s>]/i);
  const ends = [
    articleCloseIdx >= 0 ? articleCloseIdx + '</article>'.length : -1,
    footerIdx >= 0 ? footerIdx : -1
  ].filter((i) => i >= 0);
  const end = ends.length > 0 ? Math.min(...ends) : html.length;

  return start < end ? html.slice(start, end) : html;
}

// Finds an explicitly-labeled line like "Meta title: ..." or "title - ..." anywhere in the
// reference (content briefs use both "label:" and "label -" conventions), stripping any
// trailing "(53 chars)" annotation.
function extractLabeledLine(text: string, label: string): string {
  const re = new RegExp(`^\\s*${label}\\s*[:\\-]?\\s*(.+)$`, 'im');
  const m = text.match(re);
  if (!m) return '';
  return m[1].replace(/\(\d+\s*chars?\)\s*$/i, '').trim();
}

// Content briefs often prefix the real body copy with metadata (URL, meta title/description,
// keywords) and a flat "H1 ... / H2 ... / H3 ..." heading outline before repeating that structure
// as actual prose. Skip past the last outline line so body alignment starts at the real content.
function skipReferencePreamble(text: string): string {
  const headingLineRegex = /^h[1-6]\s+.+$/gim;
  let lastEnd = -1;
  let m;
  while ((m = headingLineRegex.exec(text)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  return lastEnd >= 0 ? text.slice(lastEnd) : text;
}

// Reference docs commonly end with an FAQ section (questions & answers), which is checked
// separately against the page's FAQPage schema. Cut it from the text before heading/paragraph/
// list alignment so it doesn't also show up there as a wall of "extra reference content" mismatches.
function truncateBeforeFaqSection(text: string): string {
  const m = text.match(/^\s*(faqs?|frequently asked questions)\s*:?\s*$/im);
  return m && m.index !== undefined ? text.slice(0, m.index) : text;
}

// Content briefs often mark where the body copy starts with a standalone "Content" line (as its
// own heading, not "Content: ..." with text on the same line). Skip past it so that marker line
// itself doesn't get treated as a stray paragraph.
function skipStandaloneContentMarker(text: string): string {
  const m = text.match(/^\s*content\s*:?\s*$/im);
  return m && m.index !== undefined ? text.slice(m.index + m[0].length) : text;
}

// Walks the HTML once so headings, paragraphs, and list items come back in true document
// order (interleaved), which is required to align them positionally against a reference
// document written in the same reading order — heading-to-heading, paragraph-to-paragraph.
function parseOrderedContentBlocks(html: string): { type: 'heading' | 'paragraph' | 'listItem'; level?: string; text: string }[] {
  const body = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Table cells commonly wrap their text in <p>/<h*> tags (e.g. <td><p>...</p></td>) — strip
    // whole tables out here so those don't also get scooped up as regular paragraphs/headings;
    // table content is extracted separately (parsedWebData.tables) and pooled on its own.
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, ' ');

  const blocks: { type: 'heading' | 'paragraph' | 'listItem'; level?: string; text: string }[] = [];
  const blockRegex = /<(h1|h2|h3|h4|h5|h6|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRegex.exec(body)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]);
    if (!text) continue;
    if (tag === 'p') blocks.push({ type: 'paragraph', text });
    else if (tag === 'li') blocks.push({ type: 'listItem', text });
    else blocks.push({ type: 'heading', level: tag, text });
  }
  return blocks;
}

// Compares two pieces of text ignoring case, whitespace, and punctuation — i.e. ignoring
// styling/formatting differences and judging only the words themselves.
function textsRoughlyMatch(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  if (na === nb) return true;
  return stringSimilarity(a, b) >= 0.9;
}

// Deterministic compliance report: checks the reference (Google Doc text or OCR output) against
// the webpage's own content. Title/description come from explicit "Meta title:"/"Meta description:"
// labels if the reference uses that content-brief convention, otherwise from its first two lines.
// The body is checked line-by-line: every reference line (heading, paragraph, or list item outline)
// after that title/description preamble is tested for whether it exists anywhere among the page's
// own headings/paragraphs/list items/tables (scoped to content after the page's first H1).
async function buildLocalReport(
  parsedWebData: ReturnType<typeof parseHtml>,
  url: string,
  referenceText: string | undefined,
  orderedBlocks: { type: 'heading' | 'paragraph' | 'listItem'; level?: string; text: string }[]
) {
  const rawReference = referenceText || '';
  const hasReference = rawReference.trim().length > 0;

  // Labels accept either "Meta title: ..." (older content-brief convention) or "title - ..."
  // (URL / title / desc. / Feature image header block convention).
  const labeledTitle = extractLabeledLine(rawReference, 'meta title') || extractLabeledLine(rawReference, 'title');
  const labeledDescription = extractLabeledLine(rawReference, 'meta description')
    || extractLabeledLine(rawReference, 'desc\\.?')
    || extractLabeledLine(rawReference, 'description');
  const labeledUrl = extractLabeledLine(rawReference, 'url');
  const labeledFeatureImage = extractLabeledLine(rawReference, 'feature(?:d)? image');

  let refTitle: string;
  let refDescription: string;
  let refBodyBlocks: string[];

  if (labeledTitle || labeledDescription) {
    refTitle = labeledTitle;
    refDescription = labeledDescription;
    refBodyBlocks = splitReferenceBlocks(skipStandaloneContentMarker(skipReferencePreamble(truncateBeforeFaqSection(rawReference))))
      // Safety net if no heading outline / content marker was found to skip past: drop any leftover metadata lines.
      .filter(b => !/^(url|meta title|meta description|feature(?:d)? image|primary keyword|secondary keywords?|required schema|internal links?|heading structure)\s*[:\-]?\s*/i.test(b));
  } else {
    const referenceBlocks = splitReferenceBlocks(truncateBeforeFaqSection(rawReference));
    refTitle = referenceBlocks[0] || '';
    refDescription = referenceBlocks[1] || '';
    refBodyBlocks = referenceBlocks.slice(2);
  }

  const hasTitle = !!parsedWebData.title;
  const hasDescription = !!parsedWebData.description;

  // Title & meta description, compared directly against the reference's first two lines
  const titleMatches = hasReference ? textsRoughlyMatch(parsedWebData.title, refTitle) : hasTitle;
  const descriptionMatches = hasReference ? textsRoughlyMatch(parsedWebData.description, refDescription) : hasDescription;

  // URL: only checked when the doc actually specifies one (protocol/trailing-slash-insensitive).
  // Compared against the page's own declared URL (<link rel="canonical">/og:url) rather than the
  // input URL box, since that's what the page's HTML source actually claims to be published at —
  // falling back to the input URL when the source declares no canonical/og:url at all.
  const normalizeUrlForCompare = (u: string) => u.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
  const actualUrl = parsedWebData.canonicalUrl || url || '';
  const urlMatches = !labeledUrl ? true : normalizeUrlForCompare(labeledUrl) === normalizeUrlForCompare(actualUrl);

  // Feature image: compares the page's og:image/twitter:image/first <img> against the doc's
  // "Feature image" line, by exact match or matching filename (URLs for the same asset commonly
  // differ by CDN/query-string but keep the same filename).
  const actualFeatureImage = parsedWebData.featureImage || '';
  const imageBaseName = (u: string) => {
    const clean = u.split('?')[0].split('#')[0];
    const idx = clean.lastIndexOf('/');
    return (idx >= 0 ? clean.slice(idx + 1) : clean).toLowerCase();
  };
  const featureImageMatches = !labeledFeatureImage
    ? true
    : !!actualFeatureImage && (
      actualFeatureImage.toLowerCase() === labeledFeatureImage.toLowerCase() ||
      actualFeatureImage.toLowerCase().includes(labeledFeatureImage.toLowerCase()) ||
      labeledFeatureImage.toLowerCase().includes(actualFeatureImage.toLowerCase()) ||
      imageBaseName(actualFeatureImage) === imageBaseName(labeledFeatureImage)
    );

  // Page content pool to test the reference against: every heading, paragraph, list item, and
  // table row on the page, scoped to content after the page's first H1 (the H1 itself is the
  // title, already checked above) and before its own FAQ section (checked separately below).
  const firstH1Index = orderedBlocks.findIndex((b) => b.type === 'heading' && b.level === 'h1');
  const afterH1 = firstH1Index >= 0 ? orderedBlocks.slice(firstH1Index + 1) : orderedBlocks;
  const pageFaqHeadingIdx = afterH1.findIndex(
    (b) => b.type === 'heading' && /^(faqs?|frequently asked questions)$/i.test(b.text.trim())
  );
  const bodyBlocks = pageFaqHeadingIdx >= 0 ? afterH1.slice(0, pageFaqHeadingIdx) : afterH1;

  const pagePool: { category: string; text: string }[] = bodyBlocks.map((b) => ({
    category: b.type === 'heading' ? `Heading (${(b.level || 'h').toUpperCase()})` : b.type === 'listItem' ? 'List Item' : 'Paragraph',
    text: b.text
  }));
  // Each row is pooled as one whole-row entry (for a doc that exports a table row as one
  // tab-separated line) AND as separate per-cell entries (for a doc that exports each table
  // cell on its own line) — the reference side's exact convention isn't known upfront, so both
  // granularities are offered and whichever one the reference line actually matches wins.
  parsedWebData.tables.forEach((tbl, tblIdx) => {
    const allRows = tbl.headers.length > 0 ? [tbl.headers, ...tbl.rows] : tbl.rows;
    allRows.forEach((row, rowIdx) => {
      const rowText = row.join(' | ');
      if (rowText) pagePool.push({ category: `Table ${tblIdx + 1} Row ${rowIdx + 1}`, text: rowText });
      row.forEach((cell) => {
        if (cell) pagePool.push({ category: `Table ${tblIdx + 1} Row ${rowIdx + 1}`, text: cell });
      });
    });
  });

  const comparisons: Array<{
    category: string;
    expected: string;
    actual: string;
    severity: 'high' | 'medium' | 'low';
    comment: string;
    status: 'match' | 'mismatch';
  }> = [];

  // Every line pulled from the reference doc gets its own row here — nothing is skipped or
  // repositioned — and is checked for whether it exists anywhere in the page pool above.
  // Whether that content also happens to repeat elsewhere on the page isn't this check's
  // concern — the doc asked for it, the page has it, that's a match.
  let matchesCount = 0;
  if (hasReference) {
    refBodyBlocks.forEach((refLine) => {
      const found = pagePool.find((entry) => textsRoughlyMatch(entry.text, refLine));
      if (found) matchesCount++;
      comparisons.push({
        category: found?.category || 'Paragraph',
        expected: refLine,
        actual: found ? found.text : '(not found on the webpage)',
        severity: 'medium',
        comment: found
          ? 'Found on the webpage (styling ignored, text only).'
          : 'Not found on the webpage (checked headings, paragraphs, list items, and tables).',
        status: found ? 'match' : 'mismatch'
      });
    });
  } else {
    // No reference to check against — just surface what's on the page.
    pagePool.forEach((entry) => {
      matchesCount++;
      comparisons.push({
        category: entry.category,
        expected: 'No reference provided',
        actual: entry.text,
        severity: 'medium',
        comment: 'No reference document provided — showing extracted webpage content only.',
        status: 'match'
      });
    });
  }

  const mismatchesOnly = comparisons.filter(c => c.status === 'mismatch');
  const bodyStatus = comparisons.length === 0 ? 'partial' : mismatchesOnly.length > 0 ? 'mismatch' : 'match';

  // Score & summary: every check (each heading/paragraph/list item/table row, plus title,
  // description, and URL-if-the-reference-specifies-one) counts as one pass/fail unit, so the
  // score is just "% of checks that passed" — simple to compute and simple to read.
  let totalChecks = matchesCount + mismatchesOnly.length + 2; // +2 for title & description
  let passedChecks = matchesCount + (titleMatches ? 1 : 0) + (descriptionMatches ? 1 : 0);
  if (labeledUrl) {
    totalChecks++;
    if (urlMatches) passedChecks++;
  }
  const overallScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
  const summary = !hasReference
    ? 'No reference document provided — showing extracted webpage content only.'
    : passedChecks === totalChecks
      ? `All ${totalChecks} checks match the reference document (headings, paragraphs, list items, tables, title, description${labeledUrl ? ', and URL' : ''}).`
      : `${passedChecks} of ${totalChecks} checks match the reference — ${mismatchesOnly.length} heading/paragraph/list item/table mismatch${mismatchesOnly.length === 1 ? '' : 'es'}${labeledUrl && !urlMatches ? ', plus the URL does not match the reference' : ''}.`;

  const recommendations: string[] = [];
  if (mismatchesOnly.length > 0) {
    recommendations.push('Align mismatched headings, paragraphs, list items, and tables with the reference.');
  }
  if (!hasTitle) recommendations.push('Add a descriptive <title> tag to the webpage <head>.');
  if (!hasDescription) recommendations.push('Add a meta description tag (<meta name="description" content="...">).');
  if (labeledUrl && !urlMatches) recommendations.push('Publish this content at the URL specified in the reference document.');
  if (labeledFeatureImage && !featureImageMatches) recommendations.push('Set the featured image to match the one specified in the reference document.');

  // FAQ Schema: a present/absent check, plus (when a reference doc is provided) a check that
  // every question & answer in the live FAQPage schema actually appears in that doc.
  const faq = parsedWebData.faqSchema;
  const faqMismatchDetails: string[] = [];
  let faqMatchesDoc = false;

  if (faq.present) {
    if (hasReference) {
      const normalizedRef = normalizeText(rawReference);
      faq.qa.forEach((item, idx) => {
        const qOk = !item.question || normalizedRef.includes(normalizeText(item.question));
        const aOk = !item.answer || normalizedRef.includes(normalizeText(item.answer));
        if (!qOk || !aOk) {
          const label = item.question || `FAQ item #${idx + 1}`;
          const missingPart = !qOk && !aOk ? 'question and answer' : !qOk ? 'question' : 'answer';
          faqMismatchDetails.push(`"${label}" — ${missingPart} not found in the reference document.`);
        }
      });
      faqMatchesDoc = faq.qa.length > 0 && faqMismatchDetails.length === 0;
    } else {
      faqMatchesDoc = true;
    }
  } else if (hasReference && /faq/i.test(rawReference)) {
    faqMismatchDetails.push('The reference document mentions an FAQ section, but no FAQPage schema was found on the live webpage.');
  }

  if (faqMismatchDetails.length > 0) {
    recommendations.push('Fix the FAQ schema so its questions and answers match the reference document.');
  } else if (!faq.present) {
    recommendations.push('Add a FAQPage JSON-LD schema for the FAQ section.');
  }

  const faqStatus: 'match' | 'mismatch' | 'missing' | 'not_present' = !faq.present
    ? (hasReference && /faq/i.test(rawReference) ? 'missing' : 'not_present')
    : (faqMatchesDoc ? 'match' : 'mismatch');

  return {
    seo: {
      urlMatches,
      expectedUrl: labeledUrl || 'No URL specified in the reference',
      actualUrl: actualUrl || '(No target URL provided)',
      urlDifference: !labeledUrl ? 'No URL specified in the reference.' : urlMatches ? 'URL matches the reference.' : 'URL differs from the reference.',
      titleMatches,
      expectedTitle: refTitle || (hasReference ? '(reference has no first line to use as a title)' : 'No reference provided'),
      actualTitle: parsedWebData.title || '(No title tag found)',
      titleDifference: titleMatches ? 'Title matches the reference.' : 'Title differs from the reference.',
      descriptionMatches,
      expectedDescription: refDescription || (hasReference ? '(reference has no second line to use as a description)' : 'No reference provided'),
      actualDescription: parsedWebData.description || '(No meta description found)',
      descriptionDifference: descriptionMatches ? 'Description matches the reference.' : 'Description differs from the reference.',
      status: (titleMatches && descriptionMatches) ? 'match' : (titleMatches || descriptionMatches) ? 'partial' : 'mismatch',
      analysis: ''
    },
    headings: {
      status: 'match',
      matches: [],
      analysis: ''
    },
    bodyContent: {
      status: bodyStatus,
      mismatches: comparisons,
      matchesCount,
      mismatchesCount: mismatchesOnly.length,
      analysis: ''
    },
    faqSchema: {
      present: faq.present,
      rawJson: faq.present ? JSON.stringify(faq.raw, null, 2) : '',
      status: faqStatus,
      mismatchDetails: faqMismatchDetails,
      analysis: !faq.present
        ? (faqStatus === 'missing'
          ? 'The reference document expects an FAQ section, but no FAQPage schema was found on the webpage.'
          : 'No FAQPage schema found on the webpage.')
        : faqMatchesDoc
          ? `FAQ schema present with ${faq.qa.length} question${faq.qa.length === 1 ? '' : 's'}, matching the reference document.`
          : `FAQ schema present, but ${faqMismatchDetails.length} item(s) did not match the reference document.`
    },
    featureImage: {
      applicable: !!labeledFeatureImage,
      expected: labeledFeatureImage || 'No feature image specified in the reference',
      actual: actualFeatureImage || '(No image found on the webpage)',
      matches: featureImageMatches,
      analysis: !labeledFeatureImage
        ? 'No feature image specified in the reference document.'
        : featureImageMatches
          ? 'Feature image matches the reference document.'
          : 'Feature image differs from the one specified in the reference document.'
    },
    overallScore,
    summary,
    recommendations
  };
}

// Express Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Local OCR Engine"
  });
});

app.post("/api/content-checker/analyze", async (req, res) => {
  try {
    const { url, rawHtml, image, referenceText } = req.body;

    if (!image && !(referenceText && referenceText.trim())) {
      return res.status(400).json({ error: "Missing reference document screenshot image or Google Doc reference text." });
    }

    let htmlContent = "";
    let targetUrlName = url || "Provided HTML Source";

    if (rawHtml && rawHtml.trim()) {
      htmlContent = rawHtml.trim();
    } else if (url && url.trim()) {
      const sanitizedUrl = normalizeUrl(url);
      targetUrlName = sanitizedUrl;

      try {
        const fetched = await fetchWebpageHtml(sanitizedUrl);
        htmlContent = fetched.html;
      } catch (fetchErr: any) {
        console.error("Error fetching URL:", fetchErr);
        return res.status(400).json({ 
          error: fetchErr.message || `Could not connect to target URL (${sanitizedUrl}). Make sure the URL is public or use "Paste HTML/Copy" mode.` 
        });
      }
    } else {
      return res.status(400).json({ error: "Please provide either a Target URL or Raw HTML/Copy text." });
    }

    // Parse extracted HTML content
    const parsedWebData = parseHtml(htmlContent);

    // Compare against the Google Doc text directly, or OCR the screenshot, using the
    // deterministic local comparator (no AI/LLM calls in this feature).
    const localReferenceText = referenceText && referenceText.trim()
      ? referenceText.trim()
      : (image ? await performLocalOcr(image) : undefined);
    const orderedBlocks = parseOrderedContentBlocks(scopeToMainContent(htmlContent));
    const localReport = await buildLocalReport(parsedWebData, targetUrlName, localReferenceText, orderedBlocks);
    return res.json({
      success: true,
      report: localReport,
      webpageData: {
        title: parsedWebData.title,
        description: parsedWebData.description,
        headingsCount: parsedWebData.headings.length
      }
    });

  } catch (error: any) {
    console.error("Analysis route error:", error);
    return res.status(500).json({ 
      error: `Internal server analysis failure: ${error.message || error}` 
    });
  }
});

// Endpoint to resolve Awesome Screenshot and other image sharing pages to Base64
app.post("/api/content-checker/resolve-awesome-screenshot", async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing share link URL." });
    }

    url = normalizeUrl(url);

    let imageUrl = "";

    // If it's a direct image link
    if (/\.(png|jpe?g|webp|gif)(?:\?.*)?$/i.test(url)) {
      imageUrl = url;
    } else {
      const pageResponse = await fetch(url, {
        headers: {
          "User-Agent": DESKTOP_USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!pageResponse.ok) {
        return res.status(400).json({ error: `Could not fetch shared link. Status: ${pageResponse.status} ${pageResponse.statusText}` });
      }

      const rawHtml = await pageResponse.text();
      // Unescape slashes commonly present in JSON payloads within script tags
      const unescapedHtml = rawHtml.replace(/\\\/|\\u002F/g, '/');

      const candidates: string[] = [];

      // 1. Check meta tags (og:image, twitter:image)
      const metaMatches = unescapedHtml.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/gi);
      for (const m of metaMatches) {
        if (m[1]) candidates.push(m[1]);
      }
      const metaMatchesReverse = unescapedHtml.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["']/gi);
      for (const m of metaMatchesReverse) {
        if (m[1]) candidates.push(m[1]);
      }

      // 2. Look for JSON keys in script blocks or window state (e.g. Next.js data, React state)
      const jsonUrlRegex = /"(?:image_url|imageUrl|file_url|fileUrl|original_url|download_url|downloadUrl|preview_url|previewUrl|share_url|src|url)":\s*"([^"]+)"/gi;
      let jsonMatch;
      while ((jsonMatch = jsonUrlRegex.exec(unescapedHtml)) !== null) {
        const val = jsonMatch[1];
        if (val.startsWith('http') || val.startsWith('//')) {
          candidates.push(val);
        }
      }

      // 3. Look for explicit AWS S3 / CloudFront / AwesomeScreenshot CDN image URLs in full HTML
      const cdnRegex = /(https?:\/\/[^"'\s<>]+?\.(?:png|jpe?g|webp|gif)(?:\?[^"'\s<>]*)?)/gi;
      let cdnMatch;
      while ((cdnMatch = cdnRegex.exec(unescapedHtml)) !== null) {
        candidates.push(cdnMatch[1]);
      }

      // 4. Look for <img> tag src
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(unescapedHtml)) !== null) {
        candidates.push(imgMatch[1]);
      }

      // Score and select the best candidate image URL
      const scored = candidates
        .map(c => {
          let href = c.replace(/&amp;/g, '&');
          if (href.startsWith('//')) href = 'https:' + href;
          try {
            href = new URL(href, url).href;
          } catch {
            // keep as is
          }

          let score = 0;
          const lower = href.toLowerCase();

          // Reject non-image / logo / icon / avatar noise
          if (lower.includes('favicon') || lower.includes('logo') || lower.includes('avatar') || lower.includes('icon') || lower.includes('pixel') || lower.endsWith('.svg')) {
            return { href, score: -100 };
          }

          if (lower.includes('awesomescreenshot') || lower.includes('cloudfront') || lower.includes('s3.amazonaws.com') || lower.includes('user_upload') || lower.includes('screenshot')) {
            score += 50;
          }
          if (lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.webp')) {
            score += 30;
          }
          if (lower.includes('original') || lower.includes('full') || lower.includes('download') || lower.includes('storage')) {
            score += 20;
          }

          return { href, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        imageUrl = scored[0].href;
      }
    }

    if (!imageUrl) {
      return res.status(400).json({ error: "Could not locate a screenshot image on the shared link page. Please ensure the link is public or upload the screenshot image file directly." });
    }

    imageUrl = imageUrl.replace(/&amp;/g, '&');

    const imgResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": url,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!imgResponse.ok) {
      return res.status(400).json({ error: `Failed to download screenshot image asset from resolved URL: ${imageUrl}` });
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const contentType = imgResponse.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    return res.json({
      success: true,
      imageUrl,
      base64: dataUrl
    });

  } catch (err: any) {
    console.error("Resolve screenshot error:", err);
    return res.status(500).json({ error: `Failed to resolve shared link: ${err.message || err}` });
  }
});

// ---------------------------------------------------------------------------
// Responsive preview proxy
//
// A site loaded straight into an <iframe> is cross-origin, so the tool can
// neither measure its layout nor stop it from refusing to be framed. Streaming
// the HTML through here makes the preview same-origin, which lets a small
// injected probe report the real document width back to the parent page.
// ---------------------------------------------------------------------------

const RESPONSIVE_UA: Record<string, string> = {
  mobile:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  tablet:
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

// Loopback/LAN targets are the point when previewing a local dev server, but
// they would turn this route into an SSRF hole on a public deployment.
const ALLOW_PRIVATE_PREVIEW_HOSTS = process.env.NODE_ENV !== "production";

function isPrivatePreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "0.0.0.0") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^(fc|fd|fe80)/i.test(host)) return true;
  return false;
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toJsLiteral(value: string): string {
  return JSON.stringify(String(value));
}

// Runs inside the previewed page. Dependency-free and defensive on purpose: a
// throw in here would take the user's site down with it.
function buildPreviewProbe(frameId: string, realUrl: string, uaKey: string): string {
  const userAgent = RESPONSIVE_UA[uaKey] || RESPONSIVE_UA.desktop;
  const touch = uaKey === "mobile" || uaKey === "tablet";

  const script = String.raw`
(function () {
  var FRAME_ID = __FRAME_ID__;
  var REAL_URL = __REAL_URL__;
  var UA_KEY = __UA_KEY__;
  var UA = __UA__;
  var TOUCH = __TOUCH__;

  try {
    Object.defineProperty(navigator, "userAgent", { get: function () { return UA; }, configurable: true });
    Object.defineProperty(navigator, "appVersion", { get: function () { return UA.replace("Mozilla/", ""); }, configurable: true });
    if (TOUCH) {
      Object.defineProperty(navigator, "maxTouchPoints", { get: function () { return 5; }, configurable: true });
      Object.defineProperty(navigator, "platform", { get: function () { return UA_KEY === "tablet" ? "iPad" : "iPhone"; }, configurable: true });
      if (!("ontouchstart" in window)) { window.ontouchstart = null; }
    }
  } catch (e) { /* the site just keeps its own UA */ }

  // Lets the preview (and anyone debugging it) confirm the probe is alive.
  try { document.documentElement.setAttribute("data-rp-probe", "ready"); } catch (e) { /* noop */ }

  function post(message) {
    message.source = "rp-probe";
    message.frameId = FRAME_ID;
    try { parent.postMessage(message, "*"); } catch (e) { /* detached frame */ }
  }

  function cssPath(el) {
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      var part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(part + "#" + node.id); break; }
      var classes = (node.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (classes.length) { part += "." + classes.join("."); }
      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }

  var offenderNodes = [];

  var REPLACED = {
    IMG: 1, VIDEO: 1, CANVAS: 1, SVG: 1, IFRAME: 1, EMBED: 1, OBJECT: 1,
    INPUT: 1, SELECT: 1, TEXTAREA: 1, BUTTON: 1, HR: 1,
  };

  function isTransparent(color) {
    if (!color || color === "transparent") return true;
    var parts = color.match(/rgba?\(([^)]+)\)/);
    if (!parts) return false;
    var bits = parts[1].split(",");
    return bits.length > 3 && parseFloat(bits[3]) === 0;
  }

  function hasVisibleBorder(style) {
    var sides = ["Top", "Right", "Bottom", "Left"];
    for (var i = 0; i < sides.length; i++) {
      var lineStyle = style["border" + sides[i] + "Style"];
      if (lineStyle === "none" || lineStyle === "hidden") continue;
      if (parseFloat(style["border" + sides[i] + "Width"]) <= 0) continue;
      if (isTransparent(style["border" + sides[i] + "Color"])) continue;
      return true;
    }
    return false;
  }

  // Does the element's own box put pixels on screen, or is it just a transparent
  // wrapper? A too-wide wrapper that paints nothing is invisible to a visitor,
  // so it must not drive the verdict — only its painting descendants can.
  function paintsInk(el, style) {
    if (REPLACED[el.tagName]) return true;
    if (style.backgroundImage && style.backgroundImage !== "none") return true;
    if (!isTransparent(style.backgroundColor)) return true;
    if (style.boxShadow && style.boxShadow !== "none") return true;
    if (hasVisibleBorder(style)) return true;
    if (style.outlineStyle && style.outlineStyle !== "none"
      && parseFloat(style.outlineWidth) > 0 && !isTransparent(style.outlineColor)) return true;
    return false;
  }

  // Where this element's own text actually lands. A block can be far wider than
  // the words inside it, so the box edge overstates the visible reach.
  function textInk(el) {
    var span = null;
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType !== 3 || !/\S/.test(node.nodeValue)) continue;
      var range = document.createRange();
      range.selectNodeContents(node);
      var rects = range.getClientRects();
      for (var r = 0; r < rects.length; r++) {
        var box = rects[r];
        if (box.width <= 0 || box.height <= 0) continue;
        if (!span) span = { left: box.left, right: box.right };
        if (box.left < span.left) span.left = box.left;
        if (box.right > span.right) span.right = box.right;
      }
    }
    return span;
  }

  // opacity and content-visibility are not inherited, so an invisible ancestor
  // has to be walked for rather than read off the element's own computed style.
  function hiddenByAncestor(el) {
    var node = el.parentElement;
    while (node) {
      var style = window.getComputedStyle(node);
      if (style.display === "none") return true;
      if (style.visibility === "hidden" || style.visibility === "collapse") return true;
      if (parseFloat(style.opacity) === 0) return true;
      if (style.contentVisibility === "hidden") return true;
      node = node.parentElement;
    }
    return false;
  }

  // The nearest ancestor that clips horizontally. A carousel track is meant to
  // be wider than the screen and is contained by its own overflow:hidden — it
  // is not a page overflow, and reporting it would be a false alarm.
  function clippingAncestor(el) {
    var node = el.parentElement;
    while (node) {
      if (window.getComputedStyle(node).overflowX !== "visible") return node;
      node = node.parentElement;
    }
    return null;
  }

  function describe(item, index, viewportWidth, rtl) {
    return {
      index: index,
      selector: cssPath(item.el),
      tag: item.el.tagName.toLowerCase(),
      ghost: Boolean(item.ghost),
      width: Math.round(item.rect.width),
      overhang: Math.round(rtl ? -item.inkLeft : item.inkRight - viewportWidth),
      text: (item.el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70)
    };
  }

  // An overflowing child drags every ancestor past the edge with it, so only the
  // innermost nodes are worth reporting.
  function deepestOnly(list) {
    return list.filter(function (candidate) {
      return !list.some(function (other) { return other.el !== candidate.el && candidate.el.contains(other.el); });
    }).slice(0, 20);
  }

  function scan() {
    var docEl = document.documentElement;
    var body = document.body;
    if (!docEl || !body) return;

    var viewportWidth = docEl.clientWidth || window.innerWidth;
    // Only one edge can actually overflow. In LTR, content parked at a negative
    // left is unreachable and adds no scrollable area: a negative left offset
    // is a decades-old way to HIDE something, not a layout bug.
    var rtl = window.getComputedStyle(docEl).direction === "rtl";
    // Only the root scroller decides whether the page actually pans sideways.
    var scrollWidth = docEl.scrollWidth;
    var scrolls = scrollWidth - viewportWidth > 1;

    var unclipped = [];
    var rootClipped = [];
    var maxOverhang = 0;
    // Boxes that reach past the edge while painting nothing. They never set the
    // verdict, but a real-but-invisible 103% wrapper still has to be findable.
    var ghostEntries = [];

    var nodes = body.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute("data-rp-overlay")) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) continue;
      var right = rect.right + window.scrollX;
      var left = rect.left + window.scrollX;
      if (right <= viewportWidth + 1 && left >= -1) continue;
      var style = window.getComputedStyle(el);
      // Fixed layers sit outside document flow and never widen the page.
      if (style.position === "fixed") continue;
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (parseFloat(style.opacity) === 0) continue;
      if (style.contentVisibility === "hidden") continue;
      if (hiddenByAncestor(el)) continue;

      // Only ink counts. The box may be 1400px wide, but if it paints no
      // background and holds no text of its own, nothing is visibly past the
      // edge — a painting descendant will be caught on its own pass.
      var inkLeft = Infinity;
      var inkRight = -Infinity;
      if (rect.width > 0 && rect.height > 0 && paintsInk(el, style)) {
        inkLeft = left;
        inkRight = right;
      }
      var words = textInk(el);
      if (words) {
        if (words.left + window.scrollX < inkLeft) inkLeft = words.left + window.scrollX;
        if (words.right + window.scrollX > inkRight) inkRight = words.right + window.scrollX;
      }
      var overhang = inkRight === -Infinity ? -1 : (rtl ? -inkLeft : inkRight - viewportWidth);
      if (overhang <= 1) {
        // No ink past the edge. Still worth counting when the *box* runs over,
        // so an invisible 103% wrapper stays findable without setting a verdict.
        var boxOverhang = rtl ? -left : right - viewportWidth;
        var ghostClipper = boxOverhang > 1 ? clippingAncestor(el) : null;
        if (boxOverhang > 1 && ghostEntries.length < 20
          && (!ghostClipper || ghostClipper === docEl || ghostClipper === body)) {
          ghostEntries.push({ el: el, rect: rect, right: right, left: left, inkRight: right, inkLeft: left, ghost: true });
        }
        continue;
      }

      var clipper = clippingAncestor(el);
      var entry = { el: el, rect: rect, right: right, left: left, inkRight: inkRight, inkLeft: inkLeft };
      if (!clipper) {
        unclipped.push(entry);
      } else if (clipper === docEl || clipper === body) {
        // Reaches the page edge and is only held back by overflow-x:hidden on
        // the root — worth flagging, since iOS Safari can still pan it.
        rootClipped.push(entry);
      } else {
        continue; // contained by its own scroller; normal markup
      }
      if (overhang > maxOverhang) maxOverhang = overhang;
    }

    var primary = deepestOnly(unclipped.length ? unclipped : rootClipped);
    // The page really does pan, so something is responsible even if it paints
    // nothing. Better a transparent culprit than an empty list.
    if (!primary.length && scrolls && ghostEntries.length) primary = deepestOnly(ghostEntries);
    offenderNodes = primary.map(function (item) { return item.el; });

    var contentWidth = scrolls ? scrollWidth : Math.round(viewportWidth + maxOverhang);
    var overflowAmount = Math.max(0, Math.round(contentWidth - viewportWidth));
    var clipped = !scrolls && primary.length > 0 && overflowAmount > 0;

    post({
      type: "metrics",
      viewportWidth: viewportWidth,
      documentWidth: contentWidth,
      overflow: scrolls,
      clipped: clipped,
      overflowAmount: overflowAmount,
      scrollHeight: Math.round(Math.max(docEl.scrollHeight, body.scrollHeight)),
      viewportHeight: docEl.clientHeight || window.innerHeight,
      title: document.title || "",
      url: REAL_URL,
      ghosts: ghostEntries.length,
      offenders: primary.map(function (item, index) { return describe(item, index, viewportWidth, rtl); })
    });
  }

  var scanTimer = null;
  function scheduleScan(delay) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () { scanTimer = null; scan(); }, delay || 250);
  }

  var overlay = null;
  function highlight(index) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.setAttribute("data-rp-overlay", "1");
      overlay.style.cssText = "position:absolute;z-index:2147483647;pointer-events:none;border:2px solid #e11d48;background:rgba(225,29,72,0.16);border-radius:2px;";
      (document.body || document.documentElement).appendChild(overlay);
    }
    var el = (index === null || index === undefined) ? null : offenderNodes[index];
    if (!el) { overlay.style.display = "none"; return; }
    var rect = el.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.top = (rect.top + window.scrollY) + "px";
    overlay.style.left = (rect.left + window.scrollX) + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
  }

  var suppressScrollEcho = false;
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "rp-host") return;
    if (data.type === "rescan") {
      scan();
    } else if (data.type === "highlight") {
      try { highlight(data.index); } catch (e) { /* noop */ }
    } else if (data.type === "scroll") {
      var docEl = document.documentElement;
      var max = Math.max(0, Math.max(docEl.scrollHeight, document.body.scrollHeight) - (docEl.clientHeight || window.innerHeight));
      suppressScrollEcho = true;
      window.scrollTo(0, Math.round(data.ratio * max));
      setTimeout(function () { suppressScrollEcho = false; }, 80);
    }
  });

  var scrollQueued = false;
  window.addEventListener("scroll", function () {
    if (suppressScrollEcho || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      var docEl = document.documentElement;
      var max = Math.max(1, Math.max(docEl.scrollHeight, document.body.scrollHeight) - (docEl.clientHeight || window.innerHeight));
      post({ type: "scroll", ratio: Math.min(1, (window.scrollY || 0) / max) });
    });
  }, { passive: true });

  // Keep in-page navigation inside the proxy so measurement survives a click.
  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    var anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    var raw = anchor.getAttribute("href") || "";
    if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) return;
    var absolute;
    try { absolute = new URL(anchor.href, REAL_URL).href; } catch (e) { return; }
    if (!/^https?:/i.test(absolute)) return;
    event.preventDefault();
    // The host drives the navigation by swapping the frame's src, which keeps
    // its address bar in step and avoids loading the next page twice.
    post({ type: "navigate", url: absolute });
  }, true);

  window.addEventListener("resize", function () { scheduleScan(120); });
  document.addEventListener("DOMContentLoaded", function () { scan(); });
  window.addEventListener("load", function () { scan(); });

  // Sliders, lazy images and hydration routinely overflow for a moment before
  // they settle. Keep re-measuring for a while so the reported number is the
  // settled layout, not a transient mid-load width.
  [80, 500, 1200, 2500, 4500].forEach(function (delay) { setTimeout(scan, delay); });
  var settleTimer = setInterval(scan, 1500);
  setTimeout(function () { clearInterval(settleTimer); }, 20000);

  try {
    var sizeObserver = new ResizeObserver(function () { scheduleScan(250); });
    var watchBody = function () {
      if (!document.body) { setTimeout(watchBody, 50); return; }
      sizeObserver.observe(document.body);
      sizeObserver.observe(document.documentElement);
    };
    watchBody();
  } catch (e) { /* timers still cover it */ }

  // Late fonts, lazy images and hydration all shift layout well after load.
  try {
    var observer = new MutationObserver(function () { scheduleScan(400); });
    var start = function () {
      if (!document.body) { setTimeout(start, 50); return; }
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "width", "src"] });
    };
    start();
  } catch (e) { /* observation is a bonus; timed scans still run */ }
})();
`;

  return script
    .replace("__FRAME_ID__", toJsLiteral(frameId))
    .replace("__REAL_URL__", toJsLiteral(realUrl))
    .replace("__UA_KEY__", toJsLiteral(uaKey))
    .replace("__UA__", toJsLiteral(userAgent))
    .replace("__TOUCH__", String(touch));
}

function buildPreviewErrorPage(frameId: string, targetUrl: string, message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;font:500 13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#0f172a;color:#e2e8f0}
    .wrap{height:100%;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center}
    a{color:#c4b5fd}
  </style></head><body><div class="wrap"><div>
    <p style="font-weight:700;margin:0 0 6px">Could not load this page</p>
    <p style="margin:0 0 10px;color:#94a3b8">${escapeHtmlAttribute(message)}</p>
    <a href="${escapeHtmlAttribute(targetUrl)}" target="_blank" rel="noreferrer">Open directly</a>
  </div></div>
  <script>try{parent.postMessage({source:"rp-probe",frameId:${toJsLiteral(frameId)},type:"error",message:${toJsLiteral(message)}},"*")}catch(e){}</script>
  </body></html>`;
}

// Lets the preview tool tell "the server is stale" apart from "the site failed
// to load" — without it, a server predating the proxy route just renders the
// /api/* catch-all's JSON 404 inside the device screen.
app.get("/api/responsive/status", (req, res) => {
  res.json({ ok: true, allowsPrivateHosts: ALLOW_PRIVATE_PREVIEW_HOSTS });
});

app.get("/api/responsive/proxy", async (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  const frameId = String(req.query.fid || "frame");
  const uaKey = ["mobile", "tablet", "desktop"].includes(String(req.query.ua)) ? String(req.query.ua) : "desktop";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  // Our own framing policy, not the origin site's.
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  res.removeHeader("X-Frame-Options");

  let target: URL;
  try {
    target = new URL(rawUrl);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("unsupported protocol");
  } catch {
    res.status(400).send(buildPreviewErrorPage(frameId, rawUrl || "about:blank", "That is not a valid http(s) URL."));
    return;
  }

  if (!ALLOW_PRIVATE_PREVIEW_HOSTS && isPrivatePreviewHost(target.hostname)) {
    res.status(403).send(buildPreviewErrorPage(frameId, target.href, "Previewing private network addresses is disabled on this server."));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetch(target.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": RESPONSIVE_UA[uaKey],
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "upgrade-insecure-requests": "1",
      },
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      res.status(415).send(buildPreviewErrorPage(frameId, target.href, `This URL returned ${contentType || "a non-HTML response"}.`));
      return;
    }

    const finalUrl = upstream.url || target.href;
    let html = await upstream.text();

    if (!upstream.ok && html.trim().length < 40) {
      res.status(502).send(buildPreviewErrorPage(frameId, target.href, `The site responded with HTTP ${upstream.status}.`));
      return;
    }

    // A page CSP delivered by <meta> would block the probe. The header form is
    // already gone because we send our own headers.
    html = html.replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "");

    // Relative assets have to resolve against the origin site, not this server.
    let baseHref = finalUrl;
    const existingBase = html.match(/<base[^>]*\shref\s*=\s*["']([^"']+)["'][^>]*>/i);
    if (existingBase) {
      try { baseHref = new URL(existingBase[1], finalUrl).href; } catch { baseHref = finalUrl; }
    }
    html = html.replace(/<base[^>]*>/gi, "");

    const injection =
      `<base href="${escapeHtmlAttribute(baseHref)}">` +
      // Real phones use overlay scrollbars. A classic desktop scrollbar would
      // steal ~15px from the viewport and fake an overflow that isn't there.
      `<style>html{scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}</style>` +
      `<script data-rp-probe>${buildPreviewProbe(frameId, finalUrl, uaKey)}</script>`;

    const headOpen = html.match(/<head[^>]*>/i);
    if (headOpen) {
      html = html.replace(headOpen[0], headOpen[0] + injection);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (match) => `${match}<head>${injection}</head>`);
    } else {
      html = injection + html;
    }

    res.status(200).send(html);
  } catch (error: any) {
    const message = error?.name === "AbortError" ? "The site took too long to respond." : (error?.message || "Network request failed.");
    res.status(502).send(buildPreviewErrorPage(frameId, target.href, message));
  } finally {
    clearTimeout(timeout);
  }
});

// Explicit JSON 404 Catch-All for any unhandled /api route
app.all("/api/*", (req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Explicit JSON Error handler for all /api requests (catches body-parser & server errors)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express API error handler caught:", err);
  const statusCode = err.status || err.statusCode || 500;
  if (req.originalUrl && req.originalUrl.startsWith("/api")) {
    return res.status(statusCode).json({
      error: err.message || "An internal server error occurred while processing the API request."
    });
  }
  next(err);
});

// Setup Vite Dev server middleware OR serve production static files
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      // Vite content-hashes everything under /assets, so those files can be
      // cached forever; index.html (and anything else) must always revalidate.
      setHeaders: (res, filePath) => {
        if (filePath.startsWith(path.join(distPath, 'assets') + path.sep)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupFrontend();
