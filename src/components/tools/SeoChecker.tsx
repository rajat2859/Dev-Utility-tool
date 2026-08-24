import React, { useState } from 'react';
import { 
  Globe, 
  Search, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check, 
  CheckCircle2, 
  Eye, 
  Tag, 
  FileText, 
  Code, 
  Share2, 
  Layers, 
  FileImage, 
  ChevronDown, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { normalizeUrl } from '../../lib/utils';

interface SchemaIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

interface DetectedSchema {
  schemaType: string;
  source: 'json-ld' | 'microdata';
  rawJson: any;
  issues: SchemaIssue[];
  valid: boolean;
}

interface SeoAuditData {
  title: {
    text: string;
    length: number;
    status: 'optimal' | 'too_short' | 'too_long' | 'missing';
    message: string;
    pixelWidthEst: number;
  };
  description: {
    text: string;
    length: number;
    status: 'optimal' | 'too_short' | 'too_long' | 'missing';
    message: string;
  };
  keywords?: string;
  canonical?: string;
  robots?: string;
  viewport?: string;
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
    hasOgTags: boolean;
  };
  twitterCard: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    hasTwitterTags: boolean;
  };
  headings: {
    h1Count: number;
    h1Texts: string[];
    h2Count: number;
    h3Count: number;
    h4Count: number;
    status: 'good' | 'missing_h1' | 'multiple_h1';
    message: string;
  };
  images: {
    total: number;
    missingAltCount: number;
    imagesWithoutAlt: string[];
  };
  schemas: DetectedSchema[];
  overallHealthScore: number;
  scoreBreakdown: {
    titleScore: number;
    descriptionScore: number;
    headingsScore: number;
    socialScore: number;
    technicalScore: number;
    schemaScore: number;
  };
}

function clientParseSeoAndSchemas(html: string, pageUrlStr?: string): SeoAuditData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Title
  let titleText = doc.querySelector('title')?.textContent?.trim() || '';
  if (!titleText) {
    titleText = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '';
  }

  // Description
  let descText = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
  if (!descText) {
    descText = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
  }

  const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content')?.trim() || undefined;
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || undefined;
  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim() || undefined;
  const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content')?.trim() || undefined;

  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
  const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim();
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim();
  const ogUrl = doc.querySelector('meta[property="og:url"]')?.getAttribute('content')?.trim();
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content')?.trim();
  const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim();

  const twitterCard = doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content')?.trim();
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.trim();
  const twitterDescription = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content')?.trim();
  const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content')?.trim();

  const h1Els = Array.from(doc.querySelectorAll('h1'));
  const h1Texts = h1Els.map(el => el.textContent?.trim() || '').filter(Boolean);
  const h2Count = doc.querySelectorAll('h2').length;
  const h3Count = doc.querySelectorAll('h3').length;
  const h4Count = doc.querySelectorAll('h4').length;

  const imgEls = Array.from(doc.querySelectorAll('img'));
  const totalImages = imgEls.length;
  const imagesWithoutAlt = imgEls.filter(img => !img.hasAttribute('alt') || !img.getAttribute('alt')?.trim()).map(img => img.src || 'Image without alt');

  const schemas: DetectedSchema[] = [];
  const scriptEls = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  scriptEls.forEach(script => {
    const rawContent = script.textContent?.trim();
    if (!rawContent) return;
    try {
      const parsed = JSON.parse(rawContent);
      const processObj = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(item => processObj(item));
          return;
        }
        if (Array.isArray(obj)) {
          obj.forEach(item => processObj(item));
          return;
        }
        const schemaType = obj['@type'] || obj['type'] || 'UnknownSchema';
        const typeStr = Array.isArray(schemaType) ? schemaType.join(', ') : String(schemaType);
        const issues: SchemaIssue[] = [];

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
      processObj(parsed);
    } catch (e: any) {
      schemas.push({
        schemaType: 'Invalid JSON-LD',
        source: 'json-ld',
        rawJson: { raw: rawContent.slice(0, 300) },
        issues: [{ type: 'error', message: `JSON syntax error: ${e.message}` }],
        valid: false
      });
    }
  });

  const itemScopes = Array.from(doc.querySelectorAll('[itemscope]'));
  itemScopes.forEach(el => {
    const itemType = el.getAttribute('itemtype') || 'MicrodataItem';
    const typeName = itemType.split('/').pop() || itemType;
    schemas.push({
      schemaType: typeName,
      source: 'microdata',
      rawJson: { htmlTag: el.outerHTML.slice(0, 150) },
      issues: [],
      valid: true
    });
  });

  const titleLen = titleText.length;
  let titleStatus: 'optimal' | 'too_short' | 'too_long' | 'missing' = 'optimal';
  let titleMsg = 'Title length is optimal for search snippets (50 - 60 characters).';
  if (titleLen === 0) {
    titleStatus = 'missing';
    titleMsg = 'Meta title tag is completely missing!';
  } else if (titleLen < 30) {
    titleStatus = 'too_short';
    titleMsg = `Title is too short (${titleLen} chars). Expand to 50-60 characters.`;
  } else if (titleLen > 60) {
    titleStatus = 'too_long';
    titleMsg = `Title is too long (${titleLen} chars). Snippets may truncate.`;
  }

  const descLen = descText.length;
  let descStatus: 'optimal' | 'too_short' | 'too_long' | 'missing' = 'optimal';
  let descMsg = 'Meta description length is optimal for search snippets (120 - 160 characters).';
  if (descLen === 0) {
    descStatus = 'missing';
    descMsg = 'Meta description is missing!';
  } else if (descLen < 70) {
    descStatus = 'too_short';
    descMsg = `Description is too short (${descLen} chars). Expand to 120-160 characters.`;
  } else if (descLen > 160) {
    descStatus = 'too_long';
    descMsg = `Description is too long (${descLen} chars). May truncate in search results.`;
  }

  const titleScore = titleStatus === 'optimal' ? 20 : titleStatus === 'too_short' || titleStatus === 'too_long' ? 12 : 0;
  const descriptionScore = descStatus === 'optimal' ? 20 : descStatus === 'too_short' || descStatus === 'too_long' ? 12 : 0;
  const headingsScore = h1Texts.length === 1 ? 15 : h1Texts.length > 1 ? 8 : 0;
  const socialScore = (ogTitle && ogDescription && ogImage ? 10 : ogTitle || ogDescription ? 5 : 0) + (twitterCard ? 5 : 0);
  const technicalScore = (canonical ? 8 : 0) + (viewport ? 7 : 0);
  const schemaScore = schemas.length > 0 && schemas.some(s => s.valid) ? 15 : schemas.length > 0 ? 8 : 0;

  const totalScore = titleScore + descriptionScore + headingsScore + socialScore + technicalScore + schemaScore;

  return {
    title: {
      text: titleText,
      length: titleLen,
      status: titleStatus,
      message: titleMsg,
      pixelWidthEst: Math.round(titleLen * 8.2)
    },
    description: {
      text: descText,
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
      h1Count: h1Texts.length,
      h1Texts,
      h2Count,
      h3Count,
      h4Count,
      status: h1Texts.length === 1 ? 'good' : h1Texts.length === 0 ? 'missing_h1' : 'multiple_h1',
      message: h1Texts.length === 1 ? 'Perfect! Exactly 1 H1 heading tag found.' : h1Texts.length === 0 ? 'Missing H1 tag.' : `Found ${h1Texts.length} H1 tags.`
    },
    images: {
      total: totalImages,
      missingAltCount: imagesWithoutAlt.length,
      imagesWithoutAlt
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

export default function SeoChecker() {
  const [activeTab, setActiveTab] = useState<'seo' | 'schema'>('seo');
  const [url, setUrl] = useState<string>('');
  const [rawHtml, setRawHtml] = useState<string>('');
  const [showHtmlPaste, setShowHtmlPaste] = useState<boolean>(false);

  const [seoAuditData, setSeoAuditData] = useState<SeoAuditData | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [seoError, setSeoError] = useState<string | null>(null);
  const [expandedSchemaIndex, setExpandedSchemaIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const runSeoCheck = async () => {
    if (!url.trim() && !rawHtml.trim()) {
      setSeoError('Please enter a Webpage URL or paste raw HTML code.');
      return;
    }

    setIsAuditing(true);
    setSeoError(null);
    setSeoAuditData(null);

    try {
      await runSeoCheckInternal();
    } finally {
      setIsAuditing(false);
    }
  };

  const runSeoCheckInternal = async () => {
    const sanitizedUrl = normalizeUrl(url);
    if (sanitizedUrl !== url.trim()) setUrl(sanitizedUrl);

    // 1. Try server API endpoint first
    try {
      const response = await fetch('/api/seo-checker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sanitizedUrl || undefined,
          rawHtml: rawHtml.trim() || undefined
        })
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await response.json();
      }

      if (response.ok && data?.success && data?.data) {
        setSeoAuditData(data.data);
        return;
      }
    } catch (serverErr) {
      console.warn("Server SEO audit failed, attempting client-side fallback parsing...", serverErr);
    }

    // 2. Client-side fallback if raw HTML was provided
    if (rawHtml.trim()) {
      try {
        const clientParsed = clientParseSeoAndSchemas(rawHtml.trim(), sanitizedUrl);
        setSeoAuditData(clientParsed);
        return;
      } catch (clientErr: any) {
        setSeoError(`Failed to parse HTML: ${clientErr.message || clientErr}`);
        return;
      }
    }

    // 3. Client-side fetch fallback if URL was provided
    if (sanitizedUrl) {
      // Proxy Attempt 1: AllOrigins
      try {
        const proxyUrl1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(sanitizedUrl)}`;
        const res1 = await fetch(proxyUrl1);
        if (res1.ok) {
          const htmlText1 = await res1.text();
          if (htmlText1 && htmlText1.trim().length > 10) {
            const clientParsed = clientParseSeoAndSchemas(htmlText1, sanitizedUrl);
            setSeoAuditData(clientParsed);
            return;
          }
        }
      } catch (proxyErr1) {
        console.warn("Client proxy 1 fetch error:", proxyErr1);
      }

      // Proxy Attempt 2: CorsProxy
      try {
        const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(sanitizedUrl)}`;
        const res2 = await fetch(proxyUrl2);
        if (res2.ok) {
          const htmlText2 = await res2.text();
          if (htmlText2 && htmlText2.trim().length > 10) {
            const clientParsed = clientParseSeoAndSchemas(htmlText2, sanitizedUrl);
            setSeoAuditData(clientParsed);
            return;
          }
        }
      } catch (proxyErr2) {
        console.warn("Client proxy 2 fetch error:", proxyErr2);
      }

      setSeoError(
        `Could not fetch target webpage (${sanitizedUrl}). The target site may be blocking automated requests. Please try clicking "Paste Raw HTML" and pasting the page HTML source code directly.`
      );
    }
  };

  const handleCopyReport = () => {
    if (!seoAuditData) return;
    const summaryText = `SEO & SCHEMA AUDIT REPORT
URL / Source: ${url || 'Raw HTML'}
Overall Health Score: ${seoAuditData.overallHealthScore}/100

META TITLE:
- Text: "${seoAuditData.title.text || 'MISSING'}"
- Length: ${seoAuditData.title.length} chars (${seoAuditData.title.status})
- Status: ${seoAuditData.title.message}

META DESCRIPTION:
- Text: "${seoAuditData.description.text || 'MISSING'}"
- Length: ${seoAuditData.description.length} chars (${seoAuditData.description.status})
- Status: ${seoAuditData.description.message}

STRUCTURED DATA (SCHEMAS):
- Total Schemas Detected: ${seoAuditData.schemas.length}
${seoAuditData.schemas.map(s => `- Type: ${s.schemaType} (${s.source.toUpperCase()}) - ${s.valid ? 'VALID' : 'HAS ISSUES'}`).join('\n')}

HEADINGS & IMAGES:
- H1 Tags: ${seoAuditData.headings.h1Count} (${seoAuditData.headings.h1Texts.join(', ') || 'None'})
- Total Images: ${seoAuditData.images.total} (Missing Alt: ${seoAuditData.images.missingAltCount})
`;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* Tool Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-xs">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                SEO & Schema
              </h2>
              <p className="text-xs text-slate-500">
                Audit meta titles, descriptions, Google SERP snippets, and Schema.org structured data.
              </p>
            </div>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('seo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'seo'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="h-3.5 w-3.5 text-indigo-600" />
              <span>SEO Meta Audit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schema')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'schema'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code className="h-3.5 w-3.5 text-emerald-600" />
              <span>Schema Inspector</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Input Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-indigo-600" />
              <span>Target Webpage URL</span>
            </label>
            <button
              type="button"
              onClick={() => setShowHtmlPaste(!showHtmlPaste)}
              className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
            >
              {showHtmlPaste ? 'Switch to URL Input' : 'Or Paste Raw HTML Code'}
            </button>
          </div>

          {!showHtmlPaste ? (
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. https://example.com/landing-page"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runSeoCheck();
                  }
                }}
                className="w-full pl-10 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white shadow-2xs"
              />
            </div>
          ) : (
            <textarea
              rows={4}
              placeholder="Paste complete HTML source code here (including <head>, <title>, <script type='application/ld+json'>)..."
              value={rawHtml}
              onChange={(e) => setRawHtml(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white shadow-2xs"
            />
          )}
        </div>

        <button
          type="button"
          onClick={runSeoCheck}
          disabled={isAuditing || (!url.trim() && !rawHtml.trim())}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-2xs bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isAuditing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-white" />
              <span>Auditing Webpage Meta & Schemas...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Run SEO & Schema Audit</span>
            </>
          )}
        </button>

        {seoError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{seoError}</span>
          </div>
        )}
      </div>

      {/* SEO META AUDIT TAB RESULTS */}
      {activeTab === 'seo' && seoAuditData && (
        <div className="space-y-6">
          {/* Health Score Summary Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">SEO & Meta Tag Verdict</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  seoAuditData.overallHealthScore >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  seoAuditData.overallHealthScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {seoAuditData.overallHealthScore >= 80 ? 'Optimal' : seoAuditData.overallHealthScore >= 50 ? 'Needs Attention' : 'Critical Issues'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Analyzed meta title lengths, description snippet character limits, Google SERP truncation risk, open graph tags, and heading tags.
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center px-5 py-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block">SEO Health Score</span>
                <span className={`text-3xl font-extrabold font-mono ${
                  seoAuditData.overallHealthScore >= 80 ? 'text-emerald-400' :
                  seoAuditData.overallHealthScore >= 50 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {seoAuditData.overallHealthScore}<span className="text-xs text-slate-400 font-normal">/100</span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyReport}
                className="p-2.5 text-slate-700 hover:text-slate-950 border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                title="Copy SEO Audit Report"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Grid Layout for Meta Title & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Meta Title */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">1. Meta Title Tag</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  seoAuditData.title.status === 'optimal' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  seoAuditData.title.status === 'missing' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {seoAuditData.title.status.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Found Title Text:</span>
                  <span className="font-mono text-slate-700 font-bold">{seoAuditData.title.length} characters</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-900 break-words">
                  {seoAuditData.title.text || <span className="text-rose-500 font-bold italic">No title tag found!</span>}
                </div>
                <p className="text-[11px] text-slate-600">{seoAuditData.title.message}</p>
              </div>

              {/* SERP Simulator */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Eye className="h-3 w-3 text-slate-500" /> Google SERP Snippet Simulator
                </span>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1 font-sans">
                  <div className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                    <span className="text-slate-900 font-semibold">{url || 'https://example.com'}</span>
                  </div>
                  <h4 className="text-sm text-blue-800 font-semibold hover:underline cursor-pointer truncate">
                    {seoAuditData.title.text ? (
                      seoAuditData.title.text.length > 60 ? seoAuditData.title.text.slice(0, 58) + '...' : seoAuditData.title.text
                    ) : 'Missing Title'}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {seoAuditData.description.text ? (
                      seoAuditData.description.text.length > 155 ? seoAuditData.description.text.slice(0, 152) + '...' : seoAuditData.description.text
                    ) : 'No meta description provided. Google will dynamically extract snippet text from webpage body content.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Meta Description */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">2. Meta Description</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  seoAuditData.description.status === 'optimal' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  seoAuditData.description.status === 'missing' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {seoAuditData.description.status.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Found Description:</span>
                  <span className="font-mono text-slate-700 font-bold">{seoAuditData.description.length} characters</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800 leading-relaxed break-words">
                  {seoAuditData.description.text || <span className="text-rose-500 font-bold italic">No meta description found!</span>}
                </div>
                <p className="text-[11px] text-slate-600">{seoAuditData.description.message}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technical Tags Check</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Canonical URL:</span>
                    <span className="font-mono text-[11px] text-slate-800 font-medium truncate block">
                      {seoAuditData.canonical || 'Not Specified'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Robots Directive:</span>
                    <span className="font-mono text-[11px] text-slate-800 font-medium truncate block">
                      {seoAuditData.robots || 'index, follow (Default)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Heading Tags & Image Alt Audit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" /> Heading Structure
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  seoAuditData.headings.status === 'good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {seoAuditData.headings.status.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">H1</span>
                  <span className="text-lg font-bold font-mono text-indigo-600">{seoAuditData.headings.h1Count}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">H2</span>
                  <span className="text-lg font-bold font-mono text-slate-700">{seoAuditData.headings.h2Count}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">H3</span>
                  <span className="text-lg font-bold font-mono text-slate-700">{seoAuditData.headings.h3Count}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">H4</span>
                  <span className="text-lg font-bold font-mono text-slate-700">{seoAuditData.headings.h4Count}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600">{seoAuditData.headings.message}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-indigo-600" /> Image Alt Text Audit
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  seoAuditData.images.missingAltCount === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {seoAuditData.images.missingAltCount === 0 ? 'All Alt Tags OK' : `${seoAuditData.images.missingAltCount} Missing Alt`}
                </span>
              </div>

              <div className="flex items-center justify-around py-2 text-xs">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Images</span>
                  <span className="text-xl font-bold font-mono text-slate-800">{seoAuditData.images.total}</span>
                </div>
                <div className="h-8 w-[1px] bg-slate-200" />
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 font-semibold block">Missing Alt Tags</span>
                  <span className={`text-xl font-bold font-mono ${seoAuditData.images.missingAltCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {seoAuditData.images.missingAltCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-indigo-600" /> Open Graph Social Tags
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  seoAuditData.openGraph.hasOgTags ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {seoAuditData.openGraph.hasOgTags ? 'Active' : 'Missing'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-400 font-semibold">og:title</span>
                  <span className="font-medium text-slate-800 truncate max-w-[200px]">{seoAuditData.openGraph.title || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-400 font-semibold">og:description</span>
                  <span className="font-medium text-slate-800 truncate max-w-[200px]">{seoAuditData.openGraph.description || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-400 font-semibold">og:image</span>
                  <span className="font-medium text-slate-800 truncate max-w-[200px]">{seoAuditData.openGraph.image || '—'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-sky-600" /> Twitter Card Tags
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  seoAuditData.twitterCard.hasTwitterTags ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {seoAuditData.twitterCard.hasTwitterTags ? 'Active' : 'Missing'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-400 font-semibold">twitter:card</span>
                  <span className="font-medium text-slate-800">{seoAuditData.twitterCard.card || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-400 font-semibold">twitter:title</span>
                  <span className="font-medium text-slate-800 truncate max-w-[200px]">{seoAuditData.twitterCard.title || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1">
                  <span className="text-slate-400 font-semibold">twitter:image</span>
                  <span className="font-medium text-slate-800 truncate max-w-[200px]">{seoAuditData.twitterCard.image || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHEMA TAB RESULTS VIEW */}
      {activeTab === 'schema' && seoAuditData && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Schema.org Structured Data Summary</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  seoAuditData.schemas.length > 0 && seoAuditData.schemas.every(s => s.valid)
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : seoAuditData.schemas.length > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {seoAuditData.schemas.length > 0
                    ? `${seoAuditData.schemas.filter(s => s.valid).length} / ${seoAuditData.schemas.length} Valid`
                    : '0 Schemas Found'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Extracted JSON-LD scripts & Microdata itemtype tags. Verified required attributes for rich snippet formats.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase block">Detected Schemas</span>
                <span className="text-2xl font-extrabold font-mono text-emerald-700">{seoAuditData.schemas.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Detected Schema Blocks ({seoAuditData.schemas.length})
                </h3>
              </div>
            </div>

            {seoAuditData.schemas.length > 0 ? (
              <div className="space-y-3">
                {seoAuditData.schemas.map((schema, index) => {
                  const isExpanded = expandedSchemaIndex === index;
                  return (
                    <div key={index} className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <div 
                        onClick={() => setExpandedSchemaIndex(isExpanded ? null : index)}
                        className="p-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded text-[11px]">
                            {schema.schemaType}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-200/60 px-1.5 py-0.5 rounded">
                            {schema.source}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {schema.valid ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Valid
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3 text-rose-600" /> Has Issues
                            </span>
                          )}
                        </div>
                      </div>

                      {schema.issues.length > 0 && (
                        <div className="p-3 bg-amber-50/50 border-t border-amber-200/80 space-y-1">
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Schema Validation Notes:</span>
                          {schema.issues.map((issue, iIdx) => (
                            <div key={iIdx} className="text-xs text-amber-900 flex items-start gap-1.5">
                              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>{issue.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isExpanded && (
                        <div className="p-3 bg-slate-950 text-slate-200 border-t border-slate-800 overflow-x-auto font-mono text-[11px] leading-relaxed">
                          <pre>{JSON.stringify(schema.rawJson, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>No Schema.org structured data detected on this page.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
