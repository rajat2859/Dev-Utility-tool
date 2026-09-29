import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type {
  NormalizedDocument,
  NormalizedElement,
  HeadingTag,
} from '../types/normalized';
import { normalizeText } from '../utils/textNormalizer';

const DEFAULT_CONTENT_ROOT_SELECTOR = 'main, [role="main"], article, #content, .main-content';

const STRUCTURED_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'table']);

const INLINE_TAGS = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'cite', 'code', 'data', 'del', 'dfn', 'em',
  'font', 'i', 'ins', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strike',
  'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var', 'wbr',
  'img', 'picture', 'source', 'video', 'audio', 'canvas', 'input',
]);

type ContentBlock =
  | { kind: 'structured'; node: AnyNode & { name: string } }
  | { kind: 'text'; text: string; sourceTag: string };

/**
 * Strips script, style, navigation, footer, and interactive chrome elements.
 */
function cleanDom($: cheerio.CheerioAPI, contentRootSelector: string): void {
  $('header, aside, form')
    .filter((_, element) => $(element).closest(contentRootSelector).length === 0)
    .remove();

  $(
    [
      'script',
      'style',
      'noscript',
      'svg',
      'nav',
      'footer',
      'iframe',
      'select',
      'textarea',
      'datalist',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.cookie-banner',
      '#cookie-banner',
      '.cookie-consent',
      '.cookie-notice',
      '.modal',
      '.popup',
      '.sidebar',
    ].join(', ')
  ).remove();
}

function separateBlockLevelText($: cheerio.CheerioAPI): void {
  $('br').replaceWith(' ');
  $('p, li, ul, ol, div, tr, td, th, h1, h2, h3, h4, h5, h6').append(' ');
}

function containsNonInlineElement($: cheerio.CheerioAPI, node: AnyNode): boolean {
  return $(node)
    .find('*')
    .toArray()
    .some((descendant) => 'name' in descendant && !INLINE_TAGS.has(descendant.name));
}

/**
 * Walks the content area in document order and returns headings, paragraphs, lists and tables
 * as-is, plus every other block of text (div, button, summary, ...) regardless of the
 * framework or class names used. Text sitting between block siblings becomes its own block.
 */
function collectContentBlocks(
  $: cheerio.CheerioAPI,
  container: AnyNode,
  blocks: ContentBlock[] = []
): ContentBlock[] {
  const containerTag = 'name' in container ? container.name : 'div';
  let pendingText = '';

  const flushPendingText = () => {
    const text = normalizeText(pendingText);
    if (text) blocks.push({ kind: 'text', text, sourceTag: containerTag });
    pendingText = '';
  };

  for (const child of 'children' in container ? container.children : []) {
    if (child.type === 'text') {
      pendingText += child.data;
      continue;
    }
    if (!('name' in child)) continue;

    if (STRUCTURED_TAGS.has(child.name)) {
      flushPendingText();
      blocks.push({ kind: 'structured', node: child });
    } else if (INLINE_TAGS.has(child.name) && !containsNonInlineElement($, child)) {
      pendingText += $(child).text();
    } else {
      flushPendingText();
      collectContentBlocks($, child, blocks);
    }
  }

  flushPendingText();
  return blocks;
}

function findFirstH1BlockIndex($: cheerio.CheerioAPI, blocks: ContentBlock[]): number {
  return blocks.findIndex(
    (block) =>
      block.kind === 'structured' &&
      block.node.name === 'h1' &&
      normalizeText($(block.node).text()).length > 0
  );
}

/**
 * Extracts semantic content from a webpage HTML string, starting strictly from the first <h1>.
 *
 * Requirements:
 * - Scans from first <h1> element.
 * - Discards headers, navigation, footers, scripts, and chrome elements.
 * - Extracts headings (h1..h6), paragraphs (p), lists (ul, ol), tables (table), and any other
 *   block of text (div, button, summary, ...) as a paragraph carrying its original `sourceTag`.
 * - Produces the identical NormalizedDocument tree as parseGoogleDoc.
 */
export function extractWebsiteSemanticTree(
  html: string,
  options?: { selector?: string }
): NormalizedDocument {
  const $ = cheerio.load(html);

  // Extract page title & meta description
  const metaTitle = normalizeText($('title').text() || '');
  const metaDescription = normalizeText(
    $('meta[name="description" i]').attr('content') ||
      $('meta[property="og:description" i]').attr('content') ||
      ''
  );

  const contentRootSelector = options?.selector || DEFAULT_CONTENT_ROOT_SELECTOR;
  cleanDom($, contentRootSelector);
  separateBlockLevelText($);

  // Determine root container to scan
  let $scope: cheerio.Cheerio<any> = $('body');
  if (options?.selector) {
    const $custom = $(options.selector);
    if ($custom.length > 0) {
      $scope = $custom;
    }
  } else {
    const $main = $(DEFAULT_CONTENT_ROOT_SELECTOR);
    if ($main.length > 0) {
      $scope = $main.first();
    }
  }

  let blocks = collectContentBlocks($, $scope.get(0)!);
  let firstH1Index = findFirstH1BlockIndex($, blocks);

  if (firstH1Index === -1 && !$scope.is('body')) {
    $scope = $('body');
    blocks = collectContentBlocks($, $scope.get(0)!);
    firstH1Index = findFirstH1BlockIndex($, blocks);
  }

  const elements: NormalizedElement[] = [];
  let elementIndex = 0;

  // If no <h1> was found at all on the website, start from index 0 so comparator
  // can highlight that H1 is missing. Otherwise, start from firstH1Index.
  const startIndex = firstH1Index >= 0 ? firstH1Index : 0;

  blocks.slice(startIndex).forEach((block) => {
    if (block.kind === 'text') {
      elementIndex++;
      elements.push({
        id: `web-el-${elementIndex}`,
        type: 'paragraph',
        tag: 'p',
        text: block.text,
        sourceTag: block.sourceTag,
      });
      return;
    }

    const $el = $(block.node);
    const tagName = block.node.name;

    if (/^h[1-6]$/.test(tagName)) {
      const rawText = normalizeText($el.text());
      const cleanText = rawText
        .replace(/^(?:<[hH][1-6]>|\[[hH][1-6]\]|[hH][1-6][:—–-])\s*/, '')
        .trim();
      const text = cleanText || rawText;
      if (!text) return;

      elementIndex++;
      elements.push({
        id: `web-el-${elementIndex}`,
        type: 'heading',
        tag: tagName as HeadingTag,
        level: parseInt(tagName[1], 10),
        text,
      });
      return;
    }

    if (tagName === 'p') {
      const text = normalizeText($el.text());
      if (!text) return;

      elementIndex++;
      elements.push({ id: `web-el-${elementIndex}`, type: 'paragraph', tag: 'p', text });
      return;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      const items: string[] = [];
      $el.children('li').each((_, li) => {
        const itemText = normalizeText($(li).text());
        if (itemText) items.push(itemText);
      });
      if (items.length === 0) return;

      elementIndex++;
      elements.push({
        id: `web-el-${elementIndex}`,
        type: 'list',
        tag: tagName,
        items,
        text: items.join(' • '),
      });
      return;
    }

    const rows: string[][] = [];
    $el.find('tr').each((_, tr) => {
      const cells: string[] = [];
      $(tr)
        .find('th, td')
        .each((_, cell) => {
          cells.push(normalizeText($(cell).text()));
        });
      if (cells.some((cellText) => cellText.length > 0)) {
        rows.push(cells);
      }
    });
    if (rows.length === 0) return;

    elementIndex++;
    elements.push({
      id: `web-el-${elementIndex}`,
      type: 'table',
      tag: 'table',
      rows,
      text: rows.map((row) => row.join(' | ')).join('\n'),
    });
  });

  return {
    title: metaTitle,
    elements,
    metadata: {
      title: metaTitle,
      description: metaDescription,
    },
  };
}
