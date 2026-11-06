import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { docs_v1 } from 'googleapis';
import { parseGoogleDoc, unwrapGoogleRedirect } from '../google/GoogleDocParser';
import { extractWebsiteSemanticTree } from '../webpage/domContentExtractor';
import { compareNormalizedTrees } from '../comparison/deterministicComparator';
import { auditLinks, parseLinkUrl, sameLinkTarget } from '../comparison/LinkMatcher';

const PAGE_URL = 'https://www.compensationlawyers.com/workers-compensation/benefits/';
// How Google's HTML export writes every link
const g = (url: string) =>
  `https://www.google.com/url?q=${encodeURIComponent(url)}&amp;sa=D&amp;source=editors&amp;ust=1730000000000&amp;usg=AOvVaw1`;
const doc = (body: string) => parseGoogleDoc({ isHtml: true, html: `<html><head><title>Draft</title></head><body>${body}</body></html>` });
const page = (body: string) =>
  extractWebsiteSemanticTree(
    `<html><body><header><nav><a href="/">Home</a></nav></header><main>${body}</main><footer><a href="/privacy">Privacy</a></footer></body></html>`
  );
const audit = (docBody: string, pageBody: string) => auditLinks(doc(docBody).elements, page(pageBody).elements, PAGE_URL);

describe('Link audit: statuses', () => {
  test('a link split over formatting runs and wrapped in a Google redirect matches a relative page link', () => {
    const { links } = audit(
      `<h1>T</h1><p><span>Learn about </span><span class="c4"><a href="${g('https://www.compensationlawyers.com/claims/')}">workers’ comp </a></span><span class="c7"><a href="${g('https://www.compensationlawyers.com/claims/')}">claims</a></span><span> today.</span></p>`,
      `<h1>T</h1><p>Learn about <a href="/claims">workers' comp claims</a> today.</p>`
    );
    assert.equal(links.length, 1);
    assert.equal(links[0].text, "workers' comp claims");
    assert.equal(links[0].expectedUrl, 'https://www.compensationlawyers.com/claims/');
    assert.equal(links[0].status, 'MATCH');
  });

  test('same anchor text, different URL is WRONG_URL', () => {
    const { links } = audit(`<h1>T</h1><p>See <a href="${g('https://x.com/a')}">our guide</a>.</p>`, `<h1>T</h1><p>See <a href="https://x.com/b">our guide</a>.</p>`);
    assert.equal(links[0].status, 'WRONG_URL');
    assert.equal(links[0].actualUrl, 'https://x.com/b');
  });

  test('anchor text on the page without a link is NOT_LINKED', () => {
    const { links } = audit(`<h1>T</h1><p>See <a href="${g('https://x.com/a')}">our guide</a>.</p>`, `<h1>T</h1><p>See our guide.</p>`);
    assert.equal(links[0].status, 'NOT_LINKED');
  });

  test('anchor text absent from the page is MISSING', () => {
    const { links } = audit(`<h1>T</h1><p>See <a href="${g('https://x.com/a')}">our guide</a>.</p>`, `<h1>T</h1><p>Something else.</p>`);
    assert.equal(links[0].status, 'MISSING');
  });

  test('same URL with slightly different anchor text is ANCHOR_DIFFERS', () => {
    const { links } = audit(
      `<h1>T</h1><p><a href="${g('https://x.com/a')}">workers comp claims</a></p>`,
      `<h1>T</h1><p><a href="https://x.com/a">file workers comp claims</a></p>`
    );
    assert.equal(links[0].status, 'ANCHOR_DIFFERS');
    assert.equal(links[0].actualText, 'file workers comp claims');
  });

  test('unrelated anchor text to the same URL is not paired as ANCHOR_DIFFERS', () => {
    const { links, extraLinks } = audit(
      `<h1>T</h1><p><a href="${g('https://x.com/a')}">contact us</a></p>`,
      `<h1>T</h1><p><a href="https://x.com/a">pricing table</a></p>`
    );
    assert.equal(links[0].status, 'MISSING');
    assert.equal(extraLinks.length, 1);
  });

  test('anchor text differing only in case or punctuation still matches', () => {
    const { links } = audit(`<h1>T</h1><p><a href="${g('https://x.com/a')}">Our Guide.</a></p>`, `<h1>T</h1><p><a href="https://x.com/a">our guide</a></p>`);
    assert.equal(links[0].status, 'MATCH');
  });
});

describe('Link audit: pairing', () => {
  test('repeated anchor text with different URLs pairs each with its own URL', () => {
    const { links } = audit(
      `<h1>T</h1><p><a href="${g('https://x.com/a')}">here</a> and <a href="${g('https://x.com/b')}">here</a></p>`,
      `<h1>T</h1><p><a href="https://x.com/b">here</a> and <a href="https://x.com/a">here</a></p>`
    );
    assert.deepEqual(links.map((l) => l.status), ['MATCH', 'MATCH']);
  });

  test('a doc link repeated twice needs two page links', () => {
    const { links } = audit(
      `<h1>T</h1><p><a href="${g('https://x.com/a')}">guide</a></p><p>Read the <a href="${g('https://x.com/a')}">guide</a></p>`,
      `<h1>T</h1><p><a href="https://x.com/a">guide</a></p><p>Read the guide</p>`
    );
    assert.deepEqual(links.map((l) => l.status), ['MATCH', 'NOT_LINKED']);
  });

  test('adjacent list items linking the same URL stay separate links', () => {
    const tree = page(`<h1>T</h1><ul><li><a href="/a">One</a></li><li><a href="/a">Two</a></li></ul>`);
    assert.deepEqual(tree.elements[1].links?.map((l) => l.text), ['One', 'Two']);
  });

  test('header, nav and footer links are not part of the check; extra content links are reported', () => {
    const { links, extraLinks } = audit(`<h1>T</h1><p>Body</p>`, `<h1>T</h1><p>Body <a href="/extra">extra</a> <a href="#top">top</a></p>`);
    assert.equal(links.length, 0);
    assert.deepEqual(extraLinks, [{ text: 'extra', href: '/extra' }]);
  });

  test('links in headings, list items and table cells are checked', () => {
    const { links } = audit(
      `<h1>T</h1><h2><a href="${g('https://x.com/h')}">Heading link</a></h2><ul><li><a href="${g('https://x.com/l')}">List link</a></li></ul><table><tr><td><a href="${g('https://x.com/t')}">Cell link</a></td></tr></table>`,
      `<h1>T</h1><h2><a href="https://x.com/h">Heading link</a></h2><ul><li><a href="https://x.com/l">List link</a></li></ul><table><tr><td><a href="https://x.com/t">Cell link</a></td></tr></table>`
    );
    assert.deepEqual(links.map((l) => l.status), ['MATCH', 'MATCH', 'MATCH']);
    assert.match(links[0].context, /^H2 /);
  });

  test('a link on the second line of a <br> paragraph stays with that line', () => {
    const tree = page(`<h1>T</h1><p>First line<br>Second <a href="/x">link</a></p>`);
    assert.equal(tree.elements[1].links, undefined);
    assert.deepEqual(tree.elements[2].links, [{ text: 'link', href: '/x' }]);
  });
});

describe('Link audit: Google export clean-up', () => {
  test('comment and footnote markers are not links and not content', () => {
    const ref = doc(
      `<h1>T</h1><p>Some text<sup><a href="#cmnt1" id="cmnt_ref1">[a]</a></sup> here<sup><a href="#ftnt1" id="ftnt_ref1">[1]</a></sup>.</p>` +
        `<div><p><a href="#ftnt_ref1" id="ftnt1">[1]</a><span> A footnote.</span></p></div>` +
        `<div><p><a href="#cmnt_ref1" id="cmnt1">[a]</a><span>Please fix this</span></p></div>`
    );
    assert.deepEqual(ref.elements.map((e) => e.text), ['T', 'Some text here.']);
    assert.ok(ref.elements.every((e) => !e.links));
    assert.equal(compareNormalizedTrees(ref, page('<h1>T</h1><p>Some text here.</p>')).summary.status, 'PASS');
  });

  test('in-doc jump links (headings, bookmarks, table of contents) are ignored', () => {
    const ref = doc(`<h1>T</h1><p><a href="#h.abc123">Jump to section</a></p><p><a href="#id.xyz">Bookmark</a></p>`);
    assert.ok(ref.elements.every((e) => !e.links));
  });

  test('Google redirect unwrapping keeps the real URL with its own query', () => {
    assert.equal(unwrapGoogleRedirect(`https://www.google.com/url?q=${encodeURIComponent('https://x.com/a?b=1&c=2')}&sa=D`), 'https://x.com/a?b=1&c=2');
    assert.equal(unwrapGoogleRedirect('https://x.com/url?q=1'), 'https://x.com/url?q=1');
  });

  test('API doc: link runs with the same URL join, heading/bookmark links are ignored', () => {
    const run = (content: string, url?: string, headingId?: string) => ({
      textRun: { content, textStyle: url || headingId ? { link: { ...(url && { url }), ...(headingId && { headingId }) } } : {} },
    });
    const para = (style: string, elements: object[]) => ({ paragraph: { paragraphStyle: { namedStyleType: style }, elements } });
    const tree = parseGoogleDoc({
      body: {
        content: [
          para('HEADING_1', [run('Title')]),
          para('NORMAL_TEXT', [run('Read '), run('workers comp ', 'https://x.com/a'), run('claims', 'https://x.com/a'), run(' or '), run('jump', undefined, 'h.1'), run('\n')]),
        ],
      },
    } as docs_v1.Schema$Document);
    assert.deepEqual(tree.elements[1].links, [{ text: 'workers comp claims', href: 'https://x.com/a' }]);
  });

  test('API doc: a soft line break splits the paragraph like the page does', () => {
    const para = (style: string, content: string) => ({ paragraph: { paragraphStyle: { namedStyleType: style }, elements: [{ textRun: { content } }] } });
    const tree = parseGoogleDoc({ body: { content: [para('HEADING_1', 'T'), para('NORMAL_TEXT', 'Line one.\u000bLine two.\n')] } } as docs_v1.Schema$Document);
    assert.deepEqual(tree.elements.map((e) => e.text), ['T', 'Line one.', 'Line two.']);
  });
});

describe('Link audit: URL comparison', () => {
  const same = (a: string, b: string) => sameLinkTarget(a, b, PAGE_URL);

  test('ignores scheme, www, trailing slash, case and tracking parameters', () => {
    assert.ok(same('http://compensationlawyers.com/Claims', 'https://www.compensationlawyers.com/claims/'));
    assert.ok(same('https://x.com/a?utm_source=doc&utm_medium=x', 'https://x.com/a'));
    assert.ok(same('https://x.com/a?b=2&a=1', 'https://x.com/a?a=1&b=2&gclid=zzz'));
    assert.ok(same('https://x.com/caf%C3%A9', 'https://x.com/café'));
  });

  test('resolves relative page links against the page URL', () => {
    assert.ok(same('https://www.compensationlawyers.com/workers-compensation/benefits/claims', 'claims'));
    assert.ok(same('https://www.compensationlawyers.com/about', '/about'));
  });

  test('treats real differences as different', () => {
    assert.ok(!same('https://x.com/a', 'https://y.com/a'));
    assert.ok(!same('https://x.com/a', 'https://x.com/a/b'));
    assert.ok(!same('https://x.com/a?id=1', 'https://x.com/a?id=2'));
    assert.ok(!same('https://x.com:8080/a', 'https://x.com/a'));
    assert.ok(!same('https://blog.x.com/a', 'https://x.com/a'));
  });

  test('fragment counts only when the doc link has one', () => {
    assert.ok(same('https://x.com/a', 'https://x.com/a#faq'));
    assert.ok(same('https://x.com/a#faq', 'https://x.com/a#faq'));
    assert.ok(!same('https://x.com/a#faq', 'https://x.com/a#pricing'));
  });

  test('mailto and tel compare by address and number', () => {
    assert.ok(same('mailto:Info@X.com', 'mailto:info@x.com?subject=Hi'));
    assert.ok(same('tel:+1 (555) 123-4567', 'tel:+15551234567'));
    assert.ok(!same('mailto:a@x.com', 'mailto:b@x.com'));
  });

  test('an unparseable href does not throw', () => {
    assert.equal(parseLinkUrl('http://[bad').key, null);
    assert.ok(!same('http://[bad', 'https://x.com'));
  });
});
