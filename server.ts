import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import Tesseract from "tesseract.js";
import compression from "compression";
import { contentAuditRouter } from "./server/content-auditor/routes/contentAuditRoutes";
import { googleAuthRouter } from "./server/content-auditor/auth/googleAuthRoutes";

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

function sanitizeAndParseJsonLd(rawJsonLd: string): any {
  if (!rawJsonLd) return null;
  // 1. Remove CDATA wrappers
  let s = rawJsonLd
    .replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/$/gi, '')
    .replace(/^\s*<!\[CDATA\[|\]\]>\s*$/gi, '')
    .trim();

  // 2. Strip JavaScript comments (block and line comments, preserving URLs)
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^\\:])\/\/.*$/gm, '$1').trim();

  try {
    return JSON.parse(s);
  } catch {
    // 3. Strip trailing commas before closing braces/brackets
    let fixed = s.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch {
      // 4. Decode HTML entities (e.g. &quot;, &#34;) and retry
      fixed = decodeHtmlEntities(fixed).replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(fixed);
    }
  }
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
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const rawScriptContent = scriptMatch[1].trim();
    if (!rawScriptContent) continue;
    try {
      const parsed = sanitizeAndParseJsonLd(rawScriptContent);
      if (!parsed) continue;

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
        if (typeStr.includes('FAQPage')) return obj;

        for (const [k, v] of Object.entries(obj)) {
          if (k !== '@context' && typeof v === 'object' && v !== null) {
            const found = findFaq(v);
            if (found) return found;
          }
        }
        return null;
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
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const rawScriptContent = scriptMatch[1].trim();
    if (!rawScriptContent) continue;
    try {
      const parsed = sanitizeAndParseJsonLd(rawScriptContent);
      if (!parsed) continue;

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

        const schemaType = obj['@type'] || obj['type'];
        if (schemaType) {
          const typeStr = Array.isArray(schemaType) ? schemaType.join(', ') : String(schemaType);
          const issues: { type: 'error' | 'warning' | 'info'; message: string; field?: string }[] = [];

          if (typeStr.includes('Article') || typeStr.includes('BlogPosting') || typeStr.includes('NewsArticle')) {
            if (!obj.headline && !obj.name) issues.push({ type: 'warning', message: 'Missing "headline" property.', field: 'headline' });
            if (!obj.image) issues.push({ type: 'warning', message: 'Missing "image" property (recommended for Rich Snippets).', field: 'image' });
            if (!obj.datePublished) issues.push({ type: 'info', message: 'Missing "datePublished" property.', field: 'datePublished' });
            if (!obj.author) issues.push({ type: 'info', message: 'Missing "author" property.', field: 'author' });
            if (!obj.publisher) issues.push({ type: 'info', message: 'Missing "publisher" property.', field: 'publisher' });
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
          } else if (typeStr.includes('WebSite')) {
            if (!obj.name && !obj.url) issues.push({ type: 'warning', message: 'WebSite schema should specify "name" and "url".', field: 'name' });
          } else if (typeStr.includes('SoftwareApplication') || typeStr.includes('WebApplication')) {
            if (!obj.name) issues.push({ type: 'error', message: 'Missing required "name" property.', field: 'name' });
            if (!obj.applicationCategory) issues.push({ type: 'info', message: 'Missing "applicationCategory" property.', field: 'applicationCategory' });
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
        }

        // Recursively inspect nested objects for child entities (author, publisher, provider, etc.)
        for (const [key, val] of Object.entries(obj)) {
          if (key !== '@graph' && key !== '@context' && typeof val === 'object' && val !== null) {
            if (Array.isArray(val)) {
              val.forEach(item => {
                if (typeof item === 'object' && item !== null && ((item as any)['@type'] || (item as any)['type'])) {
                  processSchemaObj(item);
                }
              });
            } else if ((val as any)['@type'] || (val as any)['type']) {
              processSchemaObj(val);
            }
          }
        }
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

  // Microdata and RDFa Semantic Entity Checks
  const microdataRegex = /<[^>]+(itemscope|typeof)[^>]*>/gi;
  let mdMatch;
  while ((mdMatch = microdataRegex.exec(html)) !== null) {
    const tag = mdMatch[0];
    const typeMatch = tag.match(/(?:itemtype|typeof)=["']([^"']+)["']/i);
    const itemType = typeMatch ? typeMatch[1].split(/[\/#:]/).pop() || typeMatch[1] : 'SemanticItem';
    schemas.push({
      schemaType: itemType,
      source: /itemscope/i.test(tag) ? 'microdata' : 'rdfa',
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

  // 4. Gateway Proxy 3: CodeTabs
  try {
    const proxy3 = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(sanitizedUrl)}`;
    const res3 = await fetch(proxy3, {
      headers: { "User-Agent": browserHeaders["User-Agent"] },
      signal: AbortSignal.timeout(10000)
    });
    if (res3.ok) {
      const text3 = await res3.text();
      if (text3 && text3.trim().length > 30) {
        return { html: text3, notice: "Fetched webpage via alternate proxy gateway." };
      }
    }
  } catch (err3: any) {
    console.warn(`Proxy 3 failed for ${sanitizedUrl}:`, err3.message || err3);
  }

  // 5. Gateway Proxy 4: ThingProxy
  try {
    const proxy4 = `https://thingproxy.freeboard.io/fetch/${sanitizedUrl}`;
    const res4 = await fetch(proxy4, {
      headers: { "User-Agent": browserHeaders["User-Agent"] },
      signal: AbortSignal.timeout(10000)
    });
    if (res4.ok) {
      const text4 = await res4.text();
      if (text4 && text4.trim().length > 30) {
        return { html: text4, notice: "Fetched webpage via secure proxy gateway." };
      }
    }
  } catch (err4: any) {
    console.warn(`Proxy 4 failed for ${sanitizedUrl}:`, err4.message || err4);
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

// Mount Content Auditor Router (modularized in server/content-auditor/)
app.use("/api/content-checker", contentAuditRouter);
app.use("/api/google", googleAuthRouter);

// Express Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Local OCR Engine"
  });
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
