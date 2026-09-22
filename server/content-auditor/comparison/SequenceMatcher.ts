import { compareTextSimilarity } from './TextMatcher';
import { computeWordDiff } from './diff';
import type { BlockComparison, BlockComparisonStatus } from '../types/report';
import type { ReferenceBlock } from '../types/reference';
import type { PageContentBlock } from '../types/page';

/**
 * Performs order-aware, one-to-one content block comparison.
 * Detects missing, moved, partial, exact, and extra content.
 */
export function auditContentSequence(
  expectedBlocks: ReferenceBlock[],
  actualBlocks: PageContentBlock[]
): {
  comparisons: BlockComparison[];
  extraBlocks: BlockComparison[];
} {
  const comparisons: BlockComparison[] = [];
  const claimedActualBlockIds = new Set<string>();

  // Track actual orders matched so far to detect out-of-order / MOVED items
  let lastActualOrder = -1;

  for (const exp of expectedBlocks) {
    let bestMatch: {
      block: PageContentBlock;
      similarity: number;
      status: BlockComparisonStatus;
    } | null = null;

    for (const act of actualBlocks) {
      if (claimedActualBlockIds.has(act.id)) continue;

      const res = compareTextSimilarity(exp.text, act.text);
      if (res.status === 'EXACT' || res.status === 'NEAR_EXACT' || res.status === 'PARTIAL') {
        if (!bestMatch || res.similarity > bestMatch.similarity) {
          bestMatch = {
            block: act,
            similarity: res.similarity,
            status: res.status,
          };
          if (res.status === 'EXACT') break;
        }
      }
    }

    if (bestMatch) {
      claimedActualBlockIds.add(bestMatch.block.id);

      // Check order: moved if position diverges significantly from expected order or violates monotone flow
      const orderDiff = Math.abs(bestMatch.block.order - exp.order);
      const isMoved = (orderDiff > 2) || (lastActualOrder >= 0 && bestMatch.block.order < lastActualOrder);

      let finalStatus: BlockComparisonStatus = bestMatch.status;
      if (isMoved && (bestMatch.status === 'EXACT' || bestMatch.status === 'NEAR_EXACT')) {
        finalStatus = 'MOVED';
      } else if (isMoved) {
        finalStatus = 'WRONG_ORDER';
      }

      if (bestMatch.block.order > lastActualOrder) {
        lastActualOrder = bestMatch.block.order;
      }

      const isStructureMatch =
        exp.type === bestMatch.block.type &&
        (exp.type !== 'heading' || exp.level === bestMatch.block.level);

      comparisons.push({
        id: `comp-${exp.id}`,
        type: exp.type,
        expected: exp.text,
        actual: bestMatch.block.text,
        expectedOrder: exp.order,
        actualOrder: bestMatch.block.order,
        status: finalStatus,
        similarity: bestMatch.similarity,
        copyMatch: bestMatch.status === 'EXACT' || bestMatch.status === 'NEAR_EXACT' ? 'PASS' : 'PARTIAL',
        structureMatch: isStructureMatch ? 'PASS' : 'FAIL',
        evidence: `Page block #${bestMatch.block.order} (${bestMatch.block.type})`,
        difference: bestMatch.status !== 'EXACT' ? computeWordDiff(exp.text, bestMatch.block.text) : undefined,
      });
    } else {
      // Missing block
      comparisons.push({
        id: `comp-${exp.id}`,
        type: exp.type,
        expected: exp.text,
        actual: undefined,
        expectedOrder: exp.order,
        actualOrder: undefined,
        status: 'MISSING',
        similarity: 0.0,
        copyMatch: 'FAIL',
        structureMatch: 'FAIL',
        evidence: 'Not found in webpage main content',
      });
    }
  }

  // Detect meaningful extra content on the page (Fix 30)
  const extraBlocks: BlockComparison[] = [];
  for (const act of actualBlocks) {
    if (!claimedActualBlockIds.has(act.id)) {
      // Filter out tiny / noisy blocks (e.g. copyright, single numbers, social icons)
      if (act.text.trim().length > 25 && !/^(copyright|all rights reserved|privacy policy|terms of service)/i.test(act.text)) {
        extraBlocks.push({
          id: `extra-${act.id}`,
          type: act.type,
          expected: '',
          actual: act.text,
          expectedOrder: -1,
          actualOrder: act.order,
          status: 'EXTRA',
          similarity: 0.0,
          copyMatch: 'FAIL',
          structureMatch: 'FAIL',
          evidence: `Unexpected extra page block #${act.order} (${act.type})`,
        });
      }
    }
  }

  return { comparisons, extraBlocks };
}
