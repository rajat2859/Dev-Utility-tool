import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { fetchWebpage } from '../webpage/PageFetcher';
import { extractPageAuditModel } from '../webpage/ContentExtractor';
import { parseReference } from '../reference/ReferenceParser';
import { buildContentAuditReport, type SelectedCheckOptions } from '../report/AuditReportBuilder';
import { normalizeUrl } from '../../../src/lib/utils';
import { getAuthStatus, getGoogleDocsClient } from '../auth/googleAuth';
import { extractGoogleDocId, parseGoogleDoc } from '../reference/googleDocsParser';
import { extractWebsiteSemanticTree } from '../webpage/domContentExtractor';
import { compareNormalizedTrees } from '../comparison/deterministicComparator';

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
      const imgRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status} fetching image.`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get('content-type') || 'image/png';
      return res.json({
        success: true,
        base64: `data:${contentType};base64,${buf.toString('base64')}`,
      });
    }

    const pageRes = await fetch(url, {
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

    const rawHtml = await pageRes.text();
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

    const imgDownloadRes = await fetch(candidateImageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgDownloadRes.ok) throw new Error(`HTTP ${imgDownloadRes.status} downloading candidate screenshot asset.`);
    const imgBuf = Buffer.from(await imgDownloadRes.arrayBuffer());
    const contentType = imgDownloadRes.headers.get('content-type') || 'image/png';

    return res.json({
      success: true,
      base64: `data:${contentType};base64,${imgBuf.toString('base64')}`,
    });
  } catch (err: any) {
    return res.status(400).json({
      errorType: 'FETCH_FAILED',
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

// 4. Preview Google Doc Semantic Tree (V1 Google Docs API)
contentAuditRouter.post('/preview-doc', async (req: Request, res: Response) => {
  try {
    const { docUrl } = req.body || {};
    if (!docUrl || typeof docUrl !== 'string' || !docUrl.trim()) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: 'Google Doc URL is required.',
      });
    }

    const auth = getAuthStatus();
    if (!auth.authenticated) {
      return res.status(401).json({
        errorType: 'NOT_AUTHENTICATED',
        error: 'Please sign in with Google to access this Google Doc.',
      });
    }

    let docId: string;
    try {
      docId = extractGoogleDocId(docUrl);
    } catch (urlErr: any) {
      return res.status(400).json({
        errorType: 'INVALID_DOC_URL',
        error: urlErr.message,
      });
    }

    const docs = getGoogleDocsClient();
    let docRes;
    try {
      docRes = await docs.documents.get({ documentId: docId });
    } catch (apiErr: any) {
      const code = apiErr.code || apiErr.status;
      if (code === 404) {
        return res.status(404).json({
          errorType: 'DOC_NOT_FOUND',
          error: 'Google Doc not found. Please verify the URL and ensure the document exists.',
        });
      }
      if (code === 403) {
        return res.status(403).json({
          errorType: 'PERMISSION_DENIED',
          error:
            'Permission denied. Your signed-in Google account does not have read access to this document.',
        });
      }
      if (code === 401) {
        return res.status(401).json({
          errorType: 'AUTH_EXPIRED',
          error: 'Google session has expired. Please sign in again.',
        });
      }
      return res.status(400).json({
        errorType: 'GOOGLE_API_ERROR',
        error: apiErr.message || 'Failed to fetch document from Google Docs API.',
      });
    }

    const referenceTree = parseGoogleDoc(docRes.data);
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

// 5. Full End-to-End Content Audit (Google Doc API vs Website)
contentAuditRouter.post('/audit-doc', async (req: Request, res: Response) => {
  const auditId = `audit-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();

  try {
    const { docUrl, targetUrl, contentSelector } = req.body || {};

    if (!docUrl || typeof docUrl !== 'string' || !docUrl.trim()) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: 'Google Doc URL is required.',
      });
    }

    if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
      return res.status(400).json({
        errorType: 'INPUT_INVALID',
        error: 'Target Website URL is required.',
      });
    }

    // Step 1: Check Google authentication
    const auth = getAuthStatus();
    if (!auth.authenticated) {
      return res.status(401).json({
        errorType: 'NOT_AUTHENTICATED',
        error: 'Please sign in with Google to access this Google Doc.',
      });
    }

    // Step 2: Validate and extract document ID
    let docId: string;
    try {
      docId = extractGoogleDocId(docUrl);
    } catch (urlErr: any) {
      return res.status(400).json({
        errorType: 'INVALID_DOC_URL',
        error: urlErr.message,
      });
    }

    // Step 3: Fetch document via Google Docs API
    const docs = getGoogleDocsClient();
    let docRes;
    try {
      docRes = await docs.documents.get({ documentId: docId });
    } catch (apiErr: any) {
      const code = apiErr.code || apiErr.status;
      if (code === 404) {
        return res.status(404).json({
          errorType: 'DOC_NOT_FOUND',
          error: 'Google Doc not found. Please verify the URL and ensure the document exists.',
        });
      }
      if (code === 403) {
        return res.status(403).json({
          errorType: 'PERMISSION_DENIED',
          error:
            'Permission denied. Your signed-in Google account does not have read access to this document.',
        });
      }
      if (code === 401) {
        return res.status(401).json({
          errorType: 'AUTH_EXPIRED',
          error: 'Google session has expired. Please sign in again.',
        });
      }
      return res.status(400).json({
        errorType: 'GOOGLE_API_ERROR',
        error: apiErr.message || 'Failed to fetch document from Google Docs API.',
      });
    }

    // Step 4: Parse Google Doc strictly starting from first HEADING_1
    let referenceTree;
    try {
      referenceTree = parseGoogleDoc(docRes.data);
    } catch (parseErr: any) {
      return res.status(400).json({
        errorType: 'REFERENCE_PARSE_FAILED',
        error: parseErr.message,
      });
    }

    // Step 5: Fetch target website
    const sanitizedUrl = normalizeUrl(targetUrl);
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

    // Step 6: Extract website semantic content tree starting from first <h1>
    const websiteTree = extractWebsiteSemanticTree(pageHtml, { selector: contentSelector });

    // Step 7: Deterministic comparison
    const auditReport = compareNormalizedTrees(referenceTree, websiteTree);

    const duration = Date.now() - startTime;
    console.log(
      `[ContentAuditor ${auditId}] Completed audit for "${sanitizeForLog(sanitizedUrl)}" in ${duration}ms. Status: ${auditReport.summary.status}. Total: ${auditReport.summary.total}. Passed: ${auditReport.summary.passed}.`
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

