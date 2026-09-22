import { compareTextSimilarity } from './TextMatcher';
import type { ListComparison, BlockComparisonStatus } from '../types/report';

export function auditLists(
  expectedLists: Array<{ type: 'ul' | 'ol'; items: string[] }>,
  actualLists: Array<{ type: 'ul' | 'ol'; items: string[] }>
): ListComparison[] {
  const comparisons: ListComparison[] = [];

  for (let i = 0; i < expectedLists.length; i++) {
    const exp = expectedLists[i];
    const act = actualLists[i];

    if (!act) {
      comparisons.push({
        type: exp.type,
        expectedItems: exp.items,
        actualItems: [],
        status: 'MISSING',
        missingItems: exp.items,
        extraItems: [],
        orderMatches: false,
        evidence: `List #${i + 1} (${exp.type.toUpperCase()}) missing from page`,
      });
      continue;
    }

    const missingItems: string[] = [];
    const matchedActualIndices = new Set<number>();
    let orderMatches = true;
    let lastActualIdx = -1;

    for (let expIdx = 0; expIdx < exp.items.length; expIdx++) {
      const expItem = exp.items[expIdx];
      let matchedIdx = -1;

      for (let actIdx = 0; actIdx < act.items.length; actIdx++) {
        if (matchedActualIndices.has(actIdx)) continue;
        const res = compareTextSimilarity(expItem, act.items[actIdx]);
        if (res.status === 'EXACT' || res.status === 'NEAR_EXACT' || res.status === 'PARTIAL') {
          matchedIdx = actIdx;
          break;
        }
      }

      if (matchedIdx !== -1) {
        matchedActualIndices.add(matchedIdx);
        if (matchedIdx < lastActualIdx) {
          orderMatches = false;
        }
        lastActualIdx = matchedIdx;
      } else {
        missingItems.push(expItem);
      }
    }

    const extraItems: string[] = [];
    for (let actIdx = 0; actIdx < act.items.length; actIdx++) {
      if (!matchedActualIndices.has(actIdx)) {
        extraItems.push(act.items[actIdx]);
      }
    }

    let status: BlockComparisonStatus = 'EXACT';
    if (missingItems.length > 0) {
      status = missingItems.length === exp.items.length ? 'MISSING' : 'PARTIAL';
    } else if (!orderMatches && exp.type === 'ol') {
      status = 'WRONG_ORDER';
    } else if (extraItems.length > 0) {
      status = 'EXTRA';
    }

    comparisons.push({
      type: exp.type,
      expectedItems: exp.items,
      actualItems: act.items,
      status,
      missingItems,
      extraItems,
      orderMatches,
      evidence: `List #${i + 1}: ${exp.items.length - missingItems.length}/${exp.items.length} items matched`,
    });
  }

  return comparisons;
}
