import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { fetchWebpage } from '../webpage/PageFetcher';
import { fetchWithSafeRedirects, readBodyCapped, UnsafeUrlError } from '../webpage/PageSecurity';
import { extractPageAuditModel } from '../webpage/ContentExtractor';
import { extractPageMetadata } from '../webpage/MetadataExtractor';
import { parseReference } from '../reference/ReferenceParser';
import { buildContentAuditReport, type SelectedCheckOptions } from '../report/AuditReportBuilder';
import { normalizeUrl } from '../../../src/lib/utils';
import { extractGoogleDocId } from '../google/GoogleDocUrl';
import { fetchPublicGoogleDoc } from '../google/GoogleDocsService';
import { parseGoogleDoc } from '../google/GoogleDocParser';
import { extractWebsiteSemanticTree } from '../webpage/domContentExtractor';
import { compareNormalizedTrees } from '../comparison/deterministicComparator';
import { auditAltTexts, collectAltTexts, parseAltTextLine } from '../comparison/AltTextMatcher';
import { auditSchemas, collectPageSchemaTypes, extractSchemaBlocks } from '../comparison/SchemaMatcher';
import * as cheerio from 'cheerio';

export const contentAuditRouter = Router();

// Zod Schema for /api/content-checker/analyze (Fix 42)
const AnalyzeRequestSchema = z.object({
  url: z.string().trim().optional(),
  rawHtml: z.string().optional(),
  image: z.string().optional(),
  referenceText: z.string().optional(),
  contentSelector: z.string().trim().optional(),
  selectedChecks: z.union([
    z.record(z.string(), z.boolean()),
    z.array(z.string()),
  ]).optional(),
}).refine((data) => !!(data.url || data.rawHtml?.trim()), {
  message: 'INPUT_INVALID: Either a target "url" or "rawHtml" must be provided.',
}).refine((data) => !!(data.image || data.referenceText?.trim()), {
  message: 'INPUT_INVALID: Either a reference screenshot "image" or "referenceText" must be provided.',
});

// Zod Schema for resolving Google Docs
const ResolveDocSchema = z.object({
  url: z.string().trim().min(5, 'Missing Google Doc URL'),
});

// Zod Schema for resolving Awesome Screenshot links
const ResolveScreenshotSchema = z.object({
  url: z.string().trim().min(5, 'Missing share link URL'),
});

const MAX_SCREENSHOT_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_SCREENSHOT_PAGE_BYTES = 5 * 1024 * 1024; // 5MB

// Downloads an image through the SSRF-safe fetch (every redirect hop validated), requires an
// image/* content type and caps the size, then returns it as a data URI.
async function downloadImageAsDataUri(imageUrl: string): Promise<string> {
  const { response } = await fetchWithSafeRedirects(imageUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching image.`);
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new Error(`URL did not return an image (content-type: ${contentType || 'missing'}).`);
  }
  const buf = await readBodyCapped(response, MAX_SCREENSHOT_IMAGE_BYTES);
  return `data:${contentType};base64,${buf.toString('base64')}`;
}

function sanitizeForLog(str: string, maxLen = 80): string {
  if (!str) return '';
  return str.slice(0, maxLen).replace(/[\r\n]/g, ' ');
}

// 1. Google Doc Resolver Endpoint
contentAuditRouter.post('/resolve-google-doc', async (req: Request, res: Response) => {
  try {
    const parsed = ResolveDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: parsed.error.issues[0]?.message || 'Invalid Google Doc URL',
      });
    }

    const docUrl = parsed.data.url;
    const idMatch = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) {
      return res.status(400).json({
        errorType: 'REFERENCE_PARSE_FAILED',
        error: 'That does not look like a Google Docs URL (expected .../document/d/<id>/...).',
      });
    }

    const docId = idMatch[1];
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const docRes = await fetch(exportUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    if (!docRes.ok) {
      return res.status(400).json({
        errorType: 'FETCH_FAILED',
        error: docRes.status === 401 || docRes.status === 403
          ? 'This Google Doc is not public. Set sharing to "Anyone with the link can view" and try again.'
          : `Could not fetch Google Doc (HTTP ${docRes.status}).`,
      });
    }

    const text = (await docRes.text()).trim();
    if (!text || text.length < 5) {
      return res.status(400).json({
        errorType: 'REFERENCE_PARSE_FAILED',
        error: 'Google Doc appears to be empty.',
      });
    }

    return res.json({ success: true, text });
  } catch (err: any) {
    return res.status(400).json({
      errorType: 'FETCH_FAILED',
      error: err.message || 'Failed to fetch Google Doc content.',
    });
  }
});

// 2. Awesome Screenshot Resolver Endpoint
contentAuditRouter.post('/resolve-awesome-screenshot', async (req: Request, res: Response) => {
  try {
    const parsed = ResolveScreenshotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: parsed.error.issues[0]?.message || 'Missing share link URL.',
      });
    }

    let url = normalizeUrl(parsed.data.url);

    if (/\.(png|jpe?g|webp|gif)(?:\?.*)?$/i.test(url)) {
      // Direct image URL
      return res.json({ success: true, base64: await downloadImageAsDataUri(url) });
    }

    const { response: pageRes, finalUrl: pageFinalUrl } = await fetchWithSafeRedirects(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!pageRes.ok) {
      return res.status(400).json({
        errorType: 'FETCH_FAILED',
        error: `Could not fetch shared link (HTTP ${pageRes.status}).`,
      });
    }

    const rawHtml = (await readBodyCapped(pageRes, MAX_SCREENSHOT_PAGE_BYTES)).toString('utf8');
    const unescapedHtml = rawHtml.replace(/\\\/|\\u002F/g, '/');
    let candidateImageUrl = '';

    const ogMatch = unescapedHtml.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
      candidateImageUrl = ogMatch[1];
    } else {
      const imgMatch = unescapedHtml.match(/https:\/\/[^"'\s>]+\.(?:png|jpe?g|webp)/i);
      if (imgMatch) candidateImageUrl = imgMatch[0];
    }

    if (!candidateImageUrl) {
      return res.status(400).json({
        errorType: 'REFERENCE_PARSE_FAILED',
        error: 'Could not detect an image asset inside the share link.',
      });
    }

    // The URL was scraped from an untrusted page: resolve it against the page and validate it like any other.
    const resolvedImageUrl = new URL(candidateImageUrl, pageFinalUrl).toString();
    return res.json({ success: true, base64: await downloadImageAsDataUri(resolvedImageUrl) });
  } catch (err: any) {
    return res.status(400).json({
      errorType: err instanceof UnsafeUrlError ? 'BLOCKED_URL' : 'FETCH_FAILED',
      error: err.message || 'Failed to resolve screenshot share link.',
    });
  }
});

// 3. Main Analyze Endpoint
contentAuditRouter.post('/analyze', async (req: Request, res: Response) => {
  const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();

  try {
    const parseRes = AnalyzeRequestSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: parseRes.error.issues[0]?.message || 'Invalid input payload.',
      });
    }

    const { url, rawHtml, image, referenceText, contentSelector, selectedChecks: rawSelectedChecks } = parseRes.data;

    // Convert rawSelectedChecks to SelectedCheckOptions object (Fix 48)
    const selectedChecks: SelectedCheckOptions = {};
    if (Array.isArray(rawSelectedChecks)) {
      const set = new Set(rawSelectedChecks);
      selectedChecks.title = set.has('title');
      selectedChecks.headings = set.has('headings');
      selectedChecks.paragraphs = set.has('paragraphs');
      selectedChecks.lists = set.has('lists');
      selectedChecks.tables = set.has('tables');
      selectedChecks.image = set.has('image');
      selectedChecks.faq = set.has('faq');
    } else if (rawSelectedChecks && typeof rawSelectedChecks === 'object') {
      Object.assign(selectedChecks, rawSelectedChecks);
    }

    // Step A: Webpage Acquisition (Fix 39, Fix 40, Fix 41)
    let pageHtml = '';
    let targetUrlName = url || 'Provided Raw HTML';
    let fetchDiagnostics: any = { fetchMethod: 'manual-html', htmlSize: 0, rendered: false, notes: [] };

    if (rawHtml && rawHtml.trim()) {
      pageHtml = rawHtml.trim();
      fetchDiagnostics.htmlSize = pageHtml.length;
    } else if (url && url.trim()) {
      const sanitizedUrl = normalizeUrl(url);
      targetUrlName = sanitizedUrl;
      try {
        const fetched = await fetchWebpage(sanitizedUrl);
        pageHtml = fetched.html;
        fetchDiagnostics = {
          fetchMethod: fetched.fetchMethod,
          httpStatus: fetched.httpStatus,
          htmlSize: fetched.htmlSize,
          rendered: fetched.rendered,
          notes: fetched.notes,
        };
      } catch (fetchErr: any) {
        const msg = fetchErr.message || String(fetchErr);
        const errorType = msg.includes('Security validation') ? 'BLOCKED_URL' : 'FETCH_FAILED';
        console.warn(`[ContentAuditor ${auditId}] Fetch failed for ${sanitizeForLog(sanitizedUrl)}:`, msg);
        return res.status(400).json({ errorType, error: msg });
      }
    }

    // Step B: Webpage Content Extraction (Fix 5, Fix 6, Fix 15, Fix 16)
    let pageModel;
    try {
      pageModel = extractPageAuditModel(pageHtml, targetUrlName, fetchDiagnostics, contentSelector);
    } catch (parseErr: any) {
      const msg = parseErr.message || String(parseErr);
      const errorType = msg.includes('selector') ? 'INVALID_SELECTOR' : 'PAGE_PARSE_FAILED';
      return res.status(400).json({ errorType, error: msg });
    }

    // Step C: Reference Model Extraction (Fix 7, Fix 8, Fix 9, Fix 10, Fix 11, Fix 12)
    let referenceModel;
    try {
      referenceModel = await parseReference({
        referenceText,
        imageBase64: image,
      });
    } catch (refErr: any) {
      const msg = refErr.message || String(refErr);
      const errorType = msg.includes('OCR_TIMEOUT') ? 'OCR_FAILED' : msg.includes('OCR') ? 'OCR_FAILED' : 'REFERENCE_PARSE_FAILED';
      console.warn(`[ContentAuditor ${auditId}] Reference parsing error:`, msg);
      return res.status(400).json({ errorType, error: msg });
    }

    // Step D: Report Synthesis (Fix 32, Fix 33, Fix 34, Fix 35)
    const report = buildContentAuditReport(pageModel, referenceModel, selectedChecks);

    const duration = Date.now() - startTime;
    console.log(`[ContentAuditor ${auditId}] Completed audit for "${sanitizeForLog(targetUrlName)}" in ${duration}ms. Status: ${report.status}. Issues: ${report.issues.length}.`);

    // Backwards-compatible legacy report shape + new structured model
    // This allows existing UI to continue functioning seamlessly while unlocking all new features
    return res.json({
      success: true,
      report: {
        // New structured fields
        status: report.status,
        extraction: report.extraction,
        issues: report.issues,
        summary: report.summary.headline,
        recommendations: report.summary.recommendations,
        overallScore: report.summary.overallScore,
        metadataComparison: report.metadata,
        headingsComparison: report.headings,
        blocksComparison: report.content,
        listsComparison: report.lists,
        tablesComparison: report.tables,
        featureImageComparison: report.featureImage,
        altTextComparison: report.altTexts,
        schemaComparison: report.schemas,
        faqComparison: report.faq,

        // Legacy compatibility mappings for existing ContentChecker UI (Fix 47)
        seo: {
          urlMatches: report.metadata.url.status === 'EXACT',
          expectedUrl: report.metadata.url.expected,
          actualUrl: report.metadata.url.actual,
          urlDifference: report.metadata.url.status === 'EXACT' ? 'URL matches the reference.' : 'URL differs from reference.',
          titleMatches: report.metadata.title.status === 'EXACT' || report.metadata.title.status === 'NEAR_EXACT',
          expectedTitle: report.metadata.title.expected,
          actualTitle: report.metadata.title.actual,
          titleDifference: report.metadata.title.status === 'EXACT' ? 'Title matches reference.' : 'Title differs from reference.',
          descriptionMatches: report.metadata.description.status === 'EXACT' || report.metadata.description.status === 'NEAR_EXACT',
          expectedDescription: report.metadata.description.expected,
          actualDescription: report.metadata.description.actual,
          descriptionDifference: report.metadata.description.status === 'EXACT' ? 'Description matches reference.' : 'Description differs from reference.',
          status: report.metadata.overallStatus.toLowerCase() as any,
          analysis: report.summary.headline,
        },
        headings: {
          status: report.headings.some((h) => h.status !== 'EXACT' && h.status !== 'NEAR_EXACT') ? 'mismatch' : 'match',
          matches: report.headings.map((h) => ({
            level: `h${h.expectedLevel}` as any,
            expectedText: h.expectedText,
            actualText: h.actualText || '(missing)',
            status: h.status === 'EXACT' || h.status === 'NEAR_EXACT' ? 'match' : h.status === 'PARTIAL' ? 'partial' : 'mismatch',
            comment: h.evidence || '',
          })),
          analysis: '',
        },
        bodyContent: {
          status: report.content.some((c) => c.status !== 'EXACT' && c.status !== 'NEAR_EXACT') ? 'mismatch' : 'match',
          mismatches: report.content.map((c) => ({
            category: c.type === 'heading' ? 'Headings' : c.type === 'listItem' ? 'List Item' : 'Paragraph',
            expected: c.expected,
            actual: c.actual || '(not found on the webpage)',
            severity: c.status === 'MISSING' ? 'high' : c.status === 'PARTIAL' ? 'low' : 'medium',
            comment: c.evidence || '',
            status: c.status === 'EXACT' || c.status === 'NEAR_EXACT' ? 'match' : 'mismatch',
            difference: c.difference,
          })),
          matchesCount: report.summary.passedChecks,
          mismatchesCount: report.summary.contentDifferences + report.summary.structuralIssues,
          analysis: '',
        },
        featureImage: report.featureImage ? {
          applicable: report.featureImage.applicable,
          expected: report.featureImage.expected,
          actual: report.featureImage.actual,
          matches: report.featureImage.matches,
          analysis: report.featureImage.evidence || '',
        } : undefined,
        faqSchema: report.faq ? {
          present: report.faq.schemaPresent,
          rawJson: '',
          status: report.faq.schemaPresent ? 'match' : 'not_present',
          mismatchDetails: report.faq.notes || [],
          analysis: report.faq.evidence || '',
        } : undefined,
      },
      webpageData: {
        title: pageModel.meta.titleTag,
        description: pageModel.meta.metaDescription,
        headingsCount: pageModel.headings.length,
      },
    });
  } catch (error: any) {
    console.error(`[ContentAuditor ${auditId}] Internal analysis failure:`, error);
    return res.status(500).json({
      errorType: 'INTERNAL_ERROR',
      error: `Internal server analysis failure: ${error.message || error}`,
    });
  }
});

// 4. Preview Google Doc Semantic Tree (Public Google Docs API)
contentAuditRouter.post('/preview-doc', async (req: Request, res: Response) => {
  try {
    const rawDocUrl = req.body.googleDocUrl || req.body.docUrl;
    if (!rawDocUrl || typeof rawDocUrl !== 'string' || !rawDocUrl.trim()) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: 'Google Doc URL is required.',
      });
    }

    let docId: string;
    try {
      docId = extractGoogleDocId(rawDocUrl);
    } catch (urlErr: any) {
      return res.status(400).json({
        errorType: 'INVALID_DOC_URL',
        error: urlErr.message,
      });
    }

    const docData = await fetchPublicGoogleDoc(docId);
    const referenceTree = parseGoogleDoc(docData);

    return res.json({
      success: true,
      referenceTree,
    });
  } catch (err: any) {
    return res.status(400).json({
      errorType: 'PREVIEW_FAILED',
      error: err.message || 'Failed to extract semantic content from Google Doc.',
    });
  }
});

// 5. Full End-to-End Content Audit (Public Google Doc vs Website)
contentAuditRouter.post('/audit-doc', async (req: Request, res: Response) => {
  const auditId = `audit-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();

  try {
    const rawDocUrl = req.body.googleDocUrl || req.body.docUrl;
    const rawTargetUrl = req.body.targetUrl || req.body.url;
    const contentSelector = req.body.contentSelector;

    if (!rawDocUrl || typeof rawDocUrl !== 'string' || !rawDocUrl.trim()) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: 'Google Doc URL is required.',
      });
    }

    if (!rawTargetUrl || typeof rawTargetUrl !== 'string' || !rawTargetUrl.trim()) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: 'Target Website URL is required.',
      });
    }

    // Step 1: Validate and extract document ID
    let docId: string;
    try {
      docId = extractGoogleDocId(rawDocUrl);
    } catch (urlErr: any) {
      return res.status(400).json({
        errorType: 'INVALID_DOC_URL',
        error: urlErr.message,
      });
    }

    // Step 2: Fetch public Google Doc via Google Docs API
    let docData;
    try {
      docData = await fetchPublicGoogleDoc(docId);
    } catch (apiErr: any) {
      return res.status(400).json({
        errorType: 'DOC_FETCH_FAILED',
        error: apiErr.message || 'Failed to fetch public Google Doc.',
      });
    }

    // Step 3: Parse Google Doc strictly starting from first HEADING_1
    let referenceTree;
    try {
      referenceTree = parseGoogleDoc(docData);
    } catch (parseErr: any) {
      return res.status(400).json({
        errorType: 'REFERENCE_PARSE_FAILED',
        error: parseErr.message,
      });
    }

    // Schema code and "Alt text: ..." lines are instructions, not copy: pull them out of the compared content.
    // A one-cell table is how Docs code blocks usually come through.
    const { blocks: refSchemaBlocks, consumed: schemaIdx } = extractSchemaBlocks(
      referenceTree.elements.map((el) =>
        el.type === 'paragraph' || el.type === 'heading' || (el.type === 'table' && el.rows.length === 1 && el.rows[0].length === 1)
          ? el.text
          : ''
      )
    );
    const refAltTexts: string[] = [];
    referenceTree.elements = referenceTree.elements.filter((el, i) => {
      if (schemaIdx.has(i)) return false;
      const alt = el.type === 'paragraph' ? parseAltTextLine(el.text) : undefined;
      if (alt) refAltTexts.push(alt);
      return !alt;
    });

    // Step 4: Fetch target website
    const sanitizedUrl = normalizeUrl(rawTargetUrl);
    let pageHtml = '';
    try {
      const fetched = await fetchWebpage(sanitizedUrl);
      pageHtml = fetched.html;
    } catch (fetchErr: any) {
      const msg = fetchErr.message || String(fetchErr);
      const errorType = msg.includes('Security validation') ? 'BLOCKED_URL' : 'FETCH_FAILED';
      console.warn(`[ContentAuditor ${auditId}] Webpage fetch failed for ${sanitizeForLog(sanitizedUrl)}:`, msg);
      return res.status(400).json({ errorType, error: msg });
    }

    // Step 5: Extract website semantic content tree starting from first <h1>
    const websiteTree = extractWebsiteSemanticTree(pageHtml, { selector: contentSelector });

    // Step 6: Deterministic comparison
    const auditReport = compareNormalizedTrees(referenceTree, websiteTree);

    // Step 7: Alt text and schema from the doc must exist in the page source
    const $page = cheerio.load(pageHtml);
    auditReport.altTexts = auditAltTexts(refAltTexts, collectAltTexts($page));
    auditReport.schemas = auditSchemas(refSchemaBlocks, collectPageSchemaTypes($page));
    const { meta } = extractPageMetadata($page);
    auditReport.page = { url: sanitizedUrl, title: meta.titleTag, description: meta.metaDescription, canonical: meta.canonical };
    const { altTexts, schemas, summary } = auditReport;
    if (altTexts.some((a) => a.status === 'MISSING') || schemas.some((s) => s.status === 'MISSING')) {
      summary.status = 'FAIL';
    } else if (
      summary.status === 'PASS' &&
      (altTexts.some((a) => a.duplicate) || schemas.some((s) => s.status === 'INVALID'))
    ) {
      summary.status = 'PASS_WITH_WARNINGS';
    }

    const duration = Date.now() - startTime;
    console.log(
      `[ContentAuditor ${auditId}] Completed public doc audit for "${sanitizeForLog(sanitizedUrl)}" in ${duration}ms. Status: ${auditReport.summary.status}. Total: ${auditReport.summary.total}. Passed: ${auditReport.summary.passed}.`
    );

    return res.json({
      success: true,
      report: auditReport,
    });
  } catch (err: any) {
    console.error(`[ContentAuditor ${auditId}] Internal audit failure:`, err);
    return res.status(500).json({
      errorType: 'INTERNAL_ERROR',
      error: `Internal audit failure: ${err.message || err}`,
    });
  }
});

