import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

const COMMON_CONTENT_SELECTORS = [
  'main',
  '[role="main"]',
  'article',
  '.entry-content',
  '.post-content',
  '.article-content',
  '#content',
  '.content',
  '.main-content',
  '#main-content',
  '.page-content',
];

const CHROME_SELECTORS = [
  'header',
  'nav',
  'footer',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '.navbar',
  '.header',
  '.footer',
  '.sidebar',
  '.cookie-banner',
  '.cookie-consent',
  '.nav-menu',
  '.comments',
  '#comments',
  '.related-posts',
  '#related-posts',
  '.advertisement',
  '.ad-banner',
];

export interface MainContentResult {
  $scope: Cheerio<AnyNode>;
  selectorUsed: string;
  isManual: boolean;
}

/**
 * Resolves the primary content container from an HTML document.
 * If manualSelector is specified, validates and scopes to it strictly (or throws).
 * Otherwise applies hierarchy: <main> -> [role=main] -> <article> -> common selectors -> body.
 * Strips unwanted chrome (navbars, footers, cookie banners) from within the scope.
 */
export function resolveMainContent(
  $: CheerioAPI,
  manualSelector?: string
): MainContentResult {
  if (manualSelector && manualSelector.trim()) {
    const trimmed = manualSelector.trim();
    let matches: Cheerio<AnyNode>;
    try {
      matches = $(trimmed);
    } catch (err: any) {
      throw new Error(`Invalid manual content selector "${trimmed}": ${err.message || err}`);
    }

    if (matches.length === 0) {
      throw new Error(`Manual content selector "${trimmed}" matched no elements on the page.`);
    }

    // Strip chrome within manual container
    CHROME_SELECTORS.forEach((sel) => {
      matches.find(sel).remove();
    });

    return {
      $scope: matches.first(),
      selectorUsed: trimmed,
      isManual: true,
    };
  }

  // Auto-detection hierarchy
  for (const selector of COMMON_CONTENT_SELECTORS) {
    const matched = $(selector);
    if (matched.length > 0) {
      // Pick first matched container with meaningful text
      for (let i = 0; i < matched.length; i++) {
        const el = matched.eq(i);
        const text = el.text().trim();
        if (text.length > 50) {
          // Remove internal chrome (e.g. sidebars or footers inside main)
          CHROME_SELECTORS.forEach((sel) => {
            el.find(sel).remove();
          });
          return {
            $scope: el,
            selectorUsed: selector,
            isManual: false,
          };
        }
      }
    }
  }

  // Fallback to <body> after stripping global chrome elements
  const body = $('body');
  if (body.length > 0) {
    const clonedBody = body.clone();
    CHROME_SELECTORS.forEach((sel) => {
      clonedBody.find(sel).remove();
    });
    return {
      $scope: clonedBody,
      selectorUsed: 'body',
      isManual: false,
    };
  }

  // Root fallback
  return {
    $scope: $.root(),
    selectorUsed: 'html',
    isManual: false,
  };
}
