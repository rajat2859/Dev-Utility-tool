import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
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
const PORT = 3000;

// Compress all responses (static JS/CSS bundles & JSON API payloads)
app.use(compression());

// Increase body-parser limits for the base64 screenshot upload
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini Client lazily or at startup
function getGeminiClient(): GoogleGenAI | null {
  const currentKey = process.env.GEMINI_API_KEY;
  if (!currentKey || currentKey.trim() === "") return null;
  if (currentKey.startsWith("ya29.")) {
    // Avoid sending unsupported OAuth tokens as standard API key headers
    return null;
  }
  return new GoogleGenAI({
    apiKey: currentKey,
    httpOptions: {
      headers: {
        'User-Agent': 'utility-tool-manager',
      }
    }
  });
}

// Structured output schema for the analysis report
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    seo: {
      type: Type.OBJECT,
      properties: {
        titleMatches: { type: Type.BOOLEAN },
        expectedTitle: { type: Type.STRING },
        actualTitle: { type: Type.STRING },
        titleDifference: { type: Type.STRING },
        descriptionMatches: { type: Type.BOOLEAN },
        expectedDescription: { type: Type.STRING },
        actualDescription: { type: Type.STRING },
        descriptionDifference: { type: Type.STRING },
        status: { type: Type.STRING }, // "match", "partial", "mismatch"
        analysis: { type: Type.STRING }
      },
      required: [
        "titleMatches", "expectedTitle", "actualTitle", "titleDifference",
        "descriptionMatches", "expectedDescription", "actualDescription",
        "descriptionDifference", "status", "analysis"
      ]
    },
    headings: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING }, // "match", "partial", "mismatch"
        matches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              level: { type: Type.STRING }, // "h1", "h2", "h3", "h4"
              expectedText: { type: Type.STRING },
              actualText: { type: Type.STRING },
              status: { type: Type.STRING }, // "match", "partial", "mismatch"
              comment: { type: Type.STRING }
            },
            required: ["level", "expectedText", "actualText", "status", "comment"]
          }
        },
        analysis: { type: Type.STRING }
      },
      required: ["status", "matches", "analysis"]
    },
    bodyContent: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING }, // "match", "partial", "mismatch"
        mismatches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              expected: { type: Type.STRING },
              actual: { type: Type.STRING },
              severity: { type: Type.STRING }, // "high", "medium", "low"
              comment: { type: Type.STRING }
            },
            required: ["category", "expected", "actual", "severity", "comment"]
          }
        },
        matchesCount: { type: Type.INTEGER },
        mismatchesCount: { type: Type.INTEGER },
        analysis: { type: Type.STRING }
      },
      required: ["status", "mismatches", "matchesCount", "mismatchesCount", "analysis"]
    },
    overallScore: { type: Type.INTEGER }, // 0 to 100
    summary: { type: Type.STRING },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["seo", "headings", "bodyContent", "overallScore", "summary", "recommendations"]
};

// Shared HTML micro-parsing helpers (used by both parseFullSeoAndSchemas and parseHtml)
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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
  const title = extractPageTitle(html);

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

  // Extract Tables (<table>, <tr>, <th>, <td>)
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const headers: string[] = [];
    const rows: string[][] = [];

    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch;
    while ((thMatch = thRegex.exec(tableHtml)) !== null) {
      const thText = stripTags(thMatch[1]);
      if (thText) headers.push(thText);
    }

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const trHtml = trMatch[1];
      const rowCells: string[] = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(trHtml)) !== null) {
        const tdText = stripTags(tdMatch[1]);
        if (tdText) rowCells.push(tdText);
      }
      if (rowCells.length > 0) {
        rows.push(rowCells);
      }
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
// between them, which is the normal case. Table cells (Docs exports each as its own tab-indented
// continuation line) are dropped since the page's own table cells aren't part of this alignment.
function splitReferenceBlocks(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .filter((l) => !l.startsWith('\t'))
    .map((l) => l.replace(/^[*\-•]\s*/, '').trim())
    .filter((l) => l.length > 0);
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

// Finds an explicitly-labeled line like "Meta title: ..." or "Meta description: ..." anywhere in
// the reference (a common content-brief convention), stripping any trailing "(53 chars)" annotation.
function extractLabeledLine(text: string, label: string): string {
  const re = new RegExp(`^\\s*${label}\\s*:?\\s*(.+)$`, 'im');
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

// Walks the HTML once so headings, paragraphs, and list items come back in true document
// order (interleaved), which is required to align them positionally against a reference
// document written in the same reading order — heading-to-heading, paragraph-to-paragraph.
function parseOrderedContentBlocks(html: string): { type: 'heading' | 'paragraph' | 'listItem'; level?: string; text: string }[] {
  const body = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

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

// Deterministic compliance report: aligns the reference (Google Doc text or OCR output) against
// the webpage's own content. Title/description come from explicit "Meta title:"/"Meta description:"
// labels if the reference uses that content-brief convention, otherwise from its first two lines.
// The body (heading-to-heading, paragraph-to-paragraph) is aligned by position, skipping past any
// metadata/heading-outline preamble so alignment starts at the reference's actual prose.
async function buildLocalReport(
  parsedWebData: ReturnType<typeof parseHtml>,
  url: string,
  referenceText: string | undefined,
  orderedBlocks: { type: 'heading' | 'paragraph' | 'listItem'; level?: string; text: string }[]
) {
  const rawReference = referenceText || '';
  const hasReference = rawReference.trim().length > 0;

  const labeledTitle = extractLabeledLine(rawReference, 'meta title');
  const labeledDescription = extractLabeledLine(rawReference, 'meta description');

  let refTitle: string;
  let refDescription: string;
  let refBodyBlocks: string[];

  if (labeledTitle || labeledDescription) {
    refTitle = labeledTitle;
    refDescription = labeledDescription;
    refBodyBlocks = splitReferenceBlocks(skipReferencePreamble(rawReference))
      // Safety net if no heading outline was found to skip past: drop any leftover metadata lines.
      .filter(b => !/^(url|meta title|meta description|primary keyword|secondary keywords?|required schema|internal links?|heading structure)\s*:?/i.test(b));
  } else {
    const referenceBlocks = splitReferenceBlocks(rawReference);
    refTitle = referenceBlocks[0] || '';
    refDescription = referenceBlocks[1] || '';
    refBodyBlocks = referenceBlocks.slice(2);
  }

  const hasTitle = !!parsedWebData.title;
  const hasDescription = !!parsedWebData.description;

  // Title & meta description, compared directly against the reference's first two lines
  const titleMatches = hasReference ? textsRoughlyMatch(parsedWebData.title, refTitle) : hasTitle;
  const descriptionMatches = hasReference ? textsRoughlyMatch(parsedWebData.description, refDescription) : hasDescription;

  // Heading-to-heading, paragraph-to-paragraph — aligned in reading order, but NOT by rigid index:
  // a single extra/missing heading, callout box, or table on either side would otherwise permanently
  // shift every comparison after it out of sync. Instead this walks both sequences together and, on
  // a mismatch, looks a short distance ahead in each side for the next real match, skipping over
  // whichever side has the extra content so the rest of the document realigns (like a text diff).
  const LOOKAHEAD = 30;
  const categoryFor = (pageBlock: typeof orderedBlocks[number] | undefined) =>
    !pageBlock
      ? 'Extra Reference Content'
      : pageBlock.type === 'heading'
        ? `Heading (${(pageBlock.level || 'h').toUpperCase()})`
        : pageBlock.type === 'listItem'
          ? 'List Item'
          : 'Paragraph';

  const comparisons: Array<{
    category: string;
    expected: string;
    actual: string;
    severity: 'high' | 'medium' | 'low';
    comment: string;
    status: 'match' | 'mismatch';
  }> = [];

  let matchesCount = 0;
  const pushComparison = (pageBlock: typeof orderedBlocks[number] | undefined, refLine: string | undefined, isMatch: boolean) => {
    if (isMatch) matchesCount++;
    comparisons.push({
      category: categoryFor(pageBlock),
      expected: refLine || '(not present in the reference)',
      actual: pageBlock ? pageBlock.text : '(missing on the webpage)',
      severity: 'medium',
      comment: isMatch
        ? 'Matches the reference (styling ignored, text only).'
        : 'Differs from the reference at this position (styling ignored, text only).',
      status: isMatch ? 'match' : 'mismatch'
    });
  };

  let pi = 0;
  let ri = 0;
  while (hasReference ? (pi < orderedBlocks.length || ri < refBodyBlocks.length) : pi < orderedBlocks.length) {
    if (pi >= orderedBlocks.length) {
      pushComparison(undefined, refBodyBlocks[ri], false);
      ri++;
      continue;
    }
    if (!hasReference || ri >= refBodyBlocks.length) {
      pushComparison(orderedBlocks[pi], undefined, false);
      pi++;
      continue;
    }

    const pageText = orderedBlocks[pi].text;
    const refText = refBodyBlocks[ri];
    if (textsRoughlyMatch(pageText, refText)) {
      pushComparison(orderedBlocks[pi], refText, true);
      pi++; ri++;
      continue;
    }

    let pageAhead = -1;
    for (let k = 1; k <= LOOKAHEAD && pi + k < orderedBlocks.length; k++) {
      if (textsRoughlyMatch(orderedBlocks[pi + k].text, refText)) { pageAhead = k; break; }
    }
    let refAhead = -1;
    for (let k = 1; k <= LOOKAHEAD && ri + k < refBodyBlocks.length; k++) {
      if (textsRoughlyMatch(pageText, refBodyBlocks[ri + k])) { refAhead = k; break; }
    }

    if (pageAhead === -1 && refAhead === -1) {
      // No resync point nearby — report this one pair as a genuine mismatch and move on together.
      pushComparison(orderedBlocks[pi], refText, false);
      pi++; ri++;
    } else if (pageAhead !== -1 && (refAhead === -1 || pageAhead <= refAhead)) {
      // The page has extra content the reference doesn't — skip it, then the next pair matches.
      for (let k = 0; k < pageAhead; k++) pushComparison(orderedBlocks[pi + k], undefined, false);
      pi += pageAhead;
      pushComparison(orderedBlocks[pi], refBodyBlocks[ri], true);
      pi++; ri++;
    } else {
      // The reference has extra content the page doesn't — skip it, then the next pair matches.
      for (let k = 0; k < refAhead; k++) pushComparison(undefined, refBodyBlocks[ri + k], false);
      ri += refAhead;
      pushComparison(orderedBlocks[pi], refBodyBlocks[ri], true);
      pi++; ri++;
    }
  }

  const mismatchesOnly = comparisons.filter(c => c.status === 'mismatch');
  const bodyStatus = comparisons.length === 0 ? 'partial' : mismatchesOnly.length > 0 ? 'mismatch' : 'match';

  const recommendations: string[] = [];
  if (mismatchesOnly.length > 0) {
    recommendations.push('Align mismatched headings, paragraphs, and list items with the reference, in the same order.');
  }
  if (!hasTitle) recommendations.push('Add a descriptive <title> tag to the webpage <head>.');
  if (!hasDescription) recommendations.push('Add a meta description tag (<meta name="description" content="...">).');

  return {
    seo: {
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
    overallScore: 0,
    summary: '',
    recommendations
  };
}

// Express Endpoints
app.get("/api/health", (req, res) => {
  const hasGemini = !!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("ya29.");
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  res.json({
    status: "ok",
    hasApiKey: hasGemini || hasOpenRouter,
    provider: hasGemini ? "Gemini API" : (hasOpenRouter ? "OpenRouter API" : "Local OCR Engine")
  });
});

async function analyzeWithOpenRouter(openRouterKey: string, textPrompt: string, imageBase64: string): Promise<string | null> {
  try {
    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey.trim()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://utility-tool-manager.app",
        "X-Title": "SEO Copy Auditor"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: textPrompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.log("OpenRouter API response status:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    console.log("OpenRouter API exception:", err?.message || err);
    return null;
  }
}

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

    // Attempt Gemini AI or OpenRouter AI Analysis if available
    let reportText = "";
    const textPrompt = `You are a strict QA and SEO Content Compliance Auditor.
Your task is to perform an exact visual and textual OCR comparison between the Reference Document Screenshot provided and the Crawled Target Webpage HTML/text below.

Crawled Target Webpage Information:
- Target Source: ${targetUrlName}
- Page <title>: "${parsedWebData.title || '[None found]'}"
- Meta description: "${parsedWebData.description || '[None found]'}"
- HTML Heading Hierarchy:
${parsedWebData.headings.map(h => `  * <${h.level}>: "${h.text}"`).join("\n") || '  [No headings found]'}
- Extracted Paragraphs (<p> tags in order):
${parsedWebData.paragraphs.length > 0 ? parsedWebData.paragraphs.map((p, idx) => `  * <p> #${idx + 1}: "${p}"`).join("\n") : '  [No explicit <p> tags found]'}
- Extracted Bullet/Numbered List Items (<li> tags in order):
${parsedWebData.listItems.length > 0 ? parsedWebData.listItems.map((li, idx) => `  * <li> #${idx + 1}: "${li}"`).join("\n") : '  [No list items found]'}
- Extracted HTML Tables (Headers & Rows):
${parsedWebData.tables.length > 0 ? parsedWebData.tables.map((tbl, idx) => `  * Table #${idx + 1}:\n    - Headers: ${tbl.headers.join(' | ') || 'None'}\n    - Rows:\n${tbl.rows.map(r => `      [ ${r.join(' | ')} ]`).join('\n')}`).join("\n") : '  [No tables found]'}
- Full Extracted Body Copy Text:
"${parsedWebData.bodyText}"

CRITICAL COMPARISON MANDATE:
1. Examine the Reference Document Screenshot image in high detail. Read every title, heading, paragraph (<p>), list item (<li>), table cell (<td>/<th>), and sentence shown in the document screenshot.
2. Compare the text in the document screenshot word-for-word against the Crawled Target Webpage headings, paragraphs (<p>), list items (<li>), tables, and copy text provided above.
3. ABSOLUTE ACCURACY IS REQUIRED FOR ALL ELEMENTS: Check every heading, paragraph (<p>), list item (<li>), and table cell. If any sentence, word, number, header, table cell, or bullet point in the webpage copy differs from what is shown in the reference screenshot (e.g., modified text, changed <p> or <li> tag contents, altered table data, missing words, extra sections, or rephrased copy), YOU MUST DETECT AND REPORT IT AS A MISMATCH.
4. If there are ANY paragraph (<p>), list item (<li>), table, heading, or copy differences:
   - Do NOT mark bodyContent.status as 'match'. Set it to 'mismatch' or 'partial'.
   - List EVERY copy mismatch in 'bodyContent.mismatches', specifying:
     * category: "Paragraph Copy Mismatch" (or "List Item Mismatch" / "Table Data Mismatch" / "Heading Mismatch" / "Title Mismatch")
     * expected: The exact text as seen in the reference document screenshot
     * actual: The actual text found on the webpage
     * severity: "high" for altered or missing sentences/paragraphs/tables, "medium" for minor word/punctuation differences
     * comment: Detailed description of what changed in the tag/cell/paragraph between the document screenshot and the webpage.
   - Set 'bodyContent.mismatchesCount' to the number of discrepancies found.
   - Lower the 'overallScore' proportionally (e.g. deduct 15-30 points per mismatch).
   - NEVER give an overallScore of 100 if the webpage copy, paragraphs, list items, or tables do not match the document screenshot 100% exactly word-for-word!

Calculate the Overall Compliance Score (0 to 100) based on strict copy alignment. Return your response strictly as a JSON object adhering to this schema:
${JSON.stringify(responseSchema, null, 2)}
`;

    // 1. Try Gemini API if client available (vision comparison needs an actual screenshot;
    // a Google Doc reference is plain text, so it skips AI vision and goes straight to the
    // deterministic local text comparator below, which is actually a better fit for exact-text
    // spec compliance than an LLM's vision reasoning).
    const client = getGeminiClient();
    if (client && image) {
      try {
        const base64Data = image.split(',')[1] || image;
        let mimeType = "image/png";
        const mimeMatch = image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }

        const imagePart = {
          inlineData: {
            mimeType,
            data: base64Data
          }
        };

        try {
          const geminiRes = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [imagePart, { text: textPrompt }] },
            config: {
              responseMimeType: "application/json",
              responseSchema: responseSchema,
              temperature: 0.1
            }
          });
          reportText = geminiRes.text || "";
        } catch (modelErr: any) {
          console.log("Gemini 2.5 Flash unavailable, trying 3.6 Flash fallback...");
          try {
            const fallbackRes = await client.models.generateContent({
              model: "gemini-3.6-flash",
              contents: { parts: [imagePart, { text: textPrompt }] },
              config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1
              }
            });
            reportText = fallbackRes.text || "";
          } catch (fallbackErr: any) {
            console.log("Gemini API call note: proceeding to alternative providers/OCR engine.");
          }
        }
      } catch (geminiError: any) {
        console.log("Gemini API note: Executing fallback providers.");
      }
    }

    // 2. Try OpenRouter API if GEMINI failed or was missing, and OPENROUTER_API_KEY is available
    if (!reportText && image && process.env.OPENROUTER_API_KEY) {
      console.log("Attempting OpenRouter AI analysis...");
      const openRouterResult = await analyzeWithOpenRouter(process.env.OPENROUTER_API_KEY, textPrompt, image);
      if (openRouterResult) {
        reportText = openRouterResult;
      }
    }

    // 3. Return structured AI report if any AI provider succeeded
    if (reportText) {
      try {
        const parsedReport = JSON.parse(reportText.trim());
        return res.json({
          success: true,
          report: parsedReport,
          webpageData: {
            title: parsedWebData.title,
            description: parsedWebData.description,
            headingsCount: parsedWebData.headings.length
          }
        });
      } catch (e) {
        console.log("AI response parsing note, falling back to OCR engine.");
      }
    }

    // Fallback: compare against the Google Doc text directly, or OCR the screenshot
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
