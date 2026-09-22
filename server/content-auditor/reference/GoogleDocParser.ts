import type { ContentReference, ReferenceBlock, ReferenceHeading, ReferenceTable, ReferenceFaq } from '../types/reference';
import { normalizeText } from './ReferenceNormalizer';

function extractLabeledField(lines: string[], labelPattern: RegExp): { value: string; lineIndex: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(labelPattern);
    if (match && match[1]) {
      const clean = match[1].replace(/\(\d+\s*chars?\)\s*$/i, '').trim();
      return { value: clean, lineIndex: i };
    }
  }
  return null;
}

function isHeadingLine(line: string): boolean {
  return /^(?:h[1-6]\s*[:\-]?\s*|#{1,6}\s+)/i.test(line.trim());
}

export function parseGoogleDocReference(rawText: string, docUrl?: string): ContentReference {
  const originalLines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const unverifiedFields: string[] = [];
  const notes: string[] = [];

  // 1. Detect explicitly labeled fields
  const labeledUrl = extractLabeledField(originalLines, /^\s*url\s*[:\-]\s*(.+)$/i);
  const labeledTitle = extractLabeledField(originalLines, /^\s*(?:meta\s+title|title)\s*[:\-]\s*(.+)$/i);
  const labeledDesc = extractLabeledField(originalLines, /^\s*(?:meta\s+description|description|desc\.?)\s*[:\-]\s*(.+)$/i);
  const labeledFeatureImage = extractLabeledField(originalLines, /^\s*feature(?:d)?\s+image\s*[:\-]\s*(.+)$/i);
  const labeledPrimaryKeyword = extractLabeledField(originalLines, /^\s*primary\s+keyword\s*[:\-]\s*(.+)$/i);
  const labeledSecondaryKeywords = extractLabeledField(originalLines, /^\s*secondary\s+keywords?\s*[:\-]\s*(.+)$/i);
  const labeledRequiredSchema = extractLabeledField(originalLines, /^\s*required\s+schema\s*[:\-]\s*(.+)$/i);

  let metaTitle = labeledTitle?.value;
  let metaDescription = labeledDesc?.value;

  // Track lines that were consumed as metadata so they aren't parsed as body content
  const consumedLineIndices = new Set<number>();
  if (labeledUrl) consumedLineIndices.add(labeledUrl.lineIndex);
  if (labeledTitle) consumedLineIndices.add(labeledTitle.lineIndex);
  if (labeledDesc) consumedLineIndices.add(labeledDesc.lineIndex);
  if (labeledFeatureImage) consumedLineIndices.add(labeledFeatureImage.lineIndex);
  if (labeledPrimaryKeyword) consumedLineIndices.add(labeledPrimaryKeyword.lineIndex);
  if (labeledSecondaryKeywords) consumedLineIndices.add(labeledSecondaryKeywords.lineIndex);
  if (labeledRequiredSchema) consumedLineIndices.add(labeledRequiredSchema.lineIndex);

  const hasAnyMetadataLabels = !!(
    labeledUrl ||
    labeledTitle ||
    labeledDesc ||
    labeledFeatureImage ||
    labeledPrimaryKeyword ||
    labeledSecondaryKeywords ||
    labeledRequiredSchema
  );

  // Fix 8: Do NOT blindly assume first line = title, second line = description
  // If no explicit title/description was found, mark as UNVERIFIED unless there is clear preamble structure
  if (!metaTitle) {
    unverifiedFields.push('meta.title');
    notes.push('No explicit Meta Title found; marked as unverified.');
  }

  if (!metaDescription) {
    unverifiedFields.push('meta.description');
    notes.push('No explicit Meta Description found; marked as unverified.');
  }

  // 2. Identify FAQ section boundaries
  const faqStartIndex = originalLines.findIndex((l) => /^\s*(faqs?|frequently asked questions)\s*:?\s*$/i.test(l));
  const faq: ReferenceFaq[] = [];
  const faqLineIndices = new Set<number>();

  if (faqStartIndex >= 0) {
    faqLineIndices.add(faqStartIndex);
    let i = faqStartIndex + 1;
    let faqOrder = 1;
    while (i < originalLines.length) {
      const line = originalLines[i];
      // Check for Question/Answer pairs
      const qMatch = line.match(/^(?:Q\d*[:\-]|Question\s*\d*[:\-])\s*(.+)$/i);
      if (qMatch) {
        faqLineIndices.add(i);
        const questionText = qMatch[1].trim();
        let answerText = '';
        if (i + 1 < originalLines.length) {
          const nextLine = originalLines[i + 1];
          const aMatch = nextLine.match(/^(?:A\d*[:\-]|Answer\s*\d*[:\-])\s*(.+)$/i);
          if (aMatch) {
            faqLineIndices.add(i + 1);
            answerText = aMatch[1].trim();
            i++;
          }
        }
        faq.push({
          question: questionText,
          answer: answerText,
          order: faqOrder++,
        });
      } else if (line.endsWith('?') && i + 1 < originalLines.length) {
        // Natural question line
        faqLineIndices.add(i);
        faqLineIndices.add(i + 1);
        faq.push({
          question: line,
          answer: originalLines[i + 1],
          order: faqOrder++,
        });
        i++;
      }
      i++;
    }
  }

  // 3. Skip standalone "Content" marker line if present
  let bodyStartIndex = 0;
  for (let i = 0; i < originalLines.length; i++) {
    const line = originalLines[i];
    if (/^\s*content\s*:?\s*$/i.test(line)) {
      bodyStartIndex = i + 1;
      break;
    }
  }

  // 4. Extract structured blocks and headings
  const blocks: ReferenceBlock[] = [];
  const headings: ReferenceHeading[] = [];
  const tables: ReferenceTable[] = [];
  let blockCounter = 0;

  for (let i = bodyStartIndex; i < originalLines.length; i++) {
    if (consumedLineIndices.has(i) || faqLineIndices.has(i)) continue;

    const line = originalLines[i];
    // Skip divider lines
    if (/^[_\-=*]{3,}$/.test(line)) continue;

    // Check for explicit heading notation (e.g. "H2 Our Services" or "## Our Services")
    const hPrefixMatch = line.match(/^(?:(h[1-6])\s*[:\-]?\s*|(#{1,6})\s+)(.+)$/i);
    blockCounter++;

    if (hPrefixMatch) {
      const level = hPrefixMatch[1]
        ? parseInt(hPrefixMatch[1][1], 10)
        : hPrefixMatch[2].length;
      const headingText = normalizeText(hPrefixMatch[3]);

      headings.push({
        id: `ref-h-${headings.length + 1}`,
        level,
        text: headingText,
        normalizedText: headingText.toLowerCase(),
        order: blockCounter,
      });

      blocks.push({
        id: `ref-blk-${blockCounter}`,
        type: 'heading',
        level,
        text: headingText,
        normalizedText: headingText.toLowerCase(),
        order: blockCounter,
      });
      continue;
    }

    // Check for list item notation (* item, - item, 1. item)
    const listMatch = line.match(/^([*\-•]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const listType = /^\d+\./.test(listMatch[1]) ? 'ol' : 'ul';
      const itemText = normalizeText(listMatch[2]);
      blocks.push({
        id: `ref-blk-${blockCounter}`,
        type: 'listItem',
        listType,
        text: itemText,
        normalizedText: itemText.toLowerCase(),
        order: blockCounter,
      });
      continue;
    }

    // Check for tab-separated table row (Google Docs table export)
    if (line.includes('\t') || line.includes(' | ')) {
      const cells = (line.includes('\t') ? line.split('\t') : line.split(' | '))
        .map((c) => normalizeText(c))
        .filter((c) => c.length > 0);
      if (cells.length > 1) {
        blocks.push({
          id: `ref-blk-${blockCounter}`,
          type: 'tableRow',
          text: cells.join(' | '),
          normalizedText: cells.join(' | ').toLowerCase(),
          order: blockCounter,
        });
        continue;
      }
    }

    // Standard paragraph
    const pText = normalizeText(line);
    if (pText.length > 0) {
      blocks.push({
        id: `ref-blk-${blockCounter}`,
        type: 'paragraph',
        text: pText,
        normalizedText: pText.toLowerCase(),
        order: blockCounter,
      });
    }
  }

  const confidenceScore = rawText.trim().length > 0 ? 95 : 0;

  return {
    url: labeledUrl?.value || docUrl,
    meta: {
      title: metaTitle,
      description: metaDescription,
      primaryKeyword: labeledPrimaryKeyword?.value,
      secondaryKeywords: labeledSecondaryKeywords?.value ? labeledSecondaryKeywords.value.split(',').map((k) => k.trim()) : undefined,
    },
    featureImage: labeledFeatureImage?.value,
    headings,
    blocks,
    tables,
    faq,
    requiredSchema: labeledRequiredSchema?.value ? labeledRequiredSchema.value.split(',').map((s) => s.trim()) : undefined,
    source: 'google-doc',
    extractionConfidence: confidenceScore,
    diagnostics: {
      characterCount: rawText.length,
      blockCount: blocks.length,
      lineCount: originalLines.length,
      unverifiedFields,
      notes,
    },
  };
}
