import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { docs_v1 } from 'googleapis';
import { extractGoogleDocId } from '../google/GoogleDocUrl';
import { parseGoogleDoc } from '../google/GoogleDocParser';
import { fetchPublicGoogleDoc } from '../google/GoogleDocsService';
import { normalizeText, areTextsMatching } from '../utils/textNormalizer';
import { extractWebsiteSemanticTree } from '../webpage/domContentExtractor';
import {
  compareNormalizedTrees,
  compareListDetails,
  compareTableDetails,
} from '../comparison/deterministicComparator';
import { computeWordDiff } from '../comparison/diff';
import type { NormalizedDocument } from '../types/normalized';

describe('Shared Text Normalizer', () => {
  test('collapses multiple spaces, tabs, and line breaks into single space', () => {
    assert.equal(
      normalizeText('Our     Services \t\n  Overview'),
      'Our Services Overview'
    );
  });

  test('normalizes non-breaking spaces and unicode spaces', () => {
    assert.equal(
      normalizeText('Hello\u00A0World\u202Ffrom\u3000Earth'),
      'Hello World from Earth'
    );
  });

  test('removes zero-width characters', () => {
    assert.equal(
      normalizeText('Sec\u200Bure\uFEFF Content\u200D'),
      'Secure Content'
    );
  });

  test('decodes standard HTML entities', () => {
    assert.equal(
      normalizeText('Tom &amp; Jerry &quot;Show&quot; &#39;Special&#39; &lt;Classic&gt;'),
      `Tom & Jerry "Show" 'Special' <Classic>`
    );
  });

  test('normalizes smart quotes and em/en dashes', () => {
    assert.equal(
      normalizeText('“Modern” ‘Websites’ – High—Performance'),
      `"Modern" 'Websites' - High-Performance`
    );
  });

  test('areTextsMatching strictly checks normalized equality without fuzzy guesses', () => {
    assert.equal(areTextsMatching('Our   Services', 'Our Services'), true);
    assert.equal(areTextsMatching('Our Services', 'Services We Provide'), false);
  });
});

describe('Google Doc URL Extractor', () => {
  test('extracts document ID from standard edit URLs', () => {
    const url =
      'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    assert.equal(
      extractGoogleDocId(url),
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
  });

  test('extracts document ID from preview and user-scoped URLs with query params', () => {
    const url =
      'https://docs.google.com/document/u/0/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview?usp=sharing&tab=t.0';
    assert.equal(
      extractGoogleDocId(url),
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
  });

  test('extracts document ID when URL has trailing parameters or hash', () => {
    const url =
      'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#heading=h.abc123';
    assert.equal(
      extractGoogleDocId(url),
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
  });

  test('accepts plain raw document ID string', () => {
    const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    assert.equal(extractGoogleDocId(rawId), rawId);
  });

  test('rejects Google Sheets and Google Slides URLs', () => {
    assert.throws(
      () =>
        extractGoogleDocId(
          'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
        ),
      /Google Sheets/
    );
    assert.throws(
      () =>
        extractGoogleDocId(
          'https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
        ),
      /Google Slides/
    );
  });

  test('rejects malformed or empty inputs', () => {
    assert.throws(() => extractGoogleDocId(''), /valid Google Doc URL/);
    assert.throws(
      () => extractGoogleDocId('https://example.com/not-a-doc'),
      /Invalid Google Doc URL/
    );
  });
});

describe('Google Docs Service (Public Docs + API Key)', () => {
  test('throws descriptive error when GOOGLE_API_KEY is not set', async () => {
    const originalKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      await assert.rejects(
        () => fetchPublicGoogleDoc('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'),
        /Google API key is not configured/
      );
    } finally {
      if (originalKey) process.env.GOOGLE_API_KEY = originalKey;
    }
  });
});

describe('Google Doc AST Parser (Mocked API JSON)', () => {
  test('discards pre-H1 content and starts strictly from first HEADING_1', () => {
    const mockDoc: docs_v1.Schema$Document = {
      title: 'Client Wireframe Doc',
      body: {
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [{ textRun: { content: 'URL: https://example.com\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [
                { textRun: { content: 'Meta Title: Professional Services\n' } },
              ],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [
                {
                  textRun: {
                    content: 'INTERNAL NOTE: Do not deploy before approval.\n',
                  },
                },
              ],
            },
          },
          // FIRST HEADING 1
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'HEADING_1' },
              elements: [{ textRun: { content: 'Welcome to Cloud Hosting\n' } }],
            },
          },
          // Subsequent body content
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [
                {
                  textRun: {
                    content: 'We provide ultra-reliable managed cloud servers.\n',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const parsed = parseGoogleDoc(mockDoc);

    // Metadata from preamble is captured
    assert.equal(parsed.metadata?.url, 'https://example.com');
    assert.equal(parsed.metadata?.title, 'Professional Services');

    // Body content strictly begins at first H1
    assert.equal(parsed.elements.length, 2);
    assert.equal(parsed.elements[0].type, 'heading');
    assert.equal(parsed.elements[0].tag, 'h1');
    assert.equal(parsed.elements[0].text, 'Welcome to Cloud Hosting');

    assert.equal(parsed.elements[1].type, 'paragraph');
    assert.equal(parsed.elements[1].tag, 'p');
    assert.equal(
      parsed.elements[1].text,
      'We provide ultra-reliable managed cloud servers.'
    );
  });

  test('throws error if no HEADING_1 is present in the document', () => {
    const mockDocWithoutH1: docs_v1.Schema$Document = {
      title: 'Doc Without Any Heading',
      body: {
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [{ textRun: { content: 'Just some text here.\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'HEADING_2' },
              elements: [{ textRun: { content: 'Subheading only\n' } }],
            },
          },
        ],
      },
    };

    assert.throws(
      () => parseGoogleDoc(mockDocWithoutH1),
      /No Heading 1 was found in the Google Doc\./
    );
  });

  test('combines multiple text runs into clean single paragraph string', () => {
    const mockDoc: docs_v1.Schema$Document = {
      title: 'Multi-run Doc',
      body: {
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'HEADING_1' },
              elements: [{ textRun: { content: 'Title\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [
                { textRun: { content: 'We build ' } },
                { textRun: { content: 'modern websites' } },
                { textRun: { content: ' for businesses.\n' } },
              ],
            },
          },
        ],
      },
    };

    const parsed = parseGoogleDoc(mockDoc);
    assert.equal(parsed.elements.length, 2);
    assert.equal(
      parsed.elements[1].text,
      'We build modern websites for businesses.'
    );
  });

  test('correctly maps headings (H1..H3), bulleted and numbered lists, and tables', () => {
    const mockDoc: docs_v1.Schema$Document = {
      title: 'Feature Specs',
      lists: {
        list_ul: {
          listProperties: {
            nestingLevels: [{ glyphType: 'GLYPH_TYPE_UNSPECIFIED' }],
          },
        },
        list_ol: {
          listProperties: {
            nestingLevels: [{ glyphType: 'DECIMAL' }],
          },
        },
      },
      body: {
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'HEADING_1' },
              elements: [{ textRun: { content: 'Main Title\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'HEADING_2' },
              elements: [{ textRun: { content: 'Our Highlights\n' } }],
            },
          },
          // UL items
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              bullet: { listId: 'list_ul', nestingLevel: 0 },
              elements: [{ textRun: { content: 'Web Development\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              bullet: { listId: 'list_ul', nestingLevel: 0 },
              elements: [{ textRun: { content: 'SEO\n' } }],
            },
          },
          // OL items
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              bullet: { listId: 'list_ol', nestingLevel: 0 },
              elements: [{ textRun: { content: 'Step One\n' } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              bullet: { listId: 'list_ol', nestingLevel: 0 },
              elements: [{ textRun: { content: 'Step Two\n' } }],
            },
          },
          // Table
          {
            table: {
              tableRows: [
                {
                  tableCells: [
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [{ textRun: { content: 'Plan\n' } }],
                          },
                        },
                      ],
                    },
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [{ textRun: { content: 'Price\n' } }],
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  tableCells: [
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [{ textRun: { content: 'Basic\n' } }],
                          },
                        },
                      ],
                    },
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [{ textRun: { content: '₹999\n' } }],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    const parsed = parseGoogleDoc(mockDoc);
    assert.equal(parsed.elements.length, 5);

    // H1
    assert.equal(parsed.elements[0].tag, 'h1');
    assert.equal(parsed.elements[0].text, 'Main Title');

    // H2
    assert.equal(parsed.elements[1].tag, 'h2');
    assert.equal(parsed.elements[1].text, 'Our Highlights');

    // UL
    assert.equal(parsed.elements[2].type, 'list');
    assert.equal(parsed.elements[2].tag, 'ul');
    if (parsed.elements[2].type === 'list') {
      assert.deepEqual(parsed.elements[2].items, ['Web Development', 'SEO']);
    }

    // OL
    assert.equal(parsed.elements[3].type, 'list');
    assert.equal(parsed.elements[3].tag, 'ol');
    if (parsed.elements[3].type === 'list') {
      assert.deepEqual(parsed.elements[3].items, ['Step One', 'Step Two']);
    }

    // Table
    assert.equal(parsed.elements[4].type, 'table');
    if (parsed.elements[4].type === 'table') {
      assert.deepEqual(parsed.elements[4].rows, [
        ['Plan', 'Price'],
        ['Basic', '₹999'],
      ]);
    }
  });
});

describe('Website DOM Semantic Extractor', () => {
  test('extracts content starting from first H1 and ignores chrome', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <header><nav><a href="/">Home</a></nav></header>
          <div class="cookie-banner">Please accept cookies.</div>
          <main>
            <h1>Awesome Cloud Solutions</h1>
            <p>Fast, reliable cloud hosting built for <strong>developers</strong>.</p>
            <h2>Features</h2>
            <ul>
              <li>99.99% Uptime</li>
              <li>Global CDN</li>
            </ul>
          </main>
          <footer>Footer content here</footer>
        </body>
      </html>
    `;

    const tree = extractWebsiteSemanticTree(html);
    assert.equal(tree.title, 'Test Page');
    assert.equal(tree.elements.length, 4);

    assert.equal(tree.elements[0].tag, 'h1');
    assert.equal(tree.elements[0].text, 'Awesome Cloud Solutions');

    // strong inside p should be collapsed into single text string
    assert.equal(tree.elements[1].tag, 'p');
    assert.equal(
      tree.elements[1].text,
      'Fast, reliable cloud hosting built for developers.'
    );

    assert.equal(tree.elements[2].tag, 'h2');
    assert.equal(tree.elements[2].text, 'Features');

    assert.equal(tree.elements[3].type, 'list');
    if (tree.elements[3].type === 'list') {
      assert.deepEqual(tree.elements[3].items, ['99.99% Uptime', 'Global CDN']);
    }
  });
});

describe('Deterministic Comparator', () => {
  test('returns PASS for matching tag and content', () => {
    const refDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Heading One' },
        { id: '2', type: 'paragraph', tag: 'p', text: 'Paragraph One' },
      ],
    };
    const webDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Heading One' },
        { id: '2', type: 'paragraph', tag: 'p', text: 'Paragraph One' },
      ],
    };

    const report = compareNormalizedTrees(refDoc, webDoc);
    assert.equal(report.summary.status, 'PASS');
    assert.equal(report.summary.passed, 2);
    assert.equal(report.summary.wrongTag, 0);
    assert.equal(report.summary.contentMismatch, 0);
    assert.equal(report.summary.missing, 0);
    assert.equal(report.results[0].status, 'PASS');
    assert.equal(report.results[1].status, 'PASS');
  });

  test('returns WRONG_TAG when text matches but semantic tag differs', () => {
    const refDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h2', level: 2, text: 'Our Services' },
      ],
    };
    const webDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h3', level: 3, text: 'Our Services' },
      ],
    };

    const report = compareNormalizedTrees(refDoc, webDoc);
    assert.equal(report.summary.status, 'PASS_WITH_WARNINGS');
    assert.equal(report.summary.wrongTag, 1);
    assert.equal(report.results[0].status, 'WRONG_TAG');
    assert.match(report.results[0].message, /instead of expected <h2\>/);
  });

  test('returns CONTENT_MISMATCH when element position/tag matches but text differs', () => {
    const refDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'paragraph', tag: 'p', text: 'We build modern websites.' },
      ],
    };
    const webDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'paragraph', tag: 'p', text: 'We design modern websites.' },
      ],
    };

    const report = compareNormalizedTrees(refDoc, webDoc);
    assert.equal(report.summary.status, 'FAIL');
    assert.equal(report.summary.contentMismatch, 1);
    assert.equal(report.results[0].status, 'CONTENT_MISMATCH');
  });

  test('returns MISSING when reference item was not found on website', () => {
    const refDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Welcome' },
        { id: '2', type: 'paragraph', tag: 'p', text: 'Special Promotional Notice' },
        { id: '3', type: 'heading', tag: 'h2', level: 2, text: 'Contact Us' },
      ],
    };
    const webDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Welcome' },
        { id: '2', type: 'heading', tag: 'h2', level: 2, text: 'Contact Us' },
      ],
    };

    const report = compareNormalizedTrees(refDoc, webDoc);
    assert.equal(report.summary.status, 'FAIL');
    assert.equal(report.summary.passed, 2);
    assert.equal(report.summary.missing, 1);
    assert.equal(report.results[1].status, 'MISSING');
  });

  test('compares lists with specific missing item reporting', () => {
    const listComp = compareListDetails(
      ['Web Development', 'SEO Services'],
      ['Web Development']
    );
    assert.equal(listComp.matches, false);
    assert.match(listComp.detail, /Missing list item: "SEO Services"/);

    const matchComp = compareListDetails(['A', 'B'], ['A', 'B']);
    assert.equal(matchComp.matches, true);
  });

  test('compares tables with specific row and cell reporting', () => {
    const tableComp = compareTableDetails(
      [
        ['Plan', 'Price'],
        ['Basic', '₹999'],
      ],
      [
        ['Plan', 'Price'],
        ['Basic', '₹1,299'],
      ]
    );
    assert.equal(tableComp.matches, false);
    assert.match(tableComp.detail, /Row 2, Cell 2/);
    assert.match(tableComp.detail, /Expected: "₹999", Found: "₹1,299"/);
  });

  test('keeps words apart when table cells contain block-level or line-break markup', () => {
    const cellMarkupVariants = [
      'Email<br>Phone',
      '<p>Email</p><p>Phone</p>',
      '<ul><li>Email</li><li>Phone</li></ul>',
    ];

    for (const cellMarkup of cellMarkupVariants) {
      const websiteTree = extractWebsiteSemanticTree(
        `<main><h1>Pricing</h1><table><tr><td>Support</td><td>${cellMarkup}</td></tr></table></main>`
      );
      const table = websiteTree.elements.find((element) => element.type === 'table');
      assert.deepEqual(table?.type === 'table' && table.rows, [['Support', 'Email Phone']], cellMarkup);
    }
  });

  test('keeps header, aside, and form content inside the main content area but drops page chrome outside it', () => {
    const websiteTree = extractWebsiteSemanticTree(
      `<header><p>Site tagline</p></header>
       <aside><p>Site promo</p></aside>
       <main>
         <article>
           <header class="entry-header"><h1>Best Pizza</h1></header>
           <aside><p>Key takeaway text.</p></aside>
           <form><p>Contact us today.</p></form>
         </article>
       </main>`
    );

    assert.deepEqual(
      websiteTree.elements.map((element) => element.text),
      ['Best Pizza', 'Key takeaway text.', 'Contact us today.']
    );
  });

  test('treats text that differs only by capitalization as a content mismatch', () => {
    const referenceTree: NormalizedDocument = {
      elements: [{ id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Our Services' }],
    };
    const websiteTree: NormalizedDocument = {
      elements: [{ id: '1', type: 'heading', tag: 'h1', level: 1, text: 'our services' }],
    };

    assert.equal(compareNormalizedTrees(referenceTree, websiteTree).results[0].status, 'CONTENT_MISMATCH');
  });

  test('word diff reports capitalization-only differences when case sensitivity is requested', () => {
    assert.ok(computeWordDiff('Our Services', 'our services').every((word) => !word.added && !word.removed));

    const caseSensitiveDiff = computeWordDiff('Our Services', 'our services', true);
    assert.deepEqual(
      caseSensitiveDiff.filter((word) => word.removed).map((word) => word.value),
      ['Our', 'Services']
    );
    assert.deepEqual(
      caseSensitiveDiff.filter((word) => word.added).map((word) => word.value),
      ['our', 'services']
    );
  });

  test('tracks extra elements found on website that were not in reference', () => {
    const refDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Welcome' },
      ],
    };
    const webDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Welcome' },
        { id: '2', type: 'paragraph', tag: 'p', text: 'Extra announcement banner' },
      ],
    };

    const report = compareNormalizedTrees(refDoc, webDoc);
    assert.equal(report.summary.passed, 1);
    assert.equal(report.summary.extraOnWebsite, 1);
    assert.equal(report.extraWebsiteElements.length, 1);
    assert.equal(report.extraWebsiteElements[0].text, 'Extra announcement banner');
  });
});
