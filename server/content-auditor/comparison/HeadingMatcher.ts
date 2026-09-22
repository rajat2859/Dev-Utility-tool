import { compareTextSimilarity } from './TextMatcher';
import { computeWordDiff } from './diff';
import type { HeadingComparison, BlockComparisonStatus } from '../types/report';
import type { ReferenceHeading } from '../types/reference';
import type { PageHeading, PageContentBlock } from '../types/page';

/**
 * Validates heading hierarchy, copy accuracy, and heading tag structure.
 */
export function auditHeadings(
  expectedHeadings: ReferenceHeading[],
  actualHeadings: PageHeading[],
  allPageBlocks: PageContentBlock[]
): HeadingComparison[] {
  const comparisons: HeadingComparison[] = [];
  const claimedHeadingIds = new Set<string>();

  for (let expIdx = 0; expIdx < expectedHeadings.length; expIdx++) {
    const exp = expectedHeadings[expIdx];
    let bestHeadingMatch: { heading: PageHeading; score: number; status: BlockComparisonStatus } | null = null;

    // 1. Look for matching heading in actualHeadings that has not yet been claimed
    for (const act of actualHeadings) {
      if (claimedHeadingIds.has(act.id)) continue;
      const res = compareTextSimilarity(exp.text, act.text);
      if (res.status === 'EXACT' || res.status === 'NEAR_EXACT' || res.status === 'PARTIAL') {
        if (!bestHeadingMatch || res.similarity > bestHeadingMatch.score) {
          bestHeadingMatch = { heading: act, score: res.similarity, status: res.status };
        }
      }
    }

    if (bestHeadingMatch) {
      claimedHeadingIds.add(bestHeadingMatch.heading.id);
      const isLevelMatch = exp.level === bestHeadingMatch.heading.level;
      const isOrderOk = bestHeadingMatch.heading.order >= (comparisons[expIdx - 1]?.actualOrder ?? -1);

      let finalStatus: BlockComparisonStatus = bestHeadingMatch.status;
      if (!isLevelMatch) {
        finalStatus = 'WRONG_LEVEL';
      } else if (!isOrderOk) {
        finalStatus = 'WRONG_ORDER';
      }

      const copyMatch = bestHeadingMatch.status === 'EXACT'
        ? 'EXACT'
        : bestHeadingMatch.status === 'NEAR_EXACT'
          ? 'NEAR_EXACT'
          : 'PARTIAL';

      comparisons.push({
        expectedText: exp.text,
        expectedLevel: exp.level,
        actualText: bestHeadingMatch.heading.text,
        actualLevel: bestHeadingMatch.heading.level,
        expectedOrder: exp.order,
        actualOrder: bestHeadingMatch.heading.order,
        copyMatch,
        structureMatch: isLevelMatch ? 'EXACT' : 'WRONG_LEVEL',
        status: finalStatus,
        similarity: bestHeadingMatch.score,
        evidence: `Page Heading <h${bestHeadingMatch.heading.level}> at position #${bestHeadingMatch.heading.order}`,
        difference: bestHeadingMatch.status !== 'EXACT' ? computeWordDiff(exp.text, bestHeadingMatch.heading.text) : undefined,
      });
      continue;
    }

    // 2. Not found in headings: check if the text was downgraded to a paragraph or list item (Structure Fail, Fix 3 & 4)
    let nonHeadingMatch: { block: PageContentBlock; score: number; status: BlockComparisonStatus } | null = null;
    for (const block of allPageBlocks) {
      if (block.type === 'heading') continue; // already checked above
      const res = compareTextSimilarity(exp.text, block.text);
      if (res.status === 'EXACT' || res.status === 'NEAR_EXACT' || res.status === 'PARTIAL') {
        if (!nonHeadingMatch || res.similarity > nonHeadingMatch.score) {
          nonHeadingMatch = { block, score: res.similarity, status: res.status };
        }
      }
    }

    if (nonHeadingMatch) {
      const copyMatch = nonHeadingMatch.status === 'EXACT' ? 'EXACT' : 'PARTIAL';
      comparisons.push({
        expectedText: exp.text,
        expectedLevel: exp.level,
        actualText: nonHeadingMatch.block.text,
        actualLevel: undefined, // Paragraph or other
        expectedOrder: exp.order,
        actualOrder: nonHeadingMatch.block.order,
        copyMatch,
        structureMatch: 'FAIL',
        status: 'WRONG_LEVEL',
        similarity: nonHeadingMatch.score,
        evidence: `Rendered as <${nonHeadingMatch.block.type === 'paragraph' ? 'p' : nonHeadingMatch.block.type}> instead of <h${exp.level}> at position #${nonHeadingMatch.block.order}`,
        difference: computeWordDiff(exp.text, nonHeadingMatch.block.text),
      });
      continue;
    }

    // 3. Completely missing
    comparisons.push({
      expectedText: exp.text,
      expectedLevel: exp.level,
      expectedOrder: exp.order,
      copyMatch: 'MISSING',
      structureMatch: 'FAIL',
      status: 'MISSING',
      similarity: 0.0,
      evidence: `Heading <h${exp.level}> not found on page`,
    });
  }

  return comparisons;
}
