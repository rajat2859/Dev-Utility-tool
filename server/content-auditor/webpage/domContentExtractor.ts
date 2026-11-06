import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type {
  NormalizedDocument,
  NormalizedElement,
  HeadingTag,
  LinkRef,
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
  | { kind: 'text'; text: string; sourceTag: string; links?: LinkRef[] };

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

// <br> marks a line break; paragraphs split on it, everywhere else it is just whitespace
const LINE_BREAK = ' ';
const splitLines = (text: string) => text.split(LINE_BREAK).map(normalizeText).filter(Boolean);

function separateBlockLevelText($: cheerio.CheerioAPI): void {
  $('br').replaceWith(LINE_BREAK);
  $('p, li, ul, ol, div, tr, td, th, h1, h2, h3, h4, h5, h6').append(' ');
}

function containsNonInlineElement($: cheerio.CheerioAPI, node: AnyNode): boolean {
  return $(node)
    .find('*')
    .toArray()
    .some((descendant) => 'name' in descendant && !INLINE_TAGS.has(descendant.name));
}

// Links in document order with their visible text. One link split over several formatting runs
// (<a>best </a><b><a>shoes</a></b>, as Google's export writes it) is joined back into one; a block
// boundary (li, p, td, …) always ends a link so neighbouring list items never merge.
export function collectLinks($: cheerio.CheerioAPI, nodes: AnyNode[]): LinkRef[] {
  const segments: Array<{ text: string; href?: string } | 'break'> = [];
  const walk = (node: AnyNode, href?: string) => {
    if (node.type === 'text') {
      segments.push({ text: node.data, href });
      return;
    }
    if (!('name' in node)) return;
    const ownHref = node.name === 'a' ? $(node).attr('href')?.trim() : undefined;
    const isBlock = !INLINE_TAGS.has(node.name);
    if (isBlock) segments.push('break');
    for (const child of 'children' in node ? node.children : []) walk(child, ownHref || href);
    if (isBlock) segments.push('break');
  };
  nodes.forEach((node) => walk(node));

  const links: LinkRef[] = [];
  let current: LinkRef | null = null;
  let gap = '';
  for (const segment of segments) {
    if (segment === 'break') {
      current = null;
    } else if (segment.href) {
      if (current && current.href === segment.href) {
        current.text += gap + segment.text;
      } else {
        current = { text: segment.text, href: segment.href };
        links.push(current);
      }
      gap = '';
    } else if (current && !segment.text.replace(LINE_BREAK, '').trim()) {
      gap += segment.text;
    } else {
      current = null;
      gap = '';
    }
  }
  return links
    .map((link) => ({ text: normalizeText(link.text.split(LINE_BREAK).join(' ')), href: link.href }))
    .filter((link) => link.text && link.href);
}

// A block split on <br> into several lines keeps each link on the line that shows its text
function linksForLine(links: LinkRef[], lines: string[], lineIndex: number): LinkRef[] | undefined {
  const own = links.filter((link) => {
    const home = lines.findIndex((line) => line.includes(link.text));
    return (home === -1 ? 0 : home) === lineIndex;
  });
  return own.length ? own : undefined;
}

function collectContentBlocks(
  $: cheerio.CheerioAPI,
  container: AnyNode,
  blocks: ContentBlock[] = []
): ContentBlock[] {
  const containerTag = 'name' in container ? container.name : 'div';
  let pendingText = '';
  let pendingNodes: AnyNode[] = [];

  const flushPendingText = () => {
    const lines = splitLines(pendingText);
    const links = collectLinks($, pendingNodes);
    lines.forEach((text, i) =>
      blocks.push({ kind: 'text', text, sourceTag: containerTag, links: linksForLine(links, lines, i) })
    );
    pendingText = '';
    pendingNodes = [];
  };

  for (const child of 'children' in container ? container.children : []) {
    if (child.type === 'text') {
      pendingText += child.data;
      pendingNodes.push(child);
      continue;
    }
    if (!('name' in child)) continue;

    if (STRUCTURED_TAGS.has(child.name)) {
      flushPendingText();
      blocks.push({ kind: 'structured', node: child });
    } else if (INLINE_TAGS.has(child.name) && !containsNonInlineElement($, child)) {
      pendingText += $(child).text();
      pendingNodes.push(child);
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
        ...(block.links && { links: block.links }),
      });
      return;
    }

    const $el = $(block.node);
    const tagName = block.node.name;
    const blockLinks = collectLinks($, [block.node]);
    const links = blockLinks.length ? { links: blockLinks } : {};

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
        ...links,
      });
      return;
    }

    if (tagName === 'p') {
      const lines = splitLines($el.text());
      lines.forEach((text, i) => {
        elementIndex++;
        const lineLinks = linksForLine(blockLinks, lines, i);
        elements.push({ id: `web-el-${elementIndex}`, type: 'paragraph', tag: 'p', text, ...(lineLinks && { links: lineLinks }) });
      });
      return;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      // Nested lists flatten into one item sequence, matching how a Google Doc list reads
      const items: string[] = [];
      const collectItems = ($list: cheerio.Cheerio<any>) =>
        $list.children('li').each((_, li) => {
          const $li = $(li);
          const itemText = normalizeText($li.clone().find('ul, ol').remove().end().text());
          if (itemText) items.push(itemText);
          $li
            .find('ul, ol')
            .filter((_, sub) => $(sub).parentsUntil(li, 'ul, ol').length === 0)
            .each((_, sub) => {
              collectItems($(sub));
            });
        });
      collectItems($el);
      if (items.length === 0) return;

      elementIndex++;
      elements.push({
        id: `web-el-${elementIndex}`,
        type: 'list',
        tag: tagName,
        items,
        text: items.join(' • '),
        ...links,
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
      ...links,
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
