import type {
  NormalizedDocument,
  NormalizedElement,
  ContentAuditReport,
  ElementComparisonResult,
  ComparisonStatus,
  AuditSummary,
} from '../types/normalized';

/**
 * Normalizes text for comparison by lowercasing, collapsing whitespace,
 * and normalizing quotes and hyphens.
 */
export function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two text strings match after normalization.
 */
export function isTextMatch(a: string, b: string): boolean {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  if (normA === normB) return true;

  // Strip punctuation for a slightly more forgiving exact comparison
  const stripPunct = (s: string) => s.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '').trim();
  return stripPunct(normA) === stripPunct(normB);
}

/**
 * Deterministically compares reference content against website content in document order.
 *
 * Outcomes for each reference element:
 * - PASS: tag matches, text matches (normalized)
 * - WRONG_TAG: text matches, but semantic tag differs (e.g. h2 vs h3, or h2 vs p)
 * - CONTENT_MISMATCH: structure exists in corresponding position, but text differs
 * - MISSING: reference item was not found on the webpage
 *
 * Extra elements on the website are tracked separately in `extraWebsiteElements`.
 */
export function compareNormalizedTrees(
  refDoc: NormalizedDocument,
  webDoc: NormalizedDocument
): ContentAuditReport {
  const refElements = refDoc.elements || [];
  const webElements = webDoc.elements || [];

  const results: ElementComparisonResult[] = [];
  const matchedWebIndices = new Set<number>();

  let webCursor = 0;

  for (let r = 0; r < refElements.length; r++) {
    const ref = refElements[r];
    const refOrder = r + 1;
    const refNorm = normalizeForComparison(ref.text);

    // 1. First, search for exact text match with same tag (PASS) within lookahead window
    let foundWebIndex = -1;
    let isSameTag = false;

    const LOOKAHEAD_WINDOW = 15;
    const maxLookahead = Math.min(webElements.length, webCursor + LOOKAHEAD_WINDOW);

    // Look for exact text + same tag
    for (let w = webCursor; w < maxLookahead; w++) {
      if (matchedWebIndices.has(w)) continue;
      const web = webElements[w];
      if (ref.tag === web.tag && isTextMatch(ref.text, web.text)) {
        foundWebIndex = w;
        isSameTag = true;
        break;
      }
    }

    // 2. If not found, look for exact text with different tag (WRONG_TAG)
    if (foundWebIndex === -1) {
      for (let w = webCursor; w < maxLookahead; w++) {
        if (matchedWebIndices.has(w)) continue;
        const web = webElements[w];
        if (isTextMatch(ref.text, web.text)) {
          foundWebIndex = w;
          isSameTag = false;
          break;
        }
      }
    }

    // 3. If exact text match was found:
    if (foundWebIndex >= 0) {
      const web = webElements[foundWebIndex];
      matchedWebIndices.add(foundWebIndex);
      webCursor = foundWebIndex + 1;

      if (isSameTag) {
        results.push({
          id: `comp-${refOrder}`,
          order: refOrder,
          status: 'PASS',
          reference: {
            tag: ref.tag,
            type: ref.type,
            text: ref.text,
            items: ref.type === 'list' ? ref.items : undefined,
            rows: ref.type === 'table' ? ref.rows : undefined,
          },
          website: {
            tag: web.tag,
            type: web.type,
            text: web.text,
            items: web.type === 'list' ? web.items : undefined,
            rows: web.type === 'table' ? web.rows : undefined,
          },
          message: 'Tag and content match reference.',
        });
      } else {
        results.push({
          id: `comp-${refOrder}`,
          order: refOrder,
          status: 'WRONG_TAG',
          reference: {
            tag: ref.tag,
            type: ref.type,
            text: ref.text,
            items: ref.type === 'list' ? ref.items : undefined,
            rows: ref.type === 'table' ? ref.rows : undefined,
          },
          website: {
            tag: web.tag,
            type: web.type,
            text: web.text,
            items: web.type === 'list' ? web.items : undefined,
            rows: web.type === 'table' ? web.rows : undefined,
          },
          message: `Text matches, but tag is <${web.tag}> instead of expected <${ref.tag}>.`,
        });
      }
      continue;
    }

    // 4. If no text match was found, inspect candidate at webCursor
    // If the element at webCursor has the same tag, or if next ref elements don't match it:
    let candidateWebIndex = -1;
    for (let w = webCursor; w < Math.min(webElements.length, webCursor + 3); w++) {
      if (!matchedWebIndices.has(w)) {
        candidateWebIndex = w;
        break;
      }
    }

    if (candidateWebIndex >= 0) {
      const candidateWeb = webElements[candidateWebIndex];

      // Check if this website candidate element is an exact match for an upcoming reference element
      let matchesFutureRef = false;
      for (let futureR = r + 1; futureR < Math.min(refElements.length, r + 5); futureR++) {
        if (isTextMatch(refElements[futureR].text, candidateWeb.text)) {
          matchesFutureRef = true;
          break;
        }
      }

      if (!matchesFutureRef && (candidateWeb.tag === ref.tag || candidateWeb.type === ref.type)) {
        // Tag or type matches, but content differs -> CONTENT_MISMATCH
        matchedWebIndices.add(candidateWebIndex);
        webCursor = candidateWebIndex + 1;

        results.push({
          id: `comp-${refOrder}`,
          order: refOrder,
          status: 'CONTENT_MISMATCH',
          reference: {
            tag: ref.tag,
            type: ref.type,
            text: ref.text,
            items: ref.type === 'list' ? ref.items : undefined,
            rows: ref.type === 'table' ? ref.rows : undefined,
          },
          website: {
            tag: candidateWeb.tag,
            type: candidateWeb.type,
            text: candidateWeb.text,
            items: candidateWeb.type === 'list' ? candidateWeb.items : undefined,
            rows: candidateWeb.type === 'table' ? candidateWeb.rows : undefined,
          },
          message: `Content differs from reference. Expected "${ref.text.slice(0, 60)}..." but found "${candidateWeb.text.slice(0, 60)}...".`,
        });
        continue;
      }
    }

    // 5. Otherwise, reference element was not found on webpage -> MISSING
    results.push({
      id: `comp-${refOrder}`,
      order: refOrder,
      status: 'MISSING',
      reference: {
        tag: ref.tag,
        type: ref.type,
        text: ref.text,
        items: ref.type === 'list' ? ref.items : undefined,
        rows: ref.type === 'table' ? ref.rows : undefined,
      },
      message: `Reference element <${ref.tag}> was not found on the webpage.`,
    });
  }

  // Collect any website elements that were never matched
  const extraWebsiteElements: NormalizedElement[] = [];
  for (let w = 0; w < webElements.length; w++) {
    if (!matchedWebIndices.has(w)) {
      extraWebsiteElements.push(webElements[w]);
    }
  }

  // Calculate summary counts
  let passedCount = 0;
  let wrongTagCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;

  for (const res of results) {
    if (res.status === 'PASS') passedCount++;
    else if (res.status === 'WRONG_TAG') wrongTagCount++;
    else if (res.status === 'CONTENT_MISMATCH') mismatchCount++;
    else if (res.status === 'MISSING') missingCount++;
  }

  let overallStatus: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' = 'PASS';
  if (missingCount > 0 || mismatchCount > 0) {
    overallStatus = 'FAIL';
  } else if (wrongTagCount > 0) {
    overallStatus = 'PASS_WITH_WARNINGS';
  }

  const summary: AuditSummary = {
    total: results.length,
    passed: passedCount,
    wrongTag: wrongTagCount,
    contentMismatch: mismatchCount,
    missing: missingCount,
    extraOnWebsite: extraWebsiteElements.length,
    status: overallStatus,
  };

  return {
    summary,
    results,
    referenceTree: refDoc,
    websiteTree: webDoc,
    extraWebsiteElements,
  };
}
