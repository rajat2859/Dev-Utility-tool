import type { docs_v1 } from 'googleapis';
import type {
  NormalizedDocument,
  NormalizedElement,
  HeadingTag,
  ListElement,
} from '../types/normalized';
import { normalizeText } from '../utils/textNormalizer';

/**
 * Extracts raw textual content from a Google Docs paragraph element
 * by concatenating all text runs and removing structural trailing newlines.
 */
function extractParagraphText(paragraph?: docs_v1.Schema$Paragraph): string {
  if (!paragraph || !paragraph.elements) return '';
  const raw = paragraph.elements.map((el) => el.textRun?.content || '').join('');
  return normalizeText(raw);
}

/**
 * Determines whether a bullet in a Google Doc represents an ordered list (ol)
 * or unordered list (ul) by inspecting glyph properties.
 */
function determineListType(
  doc: docs_v1.Schema$Document,
  bullet?: docs_v1.Schema$Bullet
): 'ul' | 'ol' {
  if (!bullet || !bullet.listId || !doc.lists) return 'ul';

  const listInfo = doc.lists[bullet.listId];
  const nestingLevel = bullet.nestingLevel || 0;
  const glyphType =
    listInfo?.listProperties?.nestingLevels?.[nestingLevel]?.glyphType;

  if (glyphType && /^(DECIMAL|ALPHA|ROMAN)/i.test(glyphType)) {
    return 'ol';
  }
  return 'ul';
}

/**
 * Extracts optional metadata found in content elements preceding the first H1.
 */
function extractPreambleMetadata(
  elements: docs_v1.Schema$StructuralElement[]
): Record<string, string> {
  const metadata: Record<string, string> = {};

  for (const el of elements) {
    if (!el.paragraph) continue;
    const text = extractParagraphText(el.paragraph);
    if (!text) continue;

    const urlMatch = text.match(/^\s*url\s*[:\-]\s*(.+)$/i);
    if (urlMatch && urlMatch[1]) {
      metadata.url = urlMatch[1].trim();
      continue;
    }

    const titleMatch = text.match(/^\s*(?:meta\s+title|title)\s*[:\-]\s*(.+)$/i);
    if (titleMatch && titleMatch[1]) {
      metadata.title = titleMatch[1].trim();
      continue;
    }

    const descMatch = text.match(
      /^\s*(?:meta\s+description|description|desc\.?)\s*[:\-]\s*(.+)$/i
    );
    if (descMatch && descMatch[1]) {
      metadata.description = descMatch[1].trim();
      continue;
    }
  }

  return metadata;
}

/**
 * Parses a Google Doc API response into a normalized semantic content tree.
 *
 * Requirements:
 * - Scans from the FIRST HEADING_1 onward.
 * - Discards all content before the first HEADING_1.
 * - Throws "No Heading 1 was found in the Google Doc." if no HEADING_1 exists.
 * - Maps HEADING_1..6 -> h1..h6
 * - Maps NORMAL_TEXT -> p
 * - Maps bullet items -> ul / ol
 * - Maps tables -> table
 * - Ignores fonts, sizes, colors, and layout noise.
 */
export function parseGoogleDoc(doc: docs_v1.Schema$Document): NormalizedDocument {
  const content = doc.body?.content || [];

  // 1. Locate the index of the first HEADING_1
  let firstH1Index = -1;
  for (let i = 0; i < content.length; i++) {
    const el = content[i];
    if (el.paragraph?.paragraphStyle?.namedStyleType === 'HEADING_1') {
      const text = extractParagraphText(el.paragraph);
      if (text.length > 0) {
        firstH1Index = i;
        break;
      }
    }
  }

  if (firstH1Index === -1) {
    throw new Error('No Heading 1 was found in the Google Doc.');
  }

  // Extract optional metadata before first H1
  const preambleMetadata = extractPreambleMetadata(content.slice(0, firstH1Index));

  const elements: NormalizedElement[] = [];
  let elementIndex = 0;

  // Track pending list items for grouping consecutive list elements
  let currentList: ListElement | null = null;

  function finalizePendingList() {
    if (currentList && currentList.items.length > 0) {
      currentList.text = currentList.items.join(' • ');
      elements.push(currentList);
      currentList = null;
    }
  }

  // 2. Process structural elements strictly from the first H1 onward
  for (let i = firstH1Index; i < content.length; i++) {
    const el = content[i];

    // Paragraph handling
    if (el.paragraph) {
      const paragraph = el.paragraph;
      const text = extractParagraphText(paragraph);
      if (!text) continue;

      // Check if bulleted / numbered list item
      if (paragraph.bullet) {
        const listTag = determineListType(doc, paragraph.bullet);

        if (currentList && currentList.tag === listTag) {
          currentList.items.push(text);
        } else {
          finalizePendingList();
          elementIndex++;
          currentList = {
            id: `doc-el-${elementIndex}`,
            type: 'list',
            tag: listTag,
            items: [text],
            text: text,
          };
        }
        continue;
      }

      // Non-bullet paragraph: finalize any active list
      finalizePendingList();

      const styleType = paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
      elementIndex++;

      const headingMatch = styleType.match(/^HEADING_([1-6])$/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10);
        const tag = `h${level}` as HeadingTag;
        elements.push({
          id: `doc-el-${elementIndex}`,
          type: 'heading',
          tag,
          level,
          text,
        });
      } else {
        elements.push({
          id: `doc-el-${elementIndex}`,
          type: 'paragraph',
          tag: 'p',
          text,
        });
      }
      continue;
    }

    // Table handling
    if (el.table) {
      finalizePendingList();

      const rows: string[][] = [];
      for (const row of el.table.tableRows || []) {
        const cells: string[] = [];
        for (const cell of row.tableCells || []) {
          const cellTexts: string[] = [];
          for (const cellContent of cell.content || []) {
            if (cellContent.paragraph) {
              const pText = extractParagraphText(cellContent.paragraph);
              if (pText) cellTexts.push(pText);
            }
          }
          cells.push(normalizeText(cellTexts.join(' ')));
        }
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      }

      if (rows.length > 0) {
        elementIndex++;
        const tableText = rows.map((r) => r.join(' | ')).join('\n');
        elements.push({
          id: `doc-el-${elementIndex}`,
          type: 'table',
          tag: 'table',
          rows,
          text: tableText,
        });
      }
      continue;
    }
  }

  // Finalize any trailing list
  finalizePendingList();

  return {
    title: doc.title || preambleMetadata.title,
    elements,
    metadata: {
      ...preambleMetadata,
    },
  };
}
