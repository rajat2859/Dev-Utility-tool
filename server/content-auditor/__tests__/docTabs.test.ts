import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractGoogleDocTab } from '../google/GoogleDocUrl';
import { fetchPublicGoogleDoc } from '../google/GoogleDocsService';

const DOC_ID = '1SJueKBXxWMfhdqt0aXQKNBH4Rf8bMahY5AE609TahOc';
const TAB_1 = '<html><body><h1>Draft</h1><p>Tab one has the long draft of the article with extra sections.</p></body></html>';
const FINAL = '<html><body><h1>Final</h1><p>Tab two holds the final edit of the article that was published.</p></body></html>';
const ALL_TABS = `<html><body><h1>Draft</h1><p>Tab one has the long draft of the article with extra sections.</p><h1>Final</h1><p>Tab two holds the final edit of the article that was published.</p></body></html>`;

// Fake Google: the tab-less export returns every tab, a tab export returns that tab (unknown id → first tab)
async function withFakeGoogle(
  tabs: Record<string, string>,
  run: (requested: string[]) => Promise<void>,
  opts: { allTabsStatus?: number; api?: unknown } = {}
) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_API_KEY;
  if (opts.api) process.env.GOOGLE_API_KEY = 'test-key';
  else delete process.env.GOOGLE_API_KEY;
  const requested: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    if (url.startsWith('https://docs.googleapis.com/')) return new Response(JSON.stringify(opts.api), { status: 200 });
    const tab = new URL(url).searchParams.get('tab');
    const ids = Object.keys(tabs);
    if (!tab) {
      return new Response(opts.allTabsStatus ? '' : ids.map((id) => tabs[id]).join(''), { status: opts.allTabsStatus ?? 200 });
    }
    return new Response(tabs[tab] ?? tabs[ids[0]], { status: 200 });
  }) as typeof fetch;
  try {
    await run(requested);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey) process.env.GOOGLE_API_KEY = originalKey;
    else delete process.env.GOOGLE_API_KEY;
  }
}

describe('Doc tabs: link parsing', () => {
  test('reads the tab id from a doc link', () => {
    assert.equal(extractGoogleDocTab(`https://docs.google.com/document/d/${DOC_ID}/edit?tab=t.0#heading=h.t2jcfmobguct`), 't.0');
    assert.equal(extractGoogleDocTab(`https://docs.google.com/document/d/${DOC_ID}/edit?usp=sharing&tab=t.7ahkg9ymyfqz`), 't.7ahkg9ymyfqz');
    assert.equal(extractGoogleDocTab(`https://docs.google.com/document/d/${DOC_ID}/edit#heading=h.abc`), undefined);
    assert.equal(extractGoogleDocTab(`https://docs.google.com/document/d/${DOC_ID}/edit`), undefined);
  });
});

describe('Doc tabs: public export', () => {
  test('exports only the tab in the link, and notes that the doc has other tabs', async () => {
    await withFakeGoogle({ 't.0': TAB_1, 't.7ahkg9ymyfqz': FINAL }, async (requested) => {
      const doc = await fetchPublicGoogleDoc(DOC_ID, 't.7ahkg9ymyfqz');
      assert.ok('isHtml' in doc && doc.isHtml);
      assert.equal(doc.html, FINAL);
      assert.equal(doc.hasOtherTabs, true);
      assert.ok(requested.some((u) => u.endsWith('&tab=t.7ahkg9ymyfqz')));
    });
  });

  test('a link without a tab audits the first tab, never all tabs merged', async () => {
    await withFakeGoogle({ 't.0': TAB_1, 't.7ahkg9ymyfqz': FINAL }, async () => {
      const doc = await fetchPublicGoogleDoc(DOC_ID);
      assert.ok('isHtml' in doc && doc.isHtml);
      assert.equal(doc.html, TAB_1);
      assert.notEqual(doc.html, ALL_TABS);
      assert.equal(doc.hasOtherTabs, true);
    });
  });

  test('a one-tab doc is not flagged', async () => {
    await withFakeGoogle({ 't.0': TAB_1 }, async () => {
      const doc = await fetchPublicGoogleDoc(DOC_ID);
      assert.equal(doc.hasOtherTabs, false);
    });
  });

  test('if the all-tabs export fails, the audit still runs and the tab check is just unknown', async () => {
    await withFakeGoogle({ 't.0': TAB_1, 't.x': FINAL }, async () => {
      const doc = await fetchPublicGoogleDoc(DOC_ID, 't.x');
      assert.ok('isHtml' in doc && doc.isHtml && doc.html === FINAL);
      assert.equal(doc.hasOtherTabs, undefined);
    }, { allTabsStatus: 500 });
  });
});

describe('Doc tabs: Docs API (with API key)', () => {
  const tab = (tabId: string, text: string, childTabs: object[] = []) => ({
    tabProperties: { tabId },
    childTabs,
    documentTab: { body: { content: [{ paragraph: { elements: [{ textRun: { content: text } }] } }] }, lists: {} },
  });
  const api = { title: 'Doc', tabs: [tab('t.0', 'Draft text'), tab('t.final', 'Final text', [tab('t.child', 'Child text')])] };
  const bodyText = (doc: any) => doc.body.content[0].paragraph.elements[0].textRun.content;

  test('requests tab content and reads the tab in the link, including nested tabs', async () => {
    await withFakeGoogle({}, async (requested) => {
      const doc = await fetchPublicGoogleDoc(DOC_ID, 't.child');
      assert.equal(bodyText(doc), 'Child text');
      assert.equal(doc.hasOtherTabs, true);
      assert.ok(requested[0].includes('includeTabsContent=true'));
    }, { api });
  });

  test('reads the first tab when the link has none', async () => {
    await withFakeGoogle({}, async () => {
      assert.equal(bodyText(await fetchPublicGoogleDoc(DOC_ID)), 'Draft text');
    }, { api });
  });

  test('a link to a tab the doc does not have is a clear error', async () => {
    await withFakeGoogle({}, async () => {
      await assert.rejects(() => fetchPublicGoogleDoc(DOC_ID, 't.nope'), /This doc has no tab "t\.nope"/);
    }, { api });
  });
});

describe('Doc export: one retry when Google stalls', () => {
  const HTML = '<html><body><h1>T</h1><p>Body</p></body></html>';
  const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

  // Scripted answers for the one-tab export; the all-tabs export always succeeds
  async function withScript(answers: Array<'timeout' | number>, run: (tabCalls: () => number) => Promise<void>) {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    let calls = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (!new URL(url).searchParams.get('tab')) return new Response(HTML, { status: 200 });
      const answer = answers[calls++] ?? 200;
      if (answer === 'timeout') throw timeout();
      return new Response(answer === 200 ? HTML : '', { status: answer });
    }) as typeof fetch;
    try {
      await run(() => calls);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) process.env.GOOGLE_API_KEY = originalKey;
    }
  }

  test('a stalled export is retried once and the audit goes on', async () => {
    await withScript(['timeout', 200], async (tabCalls) => {
      const doc = await fetchPublicGoogleDoc(DOC_ID, 't.0');
      assert.ok('isHtml' in doc && doc.isHtml && doc.html === HTML);
      assert.equal(tabCalls(), 2);
    });
  });

  test('a 503 from Google is retried once', async () => {
    await withScript([503, 200], async (tabCalls) => {
      await fetchPublicGoogleDoc(DOC_ID, 't.0');
      assert.equal(tabCalls(), 2);
    });
  });

  test('a 404 is not retried: the doc really is not there', async () => {
    await withScript([404], async (tabCalls) => {
      await assert.rejects(() => fetchPublicGoogleDoc(DOC_ID, 't.0'), /Google Doc not found/);
      assert.equal(tabCalls(), 1);
    });
  });

  test('two stalls in a row still fail with a clear message', async () => {
    await withScript(['timeout', 'timeout'], async (tabCalls) => {
      await assert.rejects(() => fetchPublicGoogleDoc(DOC_ID, 't.0'), /timeout/);
      assert.equal(tabCalls(), 2);
    });
  });
});
