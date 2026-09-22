import * as cheerio from 'cheerio';
import type { PageAuditModel, PageHeading, PageContentBlock, PageTable, PageFaqData, PageExtractionDiagnostics } from '../types/page';
import { extractPageMetadata } from './MetadataExtractor';
import { resolveMainContent } from './MainContentResolver';
import { normalizeText } from '../reference/ReferenceNormalizer';

function sanitizeAndParseJsonLd(text: string): any {
  if (!text) return null;
  try {
    let clean = text.trim();
    // Strip CDATA and comments
    clean = clean.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    clean = clean.replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\//i, '').replace(/\/\*\s*\]\]>\s*\*\/\s*$/, '');
    clean = clean.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export function extractPageAuditModel(
  html: string,
  targetUrl: string,
  diagnostics: Partial<PageExtractionDiagnostics> = {},
  manualContentSelector?: string
): PageAuditModel {
  const $ = cheerio.load(html);

  // 1. Metadata and feature images
  const { meta, images } = extractPageMetadata($);

  // 2. Main content scope
  const { $scope } = resolveMainContent($, manualContentSelector);

  // 3. Extract FAQ schema from JSON-LD scripts
  const schemaItems: Array<{ question: string; answer: string }> = [];
  let rawFaqSchema: any = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    const parsed = sanitizeAndParseJsonLd(raw);
    if (!parsed) return;

    const findFaqPage = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      const typeStr = String(obj['@type'] || obj.type || '');
      if (typeStr.includes('FAQPage') && Array.isArray(obj.mainEntity)) {
        rawFaqSchema = obj;
        for (const item of obj.mainEntity) {
          const qText = item?.name || item?.question || '';
          const aText = item?.acceptedAnswer?.text || item?.acceptedAnswer?.name || item?.answer || '';
          if (qText && aText) {
            schemaItems.push({
              question: normalizeText(cheerio.load(qText).text()),
              answer: normalizeText(cheerio.load(aText).text()),
            });
          }
        }
      }
      if (Array.isArray(obj['@graph'])) {
        obj['@graph'].forEach(findFaqPage);
      }
    };

    findFaqPage(parsed);
  });

  // 4. Extract structured tables from within main content
  const tables: PageTable[] = [];
  $scope.find('table').each((tblIdx, tblEl) => {
    const $tbl = $(tblEl);
    const headers: string[] = [];
    const rows: string[][] = [];

    // Header row
    $tbl.find('tr').each((rowIdx, trEl) => {
      const $tr = $(trEl);
      const cells: string[] = [];
      let isHeaderRow = true;

      $tr.find('th, td').each((_, cellEl) => {
        if (cellEl.tagName.toLowerCase() !== 'th') {
          isHeaderRow = false;
        }
        const cellText = normalizeText($(cellEl).text());
        if (cellText) cells.push(cellText);
      });

      if (cells.length > 0) {
        if (rowIdx === 0 && isHeaderRow) {
          headers.push(...cells);
        } else {
          rows.push(cells);
        }
      }
    });

    if (headers.length > 0 || rows.length > 0) {
      tables.push({
        id: `tbl-${tblIdx + 1}`,
        headers,
        rows,
        order: tblIdx + 1,
      });
    }
  });

  // 5. Clone $scope and remove tables before extracting linear content blocks
  // to avoid duplicating table cells as standard paragraphs
  const $contentOnly = $scope.clone();
  $contentOnly.find('table').remove();

  const headings: PageHeading[] = [];
  const blocks: PageContentBlock[] = [];
  let blockCounter = 0;

  // Interleaved traversal of main content elements in document order
  $contentOnly.find('h1, h2, h3, h4, h5, h6, p, ul > li, ol > li').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = normalizeText($(el).text());
    if (!text || text.length < 2) return;

    blockCounter++;
    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1], 10);
      const heading: PageHeading = {
        id: `h-${blockCounter}`,
        level,
        text,
        normalizedText: text.toLowerCase(),
        order: blockCounter,
      };
      headings.push(heading);
      blocks.push({
        id: `blk-${blockCounter}`,
        type: 'heading',
        level,
        text,
        normalizedText: text.toLowerCase(),
        order: blockCounter,
        tag,
      });
    } else if (tag === 'li') {
      const parentTag = $(el).parent().prop('tagName')?.toLowerCase();
      const listType: 'ul' | 'ol' = parentTag === 'ol' ? 'ol' : 'ul';
      blocks.push({
        id: `blk-${blockCounter}`,
        type: 'listItem',
        listType,
        text,
        normalizedText: text.toLowerCase(),
        order: blockCounter,
        tag,
      });
    } else {
      blocks.push({
        id: `blk-${blockCounter}`,
        type: 'paragraph',
        text,
        normalizedText: text.toLowerCase(),
        order: blockCounter,
        tag: 'p',
      });
    }
  });

  // 6. Detect FAQ section in page content
  const faqItems: Array<{ question: string; answer: string }> = [];
  let faqHeadingFound = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'heading' && /^(faqs?|frequently asked questions)\b/i.test(b.text.trim())) {
      faqHeadingFound = true;
      // Gather subsequent heading/paragraph pairs
      let j = i + 1;
      while (j < blocks.length) {
        if (blocks[j].type === 'heading' && blocks[j].level && blocks[j].level! <= (b.level || 2)) {
          // Reached next major section
          break;
        }
        if (blocks[j].type === 'heading' && blocks[j + 1] && blocks[j + 1].type === 'paragraph') {
          faqItems.push({
            question: blocks[j].text,
            answer: blocks[j + 1].text,
          });
          j += 2;
        } else {
          j++;
        }
      }
      break;
    }
  }

  const faq: PageFaqData = {
    present: faqHeadingFound || faqItems.length > 0 || schemaItems.length > 0,
    items: faqItems,
    schemaPresent: schemaItems.length > 0,
    schemaItems,
    rawSchema: rawFaqSchema,
  };

  const detectedParagraphCount = blocks.filter((b) => b.type === 'paragraph').length;
  const confidenceScore = blocks.length > 10 ? 95 : blocks.length > 3 ? 75 : 40;
  const confidenceLevel = confidenceScore >= 90 ? 'HIGH' : confidenceScore >= 70 ? 'MEDIUM' : 'LOW';

  const extractionDiagnostics: PageExtractionDiagnostics = {
    fetchMethod: diagnostics.fetchMethod || 'manual-html',
    httpStatus: diagnostics.httpStatus,
    htmlSize: diagnostics.htmlSize || html.length,
    rendered: diagnostics.rendered || false,
    detectedMainContentBlocks: blocks.length,
    detectedHeadings: headings.length,
    detectedParagraphs: detectedParagraphCount,
    detectedTables: tables.length,
    confidence: confidenceLevel,
    confidenceScore,
    notes: diagnostics.notes || [],
  };

  return {
    url: targetUrl,
    finalUrl: diagnostics.fetchMethod === 'direct-http' ? targetUrl : undefined,
    meta,
    headings,
    blocks,
    tables,
    images,
    faq,
    extraction: extractionDiagnostics,
  };
}
