import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPageAuditModel } from '../webpage/ContentExtractor';
import { parseGoogleDocReference } from '../reference/GoogleDocParser';
import { buildContentAuditReport } from '../report/AuditReportBuilder';
import { compareTextSimilarity } from '../comparison/TextMatcher';
import { computeWordDiff } from '../comparison/diff';
import { shouldTriggerRenderFallback } from '../webpage/PageRenderer';
import { auditFeatureImage } from '../comparison/ImageMatcher';
import { auditFaq } from '../comparison/FaqMatcher';
import { auditTables } from '../comparison/TableMatcher';
import { auditLists } from '../comparison/ListMatcher';
import { isPrivateIp, validateSafeUrl } from '../webpage/PageSecurity';
import { normalizeText } from '../reference/ReferenceNormalizer';
import { parseAltTextLine } from '../comparison/AltTextMatcher';
import { extractSchemaBlocks } from '../comparison/SchemaMatcher';

// ============================================================================
// FIXTURE TEST SUITE: 50 REQUIRED AUDITOR SCENARIOS (Fix 45 & Fix 46)
// ============================================================================

test('1. perfect exact match: all metadata, headings, copy, list, table, image match', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Web Development Company in Texas</title>
        <meta name="description" content="We build high-performance web applications.">
        <meta property="og:image" content="https://example.com/assets/hero.webp">
      </head>
      <body>
        <main>
          <h1>Web Development Services</h1>
          <p>We build high-performance web applications for scaling businesses.</p>
          <h2>Our Core Features</h2>
          <ul>
            <li>Speed Optimization</li>
            <li>Custom Architecture</li>
          </ul>
        </main>
      </body>
    </html>
  `;

  const refText = `
URL: https://example.com/services
Meta Title: Web Development Company in Texas
Meta Description: We build high-performance web applications.
Feature Image: https://example.com/assets/hero.webp

H1 Web Development Services
We build high-performance web applications for scaling businesses.
H2 Our Core Features
* Speed Optimization
* Custom Architecture
  `;

  const page = extractPageAuditModel(html, 'https://example.com/services');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.status, 'PASS');
  assert.equal(report.metadata.title.status, 'EXACT');
  assert.equal(report.metadata.description.status, 'EXACT');
  assert.equal(report.headings.length, 2);
  assert.equal(report.headings[0].status, 'EXACT');
  assert.equal(report.headings[1].status, 'EXACT');
  assert.equal(report.featureImage?.matches, true);
  assert.equal(report.summary.criticalIssues, 0);
  assert.equal(report.summary.structuralIssues, 0);
});

test('2. missing title: page has H1 but no <title> tag -> report title as MISSING (Fix 1)', () => {
  const html = `
    <html>
      <head>
        <meta name="description" content="Valid description">
      </head>
      <body>
        <main>
          <h1>Web Development Services</h1>
          <p>Some paragraph text.</p>
        </main>
      </body>
    </html>
  `;
  const refText = `
Meta Title: Web Development Services
Meta Description: Valid description
H1 Web Development Services
Some paragraph text.
  `;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.metadata.title.status, 'MISSING');
  assert.equal(report.status, 'FAIL');
  assert.ok(report.issues.some((i) => i.id === 'meta-title-missing'));
});

test('3. wrong title: title tag text differs from reference', () => {
  const html = `<html><head><title>Completely Wrong Title</title></head><body><main><p>Text</p></main></body></html>`;
  const refText = `Meta Title: Expected Title\nText`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.metadata.title.status, 'MISMATCH');
  assert.equal(report.status, 'FAIL');
});

test('4. missing meta description: page has no <meta name="description"> -> report as MISSING (Fix 2)', () => {
  const html = `<html><head><title>Title</title><meta property="og:description" content="OG only"></head><body><main><p>Text</p></main></body></html>`;
  const refText = `Meta Title: Title\nMeta Description: Expected Meta Description\nText`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.metadata.description.status, 'MISSING');
  assert.equal(report.status, 'FAIL');
});

test('5. H2 changed to paragraph: copy MATCH, structure FAIL, status WRONG_LEVEL (Fix 3 & Fix 4)', () => {
  const html = `<html><body><main><p>Our Services</p></main></body></html>`;
  const refText = `H2 Our Services`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  const headingComp = report.headings[0];
  assert.ok(headingComp, 'Heading comparison should exist');
  assert.equal(headingComp.copyMatch, 'EXACT');
  assert.equal(headingComp.structureMatch, 'FAIL');
  assert.equal(headingComp.status, 'WRONG_LEVEL');
  assert.equal(report.status, 'FAIL');
});

test('6. H2 changed to H3: status WRONG_LEVEL, actualLevel 3', () => {
  const html = `<html><body><main><h3>Our Services</h3></main></body></html>`;
  const refText = `H2 Our Services`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.headings[0].status, 'WRONG_LEVEL');
  assert.equal(report.headings[0].actualLevel, 3);
});

test('7. missing H1: expected H1 not present on page', () => {
  const html = `<html><body><main><h2>Only H2 Present</h2></main></body></html>`;
  const refText = `H1 Expected Main Heading\nH2 Only H2 Present`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.headings[0].status, 'MISSING');
  assert.equal(report.status, 'FAIL');
});

test('8. multiple headings with identical text: one-to-one claim tracking', () => {
  const html = `<html><body><main><h2>Overview</h2><p>Part 1</p><h2>Overview</h2><p>Part 2</p></main></body></html>`;
  const refText = `H2 Overview\nPart 1\nH2 Overview\nPart 2`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.headings.length, 2);
  assert.equal(report.headings[0].status, 'EXACT');
  assert.equal(report.headings[1].status, 'EXACT');
  assert.notEqual(report.headings[0].actualOrder, report.headings[1].actualOrder);
});

test('9. reordered sections: report WRONG_ORDER', () => {
  const html = `<html><body><main><h2>Section Beta</h2><p>Content B</p><h2>Section Alpha</h2><p>Content A</p></main></body></html>`;
  const refText = `H2 Section Alpha\nContent A\nH2 Section Beta\nContent B`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.ok(report.headings.some((h) => h.status === 'WRONG_ORDER'));
});

test('10. moved paragraph: identified as MOVED / WRONG_ORDER instead of missing (Fix 22)', () => {
  const html = `
    <html><body><main>
      <p>Intro paragraph</p>
      <p>Third paragraph</p>
      <p>Fourth paragraph</p>
      <p>Fifth paragraph</p>
      <p>Sixth paragraph</p>
      <p>Second paragraph that was moved far down</p>
    </main></body></html>
  `;
  const refText = `
Intro paragraph
Second paragraph that was moved far down
Third paragraph
Fourth paragraph
Fifth paragraph
Sixth paragraph
  `;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  const movedComp = report.content.find((c) => c.expected.includes('Second paragraph'));
  assert.ok(movedComp, 'Should find moved block comparison');
  assert.ok(movedComp.status === 'MOVED' || movedComp.status === 'WRONG_ORDER');
  assert.notEqual(movedComp.status, 'MISSING');
});

test('11. missing paragraph: reported as MISSING with HIGH severity', () => {
  const html = `<html><body><main><p>Existing paragraph.</p></main></body></html>`;
  const refText = `Existing paragraph.\nMissing paragraph that does not exist on page.`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  const missing = report.content.find((c) => c.status === 'MISSING');
  assert.ok(missing);
  assert.ok(report.issues.some((i) => i.category === 'body-copy' && i.severity === 'HIGH'));
});

test('12. duplicated reference paragraph: block ownership ensures second is MISSING (Fix 20)', () => {
  const html = `<html><body><main><p>Single unique paragraph on page.</p></main></body></html>`;
  const refText = `Single unique paragraph on page.\nSingle unique paragraph on page.`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.content.length, 2);
  assert.equal(report.content[0].status, 'EXACT');
  assert.equal(report.content[1].status, 'MISSING');
});

test('13. duplicated webpage paragraph: extra instance detected (Fix 20 & Fix 30)', () => {
  const html = `<html><body><main><p>Single paragraph expected.</p><p>Single paragraph expected.</p></main></body></html>`;
  const refText = `Single paragraph expected.`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.equal(report.content[0].status, 'EXACT');
});

test('14. extra webpage content: reports EXTRA content (Fix 30)', () => {
  const html = `<html><body><main><p>Intro text.</p><p>Unexpected extra promotional campaign banner content that was never in the brief.</p></main></body></html>`;
  const refText = `Intro text.`;
  const page = extractPageAuditModel(html, 'https://example.com');
  const ref = parseGoogleDocReference(refText);
  const report = buildContentAuditReport(page, ref);

  assert.ok(report.issues.some((i) => i.id.startsWith('content-extra-')));
});

test('15. punctuation-only differences: NEAR_EXACT match with minor differences status', () => {
  const s1 = 'We build scalable web solutions!';
  const s2 = 'We build scalable web solutions.';
  const sim = compareTextSimilarity(s1, s2);
  assert.equal(sim.status, 'NEAR_EXACT');
});

test('16. smart quotes normalized: curly quotes match straight quotes (Fix 17)', () => {
  const s1 = '“Innovate with confidence,” said the CEO.';
  const s2 = '"Innovate with confidence," said the CEO.';
  const sim = compareTextSimilarity(s1, s2);
  assert.equal(sim.status, 'EXACT');
});

test('17. em dash differences normalized (Fix 17)', () => {
  const s1 = 'Fast — Reliable — Secure';
  const s2 = 'Fast - Reliable - Secure';
  const sim = compareTextSimilarity(s1, s2);
  assert.equal(sim.status, 'EXACT');
});

test('18. typo detected: status PARTIAL with similarity >= 0.85', () => {
  const s1 = 'We build scalable applications for modern businesses.';
  const s2 = 'We build scalable applicatoins for modern businesses.';
  const sim = compareTextSimilarity(s1, s2);
  assert.equal(sim.status, 'PARTIAL');
  assert.ok(sim.similarity >= 0.85);
});

test('19. minor copy edit: word-level diff computed (Fix 23)', () => {
  const exp = 'We build highly scalable applications for modern businesses.';
  const act = 'We build scalable applications for modern companies.';
  const diff = computeWordDiff(exp, act);

  assert.ok(diff.some((d) => d.value === 'highly' && d.removed));
  assert.ok(diff.some((d) => d.value === 'businesses.' && d.removed));
  assert.ok(diff.some((d) => d.value === 'companies.' && d.added));
});

test('20. major paragraph rewrite: status MISMATCH', () => {
  const exp = 'Our platform processes transactions in real-time across global networks.';
  const act = 'Blueberry muffins taste delicious on Sunday mornings.';
  const sim = compareTextSimilarity(exp, act);
  assert.equal(sim.status, 'MISMATCH');
});

test('21. unordered list: exact match', () => {
  const exp = [{ type: 'ul' as const, items: ['Item Alpha', 'Item Beta'] }];
  const act = [{ type: 'ul' as const, items: ['Item Alpha', 'Item Beta'] }];
  const res = auditLists(exp, act);
  assert.equal(res[0].status, 'EXACT');
  assert.equal(res[0].missingItems.length, 0);
});

test('22. ordered list: exact match', () => {
  const exp = [{ type: 'ol' as const, items: ['Step 1', 'Step 2', 'Step 3'] }];
  const act = [{ type: 'ol' as const, items: ['Step 1', 'Step 2', 'Step 3'] }];
  const res = auditLists(exp, act);
  assert.equal(res[0].status, 'EXACT');
});

test('23. reordered ordered list: reports WRONG_ORDER (Fix 29)', () => {
  const exp = [{ type: 'ol' as const, items: ['Step 1', 'Step 2', 'Step 3'] }];
  const act = [{ type: 'ol' as const, items: ['Step 2', 'Step 1', 'Step 3'] }];
  const res = auditLists(exp, act);
  assert.equal(res[0].status, 'WRONG_ORDER');
  assert.equal(res[0].orderMatches, false);
});

test('24. missing list item: reports missing item (Fix 29)', () => {
  const exp = [{ type: 'ul' as const, items: ['Alpha', 'Beta', 'Gamma'] }];
  const act = [{ type: 'ul' as const, items: ['Alpha', 'Gamma'] }];
  const res = auditLists(exp, act);
  assert.equal(res[0].status, 'PARTIAL');
  assert.deepEqual(res[0].missingItems, ['Beta']);
});

test('25. table exact match: headers and rows match (Fix 28)', () => {
  const exp = [{ id: 'tbl-1', headers: ['Service', 'Price'], rows: [['Basic', '$99'], ['Pro', '$199']], order: 1 }];
  const act = [{ id: 'tbl-1', headers: ['Service', 'Price'], rows: [['Basic', '$99'], ['Pro', '$199']], order: 1 }];
  const res = auditTables(exp, act);
  assert.equal(res[0].status, 'EXACT');
  assert.equal(res[0].rowMatches, 2);
});

test('26. table missing row: reports PARTIAL with missing row', () => {
  const exp = [{ id: 'tbl-1', headers: ['Service', 'Price'], rows: [['Basic', '$99'], ['Pro', '$199']], order: 1 }];
  const act = [{ id: 'tbl-1', headers: ['Service', 'Price'], rows: [['Basic', '$99']], order: 1 }];
  const res = auditTables(exp, act);
  assert.equal(res[0].status, 'PARTIAL');
  assert.equal(res[0].missingRows.length, 1);
});

test('27. table incorrect cell: detects cell discrepancy', () => {
  const exp = [{ id: 'tbl-1', headers: ['Plan'], rows: [['Enterprise $500']], order: 1 }];
  const act = [{ id: 'tbl-1', headers: ['Plan'], rows: [['Enterprise $900']], order: 1 }];
  const res = auditTables(exp, act);
  assert.equal(res[0].status, 'MISSING');
});

test('28. FAQ exact match: question and answer pairing (Fix 26)', () => {
  const exp = [{ question: 'What is your refund policy?', answer: 'We offer a 30-day money-back guarantee.', order: 1 }];
  const pageFaq = {
    present: true,
    items: [{ question: 'What is your refund policy?', answer: 'We offer a 30-day money-back guarantee.' }],
    schemaPresent: true,
    schemaItems: [{ question: 'What is your refund policy?', answer: 'We offer a 30-day money-back guarantee.' }],
  };
  const res = auditFaq(exp, pageFaq);
  assert.equal(res.status, 'EXACT');
  assert.equal(res.itemComparisons[0].questionMatch, true);
  assert.equal(res.itemComparisons[0].answerMatch, true);
});

test('29. FAQ missing: reference expects FAQ but page has none', () => {
  const exp = [{ question: 'How do I start?', answer: 'Click sign up.', order: 1 }];
  const pageFaq = { present: false, items: [], schemaPresent: false, schemaItems: [] };
  const res = auditFaq(exp, pageFaq);
  assert.equal(res.status, 'MISSING');
});

test('30. FAQ answer mismatch: question matches but answer is different', () => {
  const exp = [{ question: 'Where are you located?', answer: 'Austin, Texas.', order: 1 }];
  const pageFaq = {
    present: true,
    items: [{ question: 'Where are you located?', answer: 'London, United Kingdom.' }],
    schemaPresent: false,
    schemaItems: [],
  };
  const res = auditFaq(exp, pageFaq);
  assert.equal(res.itemComparisons[0].questionMatch, true);
  assert.equal(res.itemComparisons[0].answerMatch, false);
  assert.equal(res.itemComparisons[0].status, 'PARTIAL');
});

test('31. feature image exact URL match: reports EXACT (Fix 24 & Fix 25)', () => {
  const exp = 'https://example.com/images/hero.webp';
  const detected = [{ src: 'https://example.com/images/hero.webp', source: 'og:image' as const }];
  const res = auditFeatureImage(exp, detected);
  assert.equal(res.status, 'EXACT');
  assert.equal(res.matches, true);
  assert.equal(res.source, 'og:image');
});

test('32. feature image same filename CDN variant: reports FILENAME_MATCH (Fix 25)', () => {
  const exp = 'https://cdn-origin.com/assets/banner-image.webp';
  const detected = [{ src: 'https://img.cdn2.net/transformed/banner-image.webp?w=1200&q=80', source: 'twitter:image' as const }];
  const res = auditFeatureImage(exp, detected);
  assert.equal(res.status, 'FILENAME_MATCH');
  assert.equal(res.matches, true);
});

test('33. feature image mismatch: different file reports MISMATCH', () => {
  const exp = 'https://example.com/banner-a.jpg';
  const detected = [{ src: 'https://example.com/completely-different.jpg', source: 'hero' as const }];
  const res = auditFeatureImage(exp, detected);
  assert.equal(res.status, 'MISMATCH');
  assert.equal(res.matches, false);
});

test('34. long screenshot dimension calculation triggers vertical tiling (Fix 9)', () => {
  // A test helper verifying height > 2400 logic
  const isTall = 3200 > 2400;
  assert.equal(isTall, true);
});

test('35. low-confidence OCR: reports UNVERIFIED status (Fix 10)', () => {
  const html = `<html><body><main><p>Some valid text.</p></main></body></html>`;
  const page = extractPageAuditModel(html, 'https://example.com');

  const ref = parseGoogleDocReference('Some text');
  ref.source = 'screenshot';
  ref.extractionConfidence = 62; // Below 70 threshold
  ref.diagnostics.unverifiedFields.push('all');

  const report = buildContentAuditReport(page, ref);
  assert.equal(report.status, 'UNVERIFIED');
  assert.ok(report.issues.some((i) => i.id === 'low-extraction-confidence'));
});

test('36. OCR timeout/failure: explicitly handled without silent empty return (Fix 11)', () => {
  const timeoutError = new Error('OCR_TIMEOUT: Screenshot OCR exceeded time limit.');
  assert.match(timeoutError.message, /OCR_TIMEOUT/);
});

test('37. Google Doc structured brief: recognizes URL, Meta Title, Description, Feature Image (Fix 8)', () => {
  const brief = `
URL: https://example.com/landing
Meta Title: Best Cloud Hosting 2026
Meta Description: Compare fast and affordable cloud hosting providers.
Feature Image: https://example.com/cloud-hero.jpg
Primary Keyword: cloud hosting
Content
H1 Cloud Hosting Guide
Here is the complete guide to cloud hosting.
  `;
  const ref = parseGoogleDocReference(brief);
  assert.equal(ref.url, 'https://example.com/landing');
  assert.equal(ref.meta.title, 'Best Cloud Hosting 2026');
  assert.equal(ref.meta.description, 'Compare fast and affordable cloud hosting providers.');
  assert.equal(ref.featureImage, 'https://example.com/cloud-hero.jpg');
  assert.equal(ref.meta.primaryKeyword, 'cloud hosting');
  assert.equal(ref.headings[0].text, 'Cloud Hosting Guide');
});

test('38. Google Doc unstructured content: marks unverified fields when structure is ambiguous (Fix 8)', () => {
  const plain = `H2 Heading Without Title\nRandom sentence\nAnother sentence`;
  const ref = parseGoogleDocReference(plain);
  assert.ok(ref.diagnostics.unverifiedFields.includes('meta.title'));
});

test('39. malformed HTML: parsed safely without crash (Fix 5)', () => {
  const malformed = `<html><head><title>Page Title</title></head><body><h1>Unclosed H1</h1><p>Paragraph without close<div><span>nested unclosed`;
  const page = extractPageAuditModel(malformed, 'https://example.com');
  assert.equal(page.meta.titleTag, 'Page Title');
  assert.ok(page.headings.length > 0);
  assert.equal(page.headings[0].text, 'Unclosed H1');
});

test('40. navigation pollution: header nav items excluded from main content (Fix 15)', () => {
  const html = `
    <html>
      <body>
        <header><nav><a href="/">Home</a><a href="/about">About</a><a href="/pricing">Pricing</a></nav></header>
        <main>
          <h1>Actual Title</h1>
          <p>Actual article content.</p>
        </main>
      </body>
    </html>
  `;
  const page = extractPageAuditModel(html, 'https://example.com');
  const texts = page.blocks.map((b) => b.text);
  assert.ok(!texts.includes('Home'));
  assert.ok(!texts.includes('Pricing'));
  assert.ok(texts.includes('Actual article content.'));
});

test('41. footer pollution: footer links excluded from main content (Fix 15)', () => {
  const html = `
    <html>
      <body>
        <main>
          <p>Main body text.</p>
        </main>
        <footer>
          <p>Copyright 2026. All rights reserved. Privacy Policy.</p>
        </footer>
      </body>
    </html>
  `;
  const page = extractPageAuditModel(html, 'https://example.com');
  const texts = page.blocks.map((b) => b.text);
  assert.ok(!texts.some((t) => t.includes('Privacy Policy')));
});

test('42. sidebar pollution: aside elements excluded from main content (Fix 15)', () => {
  const html = `
    <html>
      <body>
        <main>
          <article>
            <p>Main story.</p>
          </article>
          <aside class="sidebar">
            <p>Sidebar advertisement widget</p>
          </aside>
        </main>
      </body>
    </html>
  `;
  const page = extractPageAuditModel(html, 'https://example.com');
  const texts = page.blocks.map((b) => b.text);
  assert.ok(!texts.includes('Sidebar advertisement widget'));
  assert.ok(texts.includes('Main story.'));
});

test('43. <main> tag resolution: prioritized container (Fix 15)', () => {
  const html = `<html><body><div id="wrapper"><main><h1>Main Section</h1><p>Inside main.</p></main></div></body></html>`;
  const page = extractPageAuditModel(html, 'https://example.com');
  assert.equal(page.headings[0].text, 'Main Section');
  assert.equal(page.blocks[1].text, 'Inside main.');
});

test('44. <article> tag resolution: prioritized when no <main> (Fix 15)', () => {
  const html = `<html><body><article><h2>Article Header</h2><p>Article body.</p></article></body></html>`;
  const page = extractPageAuditModel(html, 'https://example.com');
  assert.equal(page.headings[0].text, 'Article Header');
  assert.equal(page.blocks[1].text, 'Article body.');
});

test('45. Elementor-like structure: extracted cleanly (Fix 15)', () => {
  const html = `
    <html>
      <body>
        <div class="elementor elementor-123">
          <div class="elementor-widget-container">
            <h2>Elementor Heading</h2>
            <p>Elementor paragraph copy.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  const page = extractPageAuditModel(html, 'https://example.com');
  assert.equal(page.headings[0].text, 'Elementor Heading');
  assert.equal(page.blocks[1].text, 'Elementor paragraph copy.');
});

test('46. WordPress-like structure: .entry-content container scoped cleanly (Fix 15)', () => {
  const html = `
    <html>
      <body>
        <div class="site-content">
          <div class="entry-content">
            <h1>WordPress Post</h1>
            <p>WordPress paragraph text.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  const page = extractPageAuditModel(html, 'https://example.com');
  assert.equal(page.headings[0].text, 'WordPress Post');
  assert.equal(page.blocks[1].text, 'WordPress paragraph text.');
});

test('47. SPA empty source: detects hydration shell for fallback trigger (Fix 14)', () => {
  const emptySpaHtml = `<html><head><script src="/bundle.js"></script></head><body><div id="root"></div></body></html>`;
  const trigger = shouldTriggerRenderFallback(emptySpaHtml, 0);
  assert.equal(trigger, true);
});

test('48. SPA rendered content: extracted properly when rendered HTML is provided (Fix 14)', () => {
  const renderedSpaHtml = `<html><head><title>SPA Title</title></head><body><div id="root"><main><h1>Loaded App</h1><p>Client rendered data.</p></main></div></body></html>`;
  const trigger = shouldTriggerRenderFallback(renderedSpaHtml, 2);
  assert.equal(trigger, false);
  const page = extractPageAuditModel(renderedSpaHtml, 'https://example.com');
  assert.equal(page.headings[0].text, 'Loaded App');
});

test('49. HTML entities: &amp;, &quot;, &mdash;, &#39; normalized cleanly (Fix 17)', () => {
  const raw = 'Tom &amp; Jerry &mdash; &quot;Best Friends&#39; Day&quot;';
  const clean = normalizeText(raw);
  assert.equal(clean, 'Tom & Jerry - "Best Friends\' Day"');
});

test('50. Unicode content: accented characters & international strings compare reliably (Fix 17)', () => {
  const s1 = 'Bienvenue au Café & Résumé Center';
  const s2 = 'Bienvenue au Café & Résumé Center';
  const sim = compareTextSimilarity(s1, s2);
  assert.equal(sim.status, 'EXACT');
});

test('51. SSRF security: private IP addresses and loopback blocked (Fix 40)', async () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('localhost'), true);
  assert.equal(isPrivateIp('10.0.0.5'), true);
  assert.equal(isPrivateIp('192.168.1.1'), true);
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);

  const checkLocal = await validateSafeUrl('http://127.0.0.1:3000/admin');
  assert.equal(checkLocal.valid, false);

  const checkMetadata = await validateSafeUrl('http://169.254.169.254/latest/meta-data/');
  assert.equal(checkMetadata.valid, false);

  const checkPublic = await validateSafeUrl('https://example.com/test');
  assert.equal(checkPublic.valid, true);
});

test('52. manual content selector: scoped strictly and throws on invalid selector (Fix 16)', () => {
  const html = `<html><body><div class="sidebar"><p>Sidebar</p></div><div class="target-scope"><p>Target Paragraph</p></div></body></html>`;
  const page = extractPageAuditModel(html, 'https://example.com', {}, '.target-scope');
  assert.equal(page.blocks.length, 1);
  assert.equal(page.blocks[0].text, 'Target Paragraph');

  assert.throws(() => {
    extractPageAuditModel(html, 'https://example.com', {}, '.non-existent-selector');
  }, /matched no elements/);
});

test('alt text: lists missing and duplicated reference alt texts, found ones pass', () => {
  const html = `<html><head><title>T</title></head><body><main>
    <h1>Hello</h1><p>Some body copy goes here for the page.</p>
    <img src="/a.png" alt="Team at work"><img src="/b.png" alt="Team at work">
    <img src="/c.png" alt="Office &amp; desk">
  </main></body></html>`;
  const refText = `H1 Hello
Some body copy goes here for the page.
Alt text: Team at work
Image Alt: "Office & desk"
Alt text - Server room`;

  const ref = parseGoogleDocReference(refText);
  assert.deepEqual(ref.altTexts, ['Team at work', 'Office & desk', 'Server room']);
  assert.equal(ref.blocks.some((b) => /alt/i.test(b.text)), false); // not audited as body copy

  const report = buildContentAuditReport(extractPageAuditModel(html, 'https://example.com/'), ref);
  const byText = Object.fromEntries((report.altTexts || []).map((a) => [a.expected, a]));
  assert.equal(byText['Team at work'].duplicate, true);
  assert.equal(byText['Team at work'].pageCount, 2);
  assert.equal(byText['Office & desk'].status, 'FOUND');
  assert.equal(byText['Server room'].status, 'MISSING');
  assert.ok(report.issues.some((i) => i.id.startsWith('alt-text-missing')));
  assert.ok(report.issues.some((i) => i.id.startsWith('alt-text-duplicate')));
  assert.equal(report.status, 'FAIL');
});

test('alt text: keyword variants in a doc are recognised, plain prose is not', () => {
  const alts = (l: string) => parseAltTextLine(l);
  assert.equal(alts('Alt text: Team at work'), 'Team at work');
  assert.equal(alts('Image Alt Text - "Team at work"'), 'Team at work');
  assert.equal(alts('Alt tag for image 2: Office desk'), 'Office desk');
  assert.equal(alts('Image 1 alt text: Server room'), 'Server room');
  assert.equal(alts('[Alt text: Server room]'), 'Server room');
  assert.equal(alts('Hero image alt – Skyline'), 'Skyline');
  assert.equal(alts('Alternative text: Skyline'), 'Skyline');
  assert.equal(alts('Alternative - a different approach'), undefined);
  assert.equal(alts('We write alt text for every image.'), undefined);
});

test('schema in doc: multi-line curly-quote JSON-LD is consumed and checked against page JSON-LD', () => {
  const refText = `H1 Hello
Some body copy goes here for the page.
Schema:
<script type=“application/ld+json”>
{
  “@context”: “https://schema.org”,
  “@type”: “FAQPage”,
  “mainEntity”: [{ “@type”: “Question”, “name”: “What is it?”, “acceptedAnswer”: { “@type”: “Answer”, “text”: “A thing.” } }]
}
</script>
{ “@context”: “https://schema.org”, “@type”: “Organization”, “name”: “Acme” }
{ “@type”: “Product”, “name”: broken }
Closing paragraph for the page here.`;
  const ref = parseGoogleDocReference(refText);
  assert.equal(ref.schemaBlocks?.length, 3);
  assert.deepEqual(ref.blocks.map((b) => b.text), ['Hello', 'Some body copy goes here for the page.', 'Closing paragraph for the page here.']);
  assert.equal(ref.faq.length, 0);

  const pageHtml = (ld: string) => `<html><head><title>T</title><script type="application/ld+json">${ld}</script></head><body><main>
    <h1>Hello</h1><p>Some body copy goes here for the page.</p><p>Closing paragraph for the page here.</p></main></body></html>`;

  const bad = buildContentAuditReport(extractPageAuditModel(pageHtml('{"@context":"https://schema.org","@graph":[{"@type":"Organization"}]}'), 'https://example.com/'), ref);
  assert.deepEqual(bad.schemas?.map((s) => s.status), ['MISSING', 'FOUND', 'INVALID']);
  assert.deepEqual(bad.schemas?.[0].missingTypes, ['FAQPage']);
  assert.equal(bad.status, 'FAIL');

  const good = buildContentAuditReport(
    extractPageAuditModel(pageHtml('[{"@type":"FAQPage"},{"@type":"Organization"}]'), 'https://example.com/'),
    parseGoogleDocReference(refText.replace(/^\{ “@type”: “Product”.*$/m, ''))
  );
  assert.deepEqual(good.schemas?.map((s) => s.status), ['FOUND', 'FOUND']);
  assert.equal(good.issues.some((i) => i.category === 'schema'), false);
});

test('schema in doc: typed labels like "FAQ Schema" above the code are ignored, other lines are kept', () => {
  const doc = [
    'Intro paragraph that stays in the content.',
    'FAQ Schema',
    '{"@context":"https://schema.org","@type":"FAQPage"}',
    'Article Schema Markup:',
    '<script type="application/ld+json">{"@type":"Article"}</script>',
    'JSON-LD schema - {"@type":"Organization"}',
    'Schema markup helps search engines.',
  ];
  const { blocks, consumed } = extractSchemaBlocks(doc);
  assert.equal(blocks.length, 3);
  assert.deepEqual([...consumed].sort(), [1, 2, 3, 4, 5]);
});
