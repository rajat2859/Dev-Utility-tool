import type {
  NormalizedDocument,
  NormalizedElement,
  ContentAuditReport,
  ElementComparisonResult,
  AuditSummary,
} from '../types/normalized';
import { normalizeText, areTextsMatching } from '../utils/textNormalizer';

const HEADING_MARKER_PATTERN = /^(?:<[hH][1-6]>|\[[hH][1-6]\]|[hH][1-6][:—–-])\s*/;

/**
 * Text used to decide whether two elements say the same thing. Tolerates whitespace and
 * punctuation normalization plus editorial heading tags (e.g. "<H1> Title" vs "Title").
 */
function textMatchKey(text: string): string {
  return normalizeText(text).replace(HEADING_MARKER_PATTERN, '').trim();
}

/**
 * Checks if two text strings match after normalization.
 */
export function isTextMatch(a: string, b: string): boolean {
  return textMatchKey(a) === textMatchKey(b);
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

const MINIMUM_WORD_SIMILARITY_FOR_PAIRING = 0.25;

function wordSimilarity(a: string, b: string): number {
  const wordsOfA = new Set(normalizeText(a).toLowerCase().split(' ').filter(Boolean));
  const wordsOfB = new Set(normalizeText(b).toLowerCase().split(' ').filter(Boolean));
  if (wordsOfA.size === 0 || wordsOfB.size === 0) return 0;
  let sharedWords = 0;
  wordsOfA.forEach((word) => {
    if (wordsOfB.has(word)) sharedWords++;
  });
  return (2 * sharedWords) / (wordsOfA.size + wordsOfB.size);
}

function isGenericTextBlock(element: NormalizedElement): boolean {
  return element.type === 'paragraph' && element.sourceTag !== undefined;
}

function pairingGroupOf(element: NormalizedElement): 'text' | 'list' | 'table' {
  return element.type === 'heading' || element.type === 'paragraph' ? 'text' : element.type;
}

function describeElement(element: NormalizedElement, tag: string = element.tag) {
  return {
    tag,
    type: element.type,
    text: element.text,
    items: element.type === 'list' ? element.items : undefined,
    rows: element.type === 'table' ? element.rows : undefined,
  };
}

function pageTagOf(element: NormalizedElement): string {
  return element.type === 'paragraph' && element.sourceTag ? element.sourceTag : element.tag;
}

/**
 * Longest in-order run of elements whose text is identical. Among equally long runs,
 * prefers pairs that also share the same tag.
 */
function alignElementsWithIdenticalText(
  referenceElements: NormalizedElement[],
  referenceKeys: string[],
  websiteElements: NormalizedElement[],
  websiteKeys: string[]
): Array<[number, number]> {
  const referenceCount = referenceElements.length;
  const websiteCount = websiteElements.length;
  const scoreOfPair = (r: number, w: number) =>
    referenceKeys[r] !== websiteKeys[w] ? 0 : referenceElements[r].tag === websiteElements[w].tag ? 1001 : 1000;

  const bestScore = Array.from({ length: referenceCount + 1 }, () => new Array<number>(websiteCount + 1).fill(0));
  for (let r = 1; r <= referenceCount; r++) {
    for (let w = 1; w <= websiteCount; w++) {
      const pairScore = scoreOfPair(r - 1, w - 1);
      bestScore[r][w] = Math.max(
        bestScore[r - 1][w],
        bestScore[r][w - 1],
        pairScore > 0 ? bestScore[r - 1][w - 1] + pairScore : 0
      );
    }
  }

  const alignedPairs: Array<[number, number]> = [];
  let r = referenceCount;
  let w = websiteCount;
  while (r > 0 && w > 0) {
    const pairScore = scoreOfPair(r - 1, w - 1);
    if (pairScore > 0 && bestScore[r][w] === bestScore[r - 1][w - 1] + pairScore) {
      alignedPairs.push([r - 1, w - 1]);
      r--;
      w--;
    } else if (bestScore[r - 1][w] >= bestScore[r][w - 1]) {
      r--;
    } else {
      w--;
    }
  }
  return alignedPairs.reverse();
}

/**
 * Deterministically compares reference content against website content.
 *
 * Elements whose text is identical are aligned in document order, so extra blocks on the page
 * (banners, CTAs, share buttons) never break the matching. Outcomes for each reference element:
 * - PASS: tag matches, text matches (normalized, case-sensitive)
 * - WRONG_TAG: text matches, but semantic tag differs (e.g. h2 vs h3, or h3 vs a <button>)
 * - WRONG_ORDER: text exists on the page, but not in the position the reference expects
 * - CONTENT_MISMATCH: an element of the same kind sits where the reference expects it, but text differs
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
  const refKeys = refElements.map((element) => textMatchKey(element.text));
  const webKeys = webElements.map((element) => textMatchKey(element.text));

  const websiteIndexByReferenceIndex = new Map<number, number>();
  const outOfOrderReferenceIndexes = new Set<number>();
  const claimedWebsiteIndexes = new Set<number>();

  const alignedPairs = alignElementsWithIdenticalText(refElements, refKeys, webElements, webKeys);
  alignedPairs.forEach(([r, w]) => {
    websiteIndexByReferenceIndex.set(r, w);
    claimedWebsiteIndexes.add(w);
  });

  refElements.forEach((_, r) => {
    if (websiteIndexByReferenceIndex.has(r)) return;
    const w = webKeys.findIndex((key, index) => key === refKeys[r] && !claimedWebsiteIndexes.has(index));
    if (w === -1) return;
    websiteIndexByReferenceIndex.set(r, w);
    outOfOrderReferenceIndexes.add(r);
    claimedWebsiteIndexes.add(w);
  });

  const anchorsBefore = (position: number, side: 0 | 1) =>
    alignedPairs.filter((pair) => pair[side] < position).length;
  const pairedByPositionReferenceIndexes = new Set<number>();
  const unmatchedReferenceIndexes = refElements.map((_, r) => r).filter((r) => !websiteIndexByReferenceIndex.has(r));
  const unmatchedWebsiteIndexes = webElements.map((_, w) => w).filter((w) => !claimedWebsiteIndexes.has(w));

  for (let gap = 0; gap <= alignedPairs.length; gap++) {
    const gapReferenceIndexes = unmatchedReferenceIndexes.filter((r) => anchorsBefore(r, 0) === gap);
    const gapWebsiteIndexes = unmatchedWebsiteIndexes.filter((w) => anchorsBefore(w, 1) === gap);

    (['text', 'list', 'table'] as const).forEach((pairingGroup) => {
      const referenceCandidates = gapReferenceIndexes.filter((r) => pairingGroupOf(refElements[r]) === pairingGroup);
      const websiteCandidates = gapWebsiteIndexes.filter((w) => pairingGroupOf(webElements[w]) === pairingGroup);
      const sameCount = referenceCandidates.length === websiteCandidates.length;
      const unpairedWebsite = new Set(websiteCandidates);

      referenceCandidates.forEach((r, position) => {
        const positional = sameCount ? websiteCandidates[position] : undefined;
        let chosen: number | undefined;

        if (
          positional !== undefined &&
          webElements[positional].type === refElements[r].type &&
          !isGenericTextBlock(webElements[positional])
        ) {
          chosen = positional;
        } else {
          let bestSimilarity = MINIMUM_WORD_SIMILARITY_FOR_PAIRING;
          unpairedWebsite.forEach((w) => {
            const similarity = wordSimilarity(refElements[r].text, webElements[w].text);
            if (similarity >= bestSimilarity) {
              bestSimilarity = similarity;
              chosen = w;
            }
          });
        }

        if (chosen === undefined) return;
        unpairedWebsite.delete(chosen);
        websiteIndexByReferenceIndex.set(r, chosen);
        claimedWebsiteIndexes.add(chosen);
        pairedByPositionReferenceIndexes.add(r);
      });
    });
  }

  const results: ElementComparisonResult[] = refElements.map((ref, r) => {
    const order = r + 1;
    const id = `comp-${order}`;
    const websiteIndex = websiteIndexByReferenceIndex.get(r);

    if (websiteIndex === undefined) {
      return {
        id,
        order,
        status: 'MISSING',
        reference: describeElement(ref) as ElementComparisonResult['reference'],
        message: `Reference element <${ref.tag}> was not found on the webpage.`,
      };
    }

    const web = webElements[websiteIndex];
    const reference = describeElement(ref) as ElementComparisonResult['reference'];

    if (pairedByPositionReferenceIndexes.has(r)) {
      let message = 'Content differs from reference.';
      if (ref.type === 'list' && web.type === 'list') {
        const listComparison = compareListDetails(ref.items, web.items);
        if (!listComparison.matches) message = listComparison.detail;
      }
      if (ref.type === 'table' && web.type === 'table') {
        const tableComparison = compareTableDetails(ref.rows, web.rows);
        if (!tableComparison.matches) message = tableComparison.detail;
      }

      const pageTag = ref.tag === web.tag ? web.tag : pageTagOf(web);
      if (ref.tag !== web.tag) {
        message += ` Tag also differs: page uses <${pageTag}> instead of expected <${ref.tag}>.`;
      }
      return { id, order, status: 'CONTENT_MISMATCH', reference, website: describeElement(web, pageTag), message };
    }

    if (outOfOrderReferenceIndexes.has(r)) {
      return {
        id,
        order,
        status: 'WRONG_ORDER',
        reference,
        website: describeElement(web),
        message: 'Text was found on the page, but not in the position the reference expects.',
      };
    }

    if (ref.tag === web.tag) {
      return {
        id,
        order,
        status: 'PASS',
        reference,
        website: describeElement(web),
        message: 'Tag and content match reference.',
      };
    }

    const pageTag = pageTagOf(web);
    return {
      id,
      order,
      status: 'WRONG_TAG',
      reference,
      website: describeElement(web, pageTag),
      message: `Text matches, but page uses <${pageTag}> instead of expected <${ref.tag}>.`,
    };
  });

  const extraWebsiteElements = webElements.filter((_, w) => !claimedWebsiteIndexes.has(w));
  const countOf = (status: ElementComparisonResult['status']) =>
    results.filter((result) => result.status === status).length;

  const summary: AuditSummary = {
    total: results.length,
    passed: countOf('PASS'),
    wrongTag: countOf('WRONG_TAG'),
    wrongOrder: countOf('WRONG_ORDER'),
    contentMismatch: countOf('CONTENT_MISMATCH'),
    missing: countOf('MISSING'),
    extraOnWebsite: extraWebsiteElements.length,
    status:
      countOf('MISSING') + countOf('CONTENT_MISMATCH') > 0
        ? 'FAIL'
        : countOf('WRONG_TAG') + countOf('WRONG_ORDER') > 0
        ? 'PASS_WITH_WARNINGS'
        : 'PASS',
  };

  return {
    summary,
    results,
    referenceTree: refDoc,
    websiteTree: webDoc,
    extraWebsiteElements,
  };
}
