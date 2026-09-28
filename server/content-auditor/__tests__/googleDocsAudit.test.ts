import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { docs_v1 } from 'googleapis';
import {
  extractGoogleDocId,
  parseGoogleDoc,
} from '../reference/googleDocsParser';
import { extractWebsiteSemanticTree } from '../webpage/domContentExtractor';
import { compareNormalizedTrees } from '../comparison/deterministicComparator';
import type { NormalizedDocument } from '../types/normalized';

describe('Google Doc URL Extractor', () => {
  test('extracts document ID from standard edit URLs', () => {
    const url =
      'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    assert.equal(
      extractGoogleDocId(url),
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
  });

  test('extracts document ID from preview and user-scoped URLs', () => {
    const url =
      'https://docs.google.com/document/u/0/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview?usp=sharing';
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

    // Should have captured metadata from preamble
    assert.equal(parsed.metadata?.url, 'https://example.com');
    assert.equal(parsed.metadata?.title, 'Professional Services');

    // Content elements must start from first H1
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

  test('correctly maps headings, paragraphs, bullet lists, and tables', () => {
    const mockDoc: docs_v1.Schema$Document = {
      title: 'Feature Specs',
      lists: {
        list_1: {
          listProperties: {
            nestingLevels: [{ glyphType: 'GLYPH_TYPE_UNSPECIFIED' }],
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
          // List item 1
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              bullet: { listId: 'list_1', nestingLevel: 0 },
              elements: [{ textRun: { content: 'High Speed\n' } }],
            },
          },
          // List item 2
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              bullet: { listId: 'list_1', nestingLevel: 0 },
              elements: [{ textRun: { content: '24/7 Support\n' } }],
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
                            elements: [{ textRun: { content: 'Starter\n' } }],
                          },
                        },
                      ],
                    },
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [{ textRun: { content: '$19/mo\n' } }],
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
    assert.equal(parsed.elements.length, 4);

    // H1
    assert.equal(parsed.elements[0].tag, 'h1');
    assert.equal(parsed.elements[0].text, 'Main Title');

    // H2
    assert.equal(parsed.elements[1].tag, 'h2');
    assert.equal(parsed.elements[1].text, 'Our Highlights');

    // List grouped
    assert.equal(parsed.elements[2].type, 'list');
    assert.equal(parsed.elements[2].tag, 'ul');
    if (parsed.elements[2].type === 'list') {
      assert.deepEqual(parsed.elements[2].items, ['High Speed', '24/7 Support']);
    }

    // Table
    assert.equal(parsed.elements[3].type, 'table');
    if (parsed.elements[3].type === 'table') {
      assert.deepEqual(parsed.elements[3].rows, [
        ['Plan', 'Price'],
        ['Starter', '$19/mo'],
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
            <p>Fast, reliable cloud hosting built for developers.</p>
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
        { id: '1', type: 'heading', tag: 'h2', level: 2, text: 'Features Overview' },
      ],
    };
    const webDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h3', level: 3, text: 'Features Overview' },
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
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Our Pricing' },
        { id: '2', type: 'paragraph', tag: 'p', text: 'Plans start at $29/mo.' },
      ],
    };
    const webDoc: NormalizedDocument = {
      elements: [
        { id: '1', type: 'heading', tag: 'h1', level: 1, text: 'Our Pricing' },
        { id: '2', type: 'paragraph', tag: 'p', text: 'Plans start at $49/mo.' },
      ],
    };

    const report = compareNormalizedTrees(refDoc, webDoc);
    assert.equal(report.summary.status, 'FAIL');
    assert.equal(report.summary.passed, 1);
    assert.equal(report.summary.contentMismatch, 1);
    assert.equal(report.results[1].status, 'CONTENT_MISMATCH');
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
    assert.match(report.results[1].message, /was not found on the webpage/);
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
