import * as cheerio from 'cheerio';
import type {
  NormalizedDocument,
  NormalizedElement,
  SemanticTag,
  HeadingTag,
} from '../types/normalized';
import { normalizeText } from '../utils/textNormalizer';

/**
 * Strips script, style, navigation, footer, and interactive chrome elements.
 */
function cleanDom($: cheerio.CheerioAPI): void {
  $(
    [
      'script',
      'style',
      'noscript',
      'svg',
      'nav',
      'header',
      'footer',
      'aside',
      'iframe',
      'form',
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

/**
 * Extracts semantic content from a webpage HTML string, starting strictly from the first <h1>.
 *
 * Requirements:
 * - Scans from first <h1> element.
 * - Discards headers, navigation, footers, scripts, and chrome elements.
 * - Extracts headings (h1..h6), paragraphs (p), lists (ul, ol), and tables (table).
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

  cleanDom($);

  // Determine root container to scan
  let $scope: cheerio.Cheerio<any> = $('body');
  if (options?.selector) {
    const $custom = $(options.selector);
    if ($custom.length > 0) {
      $scope = $custom;
    }
  } else {
    const $main = $('main, [role="main"], article, #content, .main-content');
    if ($main.length > 0) {
      $scope = $main.first();
    }
  }

  // Find candidate semantic elements in document order
  const $candidates = $scope.find('h1, h2, h3, h4, h5, h6, p, ul, ol, table');

  // Locate the index of the first <h1>
  let firstH1Index = -1;
  $candidates.each((idx, el) => {
    if (el.tagName.toLowerCase() === 'h1' && normalizeText($(el).text()).length > 0) {
      if (firstH1Index === -1) {
        firstH1Index = idx;
      }
    }
  });

  // If no <h1> found inside $scope, try searching entire body for <h1>
  if (firstH1Index === -1 && $scope !== $('body')) {
    $scope = $('body');
    const $allCandidates = $scope.find('h1, h2, h3, h4, h5, h6, p, ul, ol, table');
    $allCandidates.each((idx, el) => {
      if (el.tagName.toLowerCase() === 'h1' && normalizeText($(el).text()).length > 0) {
        if (firstH1Index === -1) {
          firstH1Index = idx;
        }
      }
    });
  }

  const elements: NormalizedElement[] = [];
  let elementIndex = 0;

  // If no <h1> was found at all on the website, start from index 0 so comparator
  // can highlight that H1 is missing. Otherwise, start from firstH1Index.
  const startIndex = firstH1Index >= 0 ? firstH1Index : 0;
  const elementsToProcess = $scope.find('h1, h2, h3, h4, h5, h6, p, ul, ol, table');

  elementsToProcess.each((idx, el) => {
    if (idx < startIndex) return;

    const $el = $(el);
    const tagName = el.tagName.toLowerCase();

    // Check headings (h1..h6)
    if (/^h[1-6]$/.test(tagName)) {
      const rawText = normalizeText($el.text());
      const cleanText = rawText
        .replace(/^(?:<[hH][1-6]>|\[[hH][1-6]\]|[hH][1-6][:—–-])\s*/, '')
        .trim();
      const text = cleanText || rawText;
      if (!text) return;

      elementIndex++;
      const level = parseInt(tagName[1], 10);
      elements.push({
        id: `web-el-${elementIndex}`,
        type: 'heading',
        tag: tagName as HeadingTag,
        level,
        text,
      });
      return;
    }

    // Check paragraphs (p)
    // Avoid double counting paragraphs nested within lists or table cells
    if (tagName === 'p') {
      if ($el.parents('ul, ol, table').length > 0) return;
      const text = normalizeText($el.text());
      if (!text) return;

      elementIndex++;
      elements.push({
        id: `web-el-${elementIndex}`,
        type: 'paragraph',
        tag: 'p',
        text,
      });
      return;
    }

    // Check lists (ul, ol)
    if (tagName === 'ul' || tagName === 'ol') {
      // Avoid nested child lists duplicate processing
      if ($el.parents('ul, ol, table').length > 0) return;

      const items: string[] = [];
      $el.children('li').each((_, li) => {
        const itemText = normalizeText($(li).text());
        if (itemText) items.push(itemText);
      });

      if (items.length > 0) {
        elementIndex++;
        elements.push({
          id: `web-el-${elementIndex}`,
          type: 'list',
          tag: tagName as 'ul' | 'ol',
          items,
          text: items.join(' • '),
        });
      }
      return;
    }

    // Check tables (table)
    if (tagName === 'table') {
      if ($el.parents('table').length > 0) return;

      const rows: string[][] = [];
      $el.find('tr').each((_, tr) => {
        const cells: string[] = [];
        $(tr)
          .find('th, td')
          .each((_, cell) => {
            const cellText = normalizeText($(cell).text());
            cells.push(cellText);
          });
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      });

      if (rows.length > 0) {
        elementIndex++;
        elements.push({
          id: `web-el-${elementIndex}`,
          type: 'table',
          tag: 'table',
          rows,
          text: rows.map((r) => r.join(' | ')).join('\n'),
        });
      }
      return;
    }
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
