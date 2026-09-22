import { compareTextSimilarity } from './TextMatcher';
import type { TableComparison, BlockComparisonStatus } from '../types/report';
import type { ReferenceTable } from '../types/reference';
import type { PageTable } from '../types/page';

export function auditTables(
  expectedTables: ReferenceTable[],
  actualTables: PageTable[]
): TableComparison[] {
  const comparisons: TableComparison[] = [];

  for (let i = 0; i < expectedTables.length; i++) {
    const exp = expectedTables[i];
    const act = actualTables[i];

    if (!act) {
      comparisons.push({
        id: exp.id,
        expectedRows: exp.rows,
        actualRows: [],
        status: 'MISSING',
        rowMatches: 0,
        totalExpectedRows: exp.rows.length,
        missingRows: exp.rows,
        evidence: `Table #${i + 1} completely missing on webpage`,
      });
      continue;
    }

    let matchedRowCount = 0;
    const missingRows: string[][] = [];

    for (const expRow of exp.rows) {
      // Find matching row in act.rows
      let rowFound = false;
      for (const actRow of act.rows) {
        if (expRow.length !== actRow.length && expRow.length > 0) continue;

        // Compare cell by cell: strict matching for cells
        let allCellsMatch = true;
        for (let c = 0; c < expRow.length; c++) {
          const expCell = expRow[c] || '';
          const actCell = actRow[c] || '';
          const res = compareTextSimilarity(expCell, actCell);
          // Only EXACT or NEAR_EXACT count as cell match
          if (res.status !== 'EXACT' && res.status !== 'NEAR_EXACT') {
            allCellsMatch = false;
            break;
          }
        }
        if (allCellsMatch && expRow.length > 0) {
          rowFound = true;
          break;
        }
      }

      if (rowFound) {
        matchedRowCount++;
      } else {
        missingRows.push(expRow);
      }
    }

    let status: BlockComparisonStatus = 'EXACT';
    if (matchedRowCount === exp.rows.length && exp.rows.length > 0) {
      status = 'EXACT';
    } else if (matchedRowCount > 0) {
      status = 'PARTIAL';
    } else {
      status = 'MISSING';
    }

    comparisons.push({
      id: exp.id,
      expectedRows: exp.rows,
      actualRows: act.rows,
      status,
      rowMatches: matchedRowCount,
      totalExpectedRows: exp.rows.length,
      missingRows,
      evidence: `Table #${i + 1}: ${matchedRowCount}/${exp.rows.length} rows matched`,
    });
  }

  return comparisons;
}
