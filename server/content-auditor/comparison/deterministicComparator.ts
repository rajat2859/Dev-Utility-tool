import type {
  NormalizedDocument,
  NormalizedElement,
  ContentAuditReport,
  ElementComparisonResult,
  ComparisonStatus,
  AuditSummary,
} from '../types/normalized';
import { normalizeText, areTextsMatching } from '../utils/textNormalizer';

/**
 * Checks if two text strings match after normalization.
 */
export function isTextMatch(a: string, b: string): boolean {
  if (areTextsMatching(a, b)) return true;
  // Lowercase check
  const normA = normalizeText(a).toLowerCase();
  const normB = normalizeText(b).toLowerCase();
  if (normA === normB) return true;

  // Resilience against editorial heading tags (e.g. "<H1> Title" vs "Title")
  const cleanA = normA.replace(/^(?:<[hH][1-6]>|\[[hH][1-6]\]|[hH][1-6][:—–-])\s*/, '').trim();
  const cleanB = normB.replace(/^(?:<[hH][1-6]>|\[[hH][1-6]\]|[hH][1-6][:—–-])\s*/, '').trim();
  return cleanA === cleanB;
}

/**
 * Detailed comparison for list items.
 * Returns failure details if an item is missing, out of order, or text differs.
 */
export function compareListDetails(
  refItems: string[],
  webItems: string[]
): { matches: boolean; detail: string } {
  // Check for any missing reference item
  for (let i = 0; i < refItems.length; i++) {
    const item = refItems[i];
    const found = webItems.some((w) => isTextMatch(item, w));
    if (!found) {
      return { matches: false, detail: `Missing list item: "${item}"` };
    }
  }

  // Check count difference
  if (refItems.length !== webItems.length) {
    return {
      matches: false,
      detail: `List item count differs: expected ${refItems.length} items, found ${webItems.length}.`,
    };
  }

  // Check item-by-item in order
  for (let i = 0; i < refItems.length; i++) {
    if (!isTextMatch(refItems[i], webItems[i])) {
      return {
        matches: false,
        detail: `List item ${i + 1} mismatch: expected "${refItems[i]}", found "${webItems[i]}".`,
      };
    }
  }

  return { matches: true, detail: 'All list items match.' };
}

/**
 * Detailed comparison for table rows and cells.
 * Returns failure details with specific row and column numbers.
 */
export function compareTableDetails(
  refRows: string[][],
  webRows: string[][]
): { matches: boolean; detail: string } {
  if (refRows.length !== webRows.length) {
    return {
      matches: false,
      detail: `Table row count differs: expected ${refRows.length} rows, found ${webRows.length}.`,
    };
  }

  for (let r = 0; r < refRows.length; r++) {
    const rRow = refRows[r] || [];
    const wRow = webRows[r] || [];

    if (rRow.length !== wRow.length) {
      return {
        matches: false,
        detail: `Row ${r + 1} column count differs: expected ${rRow.length} cells, found ${wRow.length}.`,
      };
    }

    for (let c = 0; c < rRow.length; c++) {
      if (!isTextMatch(rRow[c], wRow[c])) {
        return {
          matches: false,
          detail: `Row ${r + 1}, Cell ${c + 1} — Expected: "${rRow[c]}", Found: "${wRow[c]}"`,
        };
      }
    }
  }

  return { matches: true, detail: 'All table rows and cells match.' };
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

    // 1. Search for exact text match with same tag (PASS) within lookahead window
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

    // 4. If no exact text match was found, inspect candidate at webCursor for structural match
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
        matchedWebIndices.add(candidateWebIndex);
        webCursor = candidateWebIndex + 1;

        let detailMsg = `Content differs from reference. Expected "${ref.text.slice(0, 60)}" but found "${candidateWeb.text.slice(0, 60)}".`;

        // Check for specific list failure detail
        if (ref.type === 'list' && candidateWeb.type === 'list') {
          if (ref.tag !== candidateWeb.tag) {
            results.push({
              id: `comp-${refOrder}`,
              order: refOrder,
              status: 'WRONG_TAG',
              reference: {
                tag: ref.tag,
                type: ref.type,
                text: ref.text,
                items: ref.items,
              },
              website: {
                tag: candidateWeb.tag,
                type: candidateWeb.type,
                text: candidateWeb.text,
                items: candidateWeb.items,
              },
              message: `List type differs: expected <${ref.tag}> but found <${candidateWeb.tag}>.`,
            });
            continue;
          }

          const listComp = compareListDetails(ref.items, candidateWeb.items);
          if (!listComp.matches) {
            detailMsg = listComp.detail;
          }
        }

        // Check for specific table failure detail
        if (ref.type === 'table' && candidateWeb.type === 'table') {
          const tableComp = compareTableDetails(ref.rows, candidateWeb.rows);
          if (!tableComp.matches) {
            detailMsg = tableComp.detail;
          }
        }

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
          message: detailMsg,
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
