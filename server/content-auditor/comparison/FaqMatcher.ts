import { compareTextSimilarity } from './TextMatcher';
import type { FaqComparison, BlockComparisonStatus } from '../types/report';
import type { ReferenceFaq } from '../types/reference';
import type { PageFaqData } from '../types/page';

export function auditFaq(
  expectedFaqs: ReferenceFaq[],
  actualFaqData: PageFaqData,
  requiresSchema = false
): FaqComparison {
  if (expectedFaqs.length === 0) {
    return {
      present: actualFaqData.present,
      status: 'NOT_REQUIRED',
      schemaPresent: actualFaqData.schemaPresent,
      schemaCorrespondsToContent: true,
      itemComparisons: [],
      evidence: 'No FAQ section specified in reference.',
      notes: actualFaqData.schemaPresent ? ['Page contains FAQ schema, but none was required by the reference brief.'] : [],
    };
  }

  const itemComparisons: FaqComparison['itemComparisons'] = [];
  let matchedCount = 0;
  const notes: string[] = [];

  for (const exp of expectedFaqs) {
    // Look for matching question in page FAQ items
    let matchedItem = actualFaqData.items.find((act) => {
      const qSim = compareTextSimilarity(exp.question, act.question);
      return qSim.status === 'EXACT' || qSim.status === 'NEAR_EXACT' || qSim.status === 'PARTIAL';
    });

    // If not found in page HTML FAQ items, check schema items
    if (!matchedItem && actualFaqData.schemaItems.length > 0) {
      matchedItem = actualFaqData.schemaItems.find((schemaItem) => {
        const qSim = compareTextSimilarity(exp.question, schemaItem.question);
        return qSim.status === 'EXACT' || qSim.status === 'NEAR_EXACT' || qSim.status === 'PARTIAL';
      });
    }

    if (matchedItem) {
      const qRes = compareTextSimilarity(exp.question, matchedItem.question);
      const aRes = compareTextSimilarity(exp.answer, matchedItem.answer);

      const qMatch = qRes.status === 'EXACT' || qRes.status === 'NEAR_EXACT';
      const aMatch = aRes.status === 'EXACT' || aRes.status === 'NEAR_EXACT' || aRes.status === 'PARTIAL';

      let status: BlockComparisonStatus = 'EXACT';
      if (!qMatch || !aMatch) {
        status = 'PARTIAL';
      }

      if (qMatch && aMatch) matchedCount++;

      itemComparisons.push({
        expectedQuestion: exp.question,
        expectedAnswer: exp.answer,
        actualQuestion: matchedItem.question,
        actualAnswer: matchedItem.answer,
        questionMatch: qMatch,
        answerMatch: aMatch,
        status,
      });
    } else {
      itemComparisons.push({
        expectedQuestion: exp.question,
        expectedAnswer: exp.answer,
        questionMatch: false,
        answerMatch: false,
        status: 'MISSING',
      });
    }
  }

  // Schema checking: only flag missing schema if explicitly required by reference
  let schemaCorresponds = true;
  if (requiresSchema && !actualFaqData.schemaPresent) {
    notes.push('The reference brief specifies required FAQPage schema, but no FAQPage JSON-LD was detected on the page.');
  }

  if (actualFaqData.schemaPresent && actualFaqData.schemaItems.length > 0) {
    // Check if schema items correspond to reference questions
    let schemaMismatch = 0;
    for (const sItem of actualFaqData.schemaItems) {
      const foundInExp = expectedFaqs.some((exp) => {
        return compareTextSimilarity(sItem.question, exp.question).status !== 'MISMATCH';
      });
      if (!foundInExp) schemaMismatch++;
    }
    if (schemaMismatch > 0) {
      schemaCorresponds = false;
      notes.push(`${schemaMismatch} FAQPage schema question(s) do not correspond to the reference FAQ content.`);
    }
  }

  let status: FaqComparison['status'] = 'EXACT';
  if (matchedCount === expectedFaqs.length) {
    status = 'EXACT';
  } else if (matchedCount > 0) {
    status = 'PARTIAL';
  } else {
    status = 'MISSING';
  }

  return {
    present: actualFaqData.present || actualFaqData.schemaPresent,
    status,
    schemaPresent: actualFaqData.schemaPresent,
    schemaCorrespondsToContent: schemaCorresponds,
    itemComparisons,
    evidence: `${matchedCount}/${expectedFaqs.length} FAQ questions & answers matched.`,
    notes,
  };
}
