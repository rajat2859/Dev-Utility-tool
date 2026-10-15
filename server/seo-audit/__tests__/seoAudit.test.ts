import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditPage } from '../pageAudit';
import { extractSitemapLocs, runSeoAudit } from '../crawl';
import { titlePixelWidth } from '../pixelWidth';

const names = (page: ReturnType<typeof auditPage>, tab: string) =>
  page.issues.filter((i) => i.tab === tab).map((i) => i.name);

const page = (head: string, body = '') => auditPage(`<html><head>${head}</head><body>${body}</body></html>`, 'https://example.com/a');

test('pixel width: Arial metrics land near real widths', () => {
  assert.equal(titlePixelWidth('iiii'), 18);
  assert.equal(titlePixelWidth('WWWW'), 76);
});

test('titles: missing, short and long are flagged with Frog names; a good title is clean', () => {
  assert.deepEqual(names(page(''), 'Page Titles'), ['Missing']);
  assert.deepEqual(names(page('<title>Hi</title>'), 'Page Titles'), ['Below 30 Characters', 'Below 200 Pixels']);
  const long = 'Word '.repeat(20).trim();
  assert.ok(names(page(`<title>${long}</title>`), 'Page Titles').includes('Over 60 Characters'));
  assert.ok(names(page(`<title>${long}</title>`), 'Page Titles').includes('Over 561 Pixels'));
  assert.deepEqual(names(page('<title>Web Development Company in Texas | Acme</title>'), 'Page Titles'), []);
  assert.ok(names(page('<title>Same Heading Text That Is Long Enough</title>', '<h1>Same Heading Text That Is Long Enough</h1>'), 'Page Titles').includes('Same as H1'));
});

test('descriptions, headings, canonical and directives', () => {
  assert.deepEqual(names(page(''), 'Meta Description'), ['Missing']);
  assert.deepEqual(names(page('<meta name="description" content="Too short">'), 'Meta Description'), ['Below 70 Characters', 'Below 400 Pixels']);
  assert.deepEqual(names(page('', ''), 'H1'), ['Missing']);
  assert.deepEqual(names(page('', '<h1>A</h1><h1>B</h1>'), 'H1'), ['Multiple']);
  assert.deepEqual(names(page(''), 'Canonicals'), ['Missing']);
  assert.deepEqual(names(page('<link rel="canonical" href="https://example.com/b">'), 'Canonicals'), ['Canonicalised']);
  assert.deepEqual(names(page('<link rel="canonical" href="https://example.com/a/">'), 'Canonicals'), []);
  assert.deepEqual(names(page('<meta name="robots" content="noindex, nofollow">'), 'Directives'), ['Noindex', 'Nofollow']);
});

test('images: missing alt attribute vs empty alt vs alt over 100 chars', () => {
  const p = page('', `<img src="a.png"><img src="b.png" alt=""><img src="c.png" alt="${'x'.repeat(101)}"><img src="d.png" alt="ok">`);
  assert.equal(p.images.total, 4);
  assert.deepEqual(p.images.missingAltAttribute, ['a.png']);
  assert.deepEqual(p.images.missingAltText, ['b.png']);
  assert.deepEqual(p.images.altOver100, ['c.png']);
  assert.deepEqual(names(p, 'Images'), ['Missing Alt Text', 'Missing Alt Attribute', 'Alt Text Over 100 Characters']);
});

test('structured data: validation errors/warnings, rich results, parse errors, @context, microdata', () => {
  const ld = (json: string) => `<script type="application/ld+json">${json}</script>`;

  const product = page(ld('{"@context":"https://schema.org","@type":"Product","name":"Widget"}'));
  assert.ok(product.structuredData.items[0].errors.some((e) => e.includes('one of "offers", "review", "aggregateRating"')));
  assert.ok(names(product, 'Structured Data').includes('Validation Errors'));
  assert.ok(names(product, 'Structured Data').includes('Rich Result Feature Detected'));

  const graph = page(ld('{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme","url":"https://a.com","logo":"l.png","sameAs":["x"]},{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Q?","acceptedAnswer":{"@type":"Answer","text":"A"}}]}]}'));
  assert.deepEqual(graph.structuredData.items.map((i) => i.type), ['Organization', 'FAQPage', 'Question', 'Answer']);
  assert.equal(graph.structuredData.errors + graph.structuredData.warnings, 0);

  const noContext = page(ld('{"@type":"Article","headline":"H","author":"A","datePublished":"d","image":"i","dateModified":"d"}'));
  assert.deepEqual(noContext.structuredData.items[0].warnings, ['Missing "@context"']);

  assert.deepEqual(names(page(ld('{"@type": "Product", "name": broken}')), 'Structured Data'), ['Parse Errors']);
  assert.deepEqual(names(page(''), 'Structured Data'), ['Missing']);

  const micro = page('', '<div itemscope itemtype="https://schema.org/LocalBusiness"><span itemprop="name">Shop</span></div>');
  assert.equal(micro.structuredData.items[0].format, 'Microdata');
  assert.deepEqual(micro.structuredData.items[0].errors, ['LocalBusiness: missing required property "address"']);
});

test('sitemap locs are extracted; list audit flags duplicates across pages and fetch failures', async () => {
  assert.deepEqual(extractSitemapLocs('<urlset><url><loc>https://a.com/1?x=1&amp;y=2</loc></url><url><loc> https://a.com/2 </loc></url></urlset>'), [
    'https://a.com/1?x=1&y=2',
    'https://a.com/2',
  ]);

  const html = (t: string) => `<title>${t}</title>`;
  const pages: Record<string, string> = {
    'https://a.com/1': html('Shared Title For Two Pages Of The Site'),
    'https://a.com/2': html('Shared Title For Two Pages Of The Site'),
    'https://a.com/sitemap.xml': '<urlset><loc>https://a.com/1</loc><loc>https://a.com/2</loc><loc>https://a.com/down</loc></urlset>',
  };
  const fetchHtml = async (url: string) => {
    if (!(url in pages)) throw new Error('boom');
    return pages[url];
  };

  const { pages: result, notices } = await runSeoAudit({ urls: ['a.com/sitemap.xml'] }, fetchHtml);
  assert.deepEqual(result.map((p) => p.address), ['https://a.com/1', 'https://a.com/2', 'https://a.com/down']);
  assert.ok(notices[0].includes('3 URL'));
  assert.deepEqual(names(result[0], 'Page Titles'), ['Duplicate']);
  assert.equal(result[2].error, 'boom');
  assert.deepEqual(result[2].issues, []);
});
