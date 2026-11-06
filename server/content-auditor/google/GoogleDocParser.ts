import type { docs_v1 } from 'googleapis';
import * as cheerio from 'cheerio';
import type {
  NormalizedDocument,
  NormalizedElement,
  HeadingTag,
  ListElement,
  LinkRef,
} from '../types/normalized';
import { normalizeText } from '../utils/textNormalizer';
import { extractWebsiteSemanticTree } from '../webpage/domContentExtractor';
import type { GoogleDocData } from './GoogleDocsService';

function extractParagraphText(paragraph?: docs_v1.Schema$Paragraph): string {
  if (!paragraph || !paragraph.elements) return '';
  const raw = paragraph.elements.map((el) => el.textRun?.content || '').join('');
  return normalizeText(raw);
}

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

function extractPreambleMetadata(
  elements: docs_v1.Schema$StructuralElement[]
): Record<string, string> {
  const metadata: Record<string, string> = {};

  // A soft line break (Shift+Enter) arrives as \v inside one paragraph; each line can hold its own label
  const lines = elements.flatMap((el) =>
    (el.paragraph?.elements || []).map((run) => run.textRun?.content || '').join('').split(/[\v\n]/).map(normalizeText)
  );

  for (const text of lines) {
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

const NO_H1_MESSAGE =
  'No Heading 1 or Title was found in the Google Doc. Style the article headline as "Heading 1" (or "Title") and try again.';

// Lines where writers start notes for the editor; the doc after them is not article content
const NOTES_LABEL_LINE =
  /^(?:internal\s+notes?|notes?|editor'?s?\s+notes?|editorial\s+notes?|internal\s+links?)\s*[:\-–—]?$/i;
const NOTES_PREFIX = /^(?:notes?|comments?)\s+(?:for|to)\s+(?:the\s+)?(?:editors?|writers?|devs?|developers?|publishers?)\b/i;

export function isEditorNotesLine(text: string): boolean {
  const t = text.trim();
  return NOTES_LABEL_LINE.test(t) || NOTES_PREFIX.test(t);
}

// Google's export wraps every link as https://www.google.com/url?q=<real url>&sa=D&…
export function unwrapGoogleRedirect(href: string): string {
  try {
    const url = new URL(href);
    if (/(^|\.)google\.[a-z.]+$/i.test(url.hostname) && url.pathname === '/url') {
      return url.searchParams.get('q') || url.searchParams.get('url') || href;
    }
  } catch {
    // not an absolute URL; keep as written
  }
  return href;
}

// Real links only: unwrapped, and without in-doc jumps (#heading=…, #bookmark=…, table of contents)
function cleanDocLinks(links: LinkRef[]): LinkRef[] {
  return links
    .map((link) => ({ text: link.text, href: unwrapGoogleRedirect(link.href.trim()) }))
    .filter((link) => link.text && link.href && !link.href.startsWith('#'));
}

// API path: one link per run of text with the same URL (formatting changes split a link into runs)
function extractParagraphLinks(paragraph?: docs_v1.Schema$Paragraph): LinkRef[] {
  const links: LinkRef[] = [];
  let previousUrl: string | undefined;
  for (const el of paragraph?.elements || []) {
    const url = el.textRun?.textStyle?.link?.url || undefined;
    const text = el.textRun?.content || '';
    if (url && url === previousUrl) links[links.length - 1].text += text;
    else if (url) links.push({ text, href: url });
    previousUrl = url;
  }
  return cleanDocLinks(links.map((link) => ({ text: normalizeText(link.text), href: link.href })));
}

const withLinks = (links: LinkRef[]) => (links.length ? { links } : {});

// Every text line of an exported doc, table rows as "cell: cell", for label lookups (URL, Meta Title, …)
export function exportedDocLines(html: string): string[] {
  const $ = cheerio.load(html);
  // Every line break and block end becomes "\n"; otherwise "URL: …/" and "Meta Title: …" glue into one
  // line when they sit in one paragraph (Shift+Enter) or in separate paragraphs of one table cell
  $('br').replaceWith('\n');
  $('p, li, div, h1, h2, h3, h4, h5, h6').append('\n');
  return $('p, li, div, tr')
    .map((_, el) => {
      const cells = $(el).children('td, th');
      // A label cell and a value cell read as "label: value"; extra lines in the value cell stay their own lines
      return cells.length ? cells.map((_, c) => $(c).text().trim()).get().join(': ') : $(el).text();
    })
    .get()
    .flatMap((line: string) => line.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);
}

// Google's HTML export: Title style is <p class="title">, and each nesting level of a
// list is its own sibling <ul class="lst-kix_<id>-<level>">
function prepareExportedDocHtml(html: string): string {
  const $ = cheerio.load(html);
  // Comments and footnotes export as "[a]" / "[1]" link markers in the text plus their bodies at the
  // end of the doc; neither is article content
  $('a[id^="cmnt_ref"], a[id^="ftnt_ref"]').each((_, el) => {
    const $sup = $(el).closest('sup');
    ($sup.length ? $sup : $(el)).remove();
  });
  $('a[id^="cmnt"], a[id^="ftnt"]').each((_, el) => {
    const $body = $(el).closest('div');
    ($body.length && !$body.is('body') ? $body : $(el).closest('p')).remove();
  });
  if ($('h1').filter((_, el) => $(el).text().trim().length > 0).length === 0) {
    const $title = $('p.title').filter((_, el) => $(el).text().trim().length > 0).first();
    if ($title.length) $title.replaceWith(`<h1>${$title.html() ?? ''}</h1>`);
  }
  const listId = (el: any) => /\blst-kix_([\w]+)-\d+\b/.exec($(el).attr('class') || '')?.[1];
  $('ul, ol').each((_, el) => {
    const id = listId(el);
    const $prev = $(el).prev();
    if (id && $prev.is('ul, ol') && listId($prev.get(0)) === id) {
      $prev.append($(el).children('li'));
      $(el).remove();
    }
  });
  return $.html();
}

export function parseGoogleDoc(doc: GoogleDocData): NormalizedDocument {
  if ('isHtml' in doc && doc.isHtml) {
    const tree = extractWebsiteSemanticTree(prepareExportedDocHtml(doc.html));
    const hasH1 = tree.elements.some((el) => el.type === 'heading' && el.tag === 'h1');
    if (!hasH1) {
      throw new Error(NO_H1_MESSAGE);
    }
    tree.elements.forEach((el) => {
      if (!el.links) return;
      const links = cleanDocLinks(el.links);
      if (links.length) el.links = links;
      else delete el.links;
    });
    // The export's <title> is the doc's file name, not the page meta title
    return { ...tree, title: doc.title, metadata: {} };
  }

  const content = doc.body?.content || [];

  // 1. Locate the index of the first HEADING_1, falling back to the TITLE style
  const findFirst = (style: string) =>
    content.findIndex(
      (el) => el.paragraph?.paragraphStyle?.namedStyleType === style && extractParagraphText(el.paragraph).length > 0
    );
  let h1Style = 'HEADING_1';
  let firstH1Index = findFirst(h1Style);
  if (firstH1Index === -1) {
    h1Style = 'TITLE';
    firstH1Index = findFirst(h1Style);
  }

  if (firstH1Index === -1) {
    throw new Error(NO_H1_MESSAGE);
  }

  // Extract optional metadata before first H1
  const preambleMetadata = extractPreambleMetadata(content.slice(0, firstH1Index));

  const elements: NormalizedElement[] = [];
  let elementIndex = 0;

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
      const paragraphLinks = extractParagraphLinks(paragraph);

      // Check if bulleted / numbered list item
      if (paragraph.bullet) {
        const listTag = determineListType(doc, paragraph.bullet);

        if (currentList && currentList.tag === listTag) {
          currentList.items.push(text);
          if (paragraphLinks.length) currentList.links = [...(currentList.links || []), ...paragraphLinks];
        } else {
          finalizePendingList();
          elementIndex++;
          currentList = {
            id: `doc-el-${elementIndex}`,
            type: 'list',
            tag: listTag,
            items: [text],
            text: text,
            ...withLinks(paragraphLinks),
          };
        }
        continue;
      }

      finalizePendingList();

      const rawStyle = paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
      const styleType = rawStyle === h1Style ? 'HEADING_1' : rawStyle;
      elementIndex++;

      const headingMatch = styleType.match(/^HEADING_([1-6])$/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10);
        const tag = `h${level}` as HeadingTag;
        const cleanHeading = text
          .replace(/^(?:<[hH][1-6]>|\[[hH][1-6]\]|[hH][1-6][:—–-])\s*/, '')
          .trim();
        elements.push({
          id: `doc-el-${elementIndex}`,
          type: 'heading',
          tag,
          level,
          text: cleanHeading || text,
          ...withLinks(paragraphLinks),
        });
      } else {
        // A soft line break (\v) splits the paragraph, as a <br> does on the page and in the HTML export
        const lines = (paragraph.elements || [])
          .map((run) => run.textRun?.content || '')
          .join('')
          .split('\v')
          .map(normalizeText)
          .filter(Boolean);
        lines.forEach((line, i) => {
          if (i > 0) elementIndex++;
          const lineLinks = paragraphLinks.filter((link) => {
            const home = lines.findIndex((l) => l.includes(link.text));
            return (home === -1 ? 0 : home) === i;
          });
          elements.push({
            id: `doc-el-${elementIndex}`,
            type: 'paragraph',
            tag: 'p',
            text: line,
            ...withLinks(lineLinks),
          });
        });
      }
      continue;
    }

    // Table handling
    if (el.table) {
      finalizePendingList();

      const rows: string[][] = [];
      const tableLinks: LinkRef[] = [];
      for (const row of el.table.tableRows || []) {
        const cells: string[] = [];
        for (const cell of row.tableCells || []) {
          const cellTexts: string[] = [];
          for (const cellContent of cell.content || []) {
            if (cellContent.paragraph) {
              const pText = extractParagraphText(cellContent.paragraph);
              if (pText) cellTexts.push(pText);
              tableLinks.push(...extractParagraphLinks(cellContent.paragraph));
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
          ...withLinks(tableLinks),
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
