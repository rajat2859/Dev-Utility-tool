import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateIp,
  validateSafeUrl,
  fetchWithSafeRedirects,
  readBodyCapped,
  UnsafeUrlError,
} from '../webpage/PageSecurity';

// All cases here are offline: IP literals never hit DNS and hostnames use an injected resolver.
const publicResolver = async () => ['93.184.216.34'];

test('isPrivateIp: legitimate domains starting with fc/fd/fe80 are not private', () => {
  for (const host of ['fdic.gov', 'fcbarcelona.com', 'fe80-example.com', 'fcc.gov', 'fdaa.example.org']) {
    assert.equal(isPrivateIp(host), false, host);
  }
});

test('isPrivateIp: IPv4 private, loopback, link-local and CGNAT ranges are blocked', () => {
  const blocked = [
    '127.0.0.1', '127.255.255.254', '0.0.0.0', '0.1.2.3', '10.0.0.5', '10.255.255.255',
    '172.16.0.1', '172.20.1.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '100.127.255.255', 'localhost', 'LOCALHOST', 'app.localhost', 'db.internal', 'printer.local',
    'localhost.', 'localhost..', 'EVIL.LOCALHOST.', 'printer.local.',
  ];
  for (const host of blocked) assert.equal(isPrivateIp(host), true, host);
});

test('isPrivateIp: public IPv4 neighbours of private ranges are allowed', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '169.253.1.1', '192.169.0.1', '11.0.0.1']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('isPrivateIp: IPv6 literals (loopback, mapped, ULA, link-local) are blocked', () => {
  const blocked = [
    '::1', '[::1]', '::', '[::ffff:127.0.0.1]', '::ffff:127.0.0.1', '::ffff:7f00:1', '[::ffff:7f00:1]',
    '::ffff:10.0.0.1', '::ffff:a9fe:a9fe', 'fc00::1', 'fd12:3456:789a::1', 'fe80::1', 'febf::1', '[fe80::1%eth0]',
    '64:ff9b::7f00:1', '64:ff9b:1::7f00:1', '::ffff:0:7f00:1', '2002:7f00:1::', 'ff02::1',
  ];
  for (const ip of blocked) assert.equal(isPrivateIp(ip), true, ip);
});

test('isPrivateIp: public IPv6 literals are allowed', () => {
  for (const ip of ['2606:4700:4700::1111', '[2001:4860:4860::8888]', '::ffff:8.8.8.8', '::ffff:808:808']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('validateSafeUrl: public hostnames pass with an injected resolver', async () => {
  for (const url of ['https://fdic.gov/', 'https://www.fcbarcelona.com/en', 'http://fd.example.com:8080/x']) {
    const result = await validateSafeUrl(url, publicResolver);
    assert.equal(result.valid, true, url);
  }
});

test('validateSafeUrl: private literal URLs are blocked without DNS', async () => {
  const urls = [
    'http://127.0.0.1/', 'http://10.1.2.3/', 'http://172.16.0.1/', 'http://172.31.0.1/', 'http://192.168.0.1/',
    'http://169.254.169.254/latest/meta-data/', 'http://100.64.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/',
    'http://[fc00::1]/', 'http://[fe80::1]/', 'http://2130706433/', 'http://0x7f.1/', 'http://localhost:3000/',
  ];
  const neverCalled = async () => {
    throw new Error('resolver should not be needed for blocked literals');
  };
  for (const url of urls) {
    const result = await validateSafeUrl(url, neverCalled);
    assert.equal(result.valid, false, url);
  }
});

test('validateSafeUrl: rejects non-http protocols', async () => {
  assert.equal((await validateSafeUrl('file:///etc/passwd', publicResolver)).valid, false);
  assert.equal((await validateSafeUrl('ftp://example.com/', publicResolver)).valid, false);
});

test('validateSafeUrl: rejects a hostname if ANY resolved address is private', async () => {
  const mixed = async () => ['93.184.216.34', '10.0.0.8'];
  const result = await validateSafeUrl('https://rebind.example.com/', mixed);
  assert.equal(result.valid, false);
  assert.match(result.reason || '', /10\.0\.0\.8/);

  const mapped = async () => ['::ffff:7f00:1'];
  assert.equal((await validateSafeUrl('https://rebind2.example.com/', mapped)).valid, false);
});

test('validateSafeUrl: a DNS failure is not treated as unsafe', async () => {
  const failing = async () => {
    throw new Error('ENOTFOUND');
  };
  assert.equal((await validateSafeUrl('https://does-not-exist.example/', failing)).valid, true);
});

// --- fetchWithSafeRedirects (global fetch is mocked) ---------------------------------------------

async function withMockedFetch<T>(handler: (url: string) => Response, fn: (calls: string[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    assert.equal(init?.redirect, 'manual', 'redirects must be handled manually');
    return handler(url);
  }) as typeof fetch;
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const redirect = (location: string, status = 302) => new Response(null, { status, headers: { location } });
const offlineValidate = (url: string) => validateSafeUrl(url, publicResolver);

test('fetchWithSafeRedirects: rejects a redirect to a private address and never requests it', async () => {
  await withMockedFetch(
    (url) => (url === 'https://public.example.com/' ? redirect('http://169.254.169.254/latest/meta-data/') : new Response('secret')),
    async (calls) => {
      await assert.rejects(
        fetchWithSafeRedirects('https://public.example.com/', {}, { validate: offlineValidate }),
        (err: any) => err instanceof UnsafeUrlError && /Security validation failed/.test(err.message)
      );
      assert.deepEqual(calls, ['https://public.example.com/']);
    }
  );
});

test('fetchWithSafeRedirects: rejects a redirect to IPv4-mapped loopback and to localhost', async () => {
  for (const location of ['http://[::ffff:127.0.0.1]/admin', 'http://localhost:8080/', 'http://10.0.0.1/']) {
    await withMockedFetch(
      (url) => (url === 'https://public.example.com/' ? redirect(location, 301) : new Response('x')),
      async () => {
        await assert.rejects(fetchWithSafeRedirects('https://public.example.com/', {}, { validate: offlineValidate }), UnsafeUrlError);
      }
    );
  }
});

test('fetchWithSafeRedirects: rejects a private initial URL before any request is made', async () => {
  await withMockedFetch(
    () => new Response('x'),
    async (calls) => {
      await assert.rejects(fetchWithSafeRedirects('http://127.0.0.1:2000/api/health'), UnsafeUrlError);
      assert.equal(calls.length, 0);
    }
  );
});

test('fetchWithSafeRedirects: follows safe redirects (including relative ones) and reports the final URL', async () => {
  await withMockedFetch(
    (url) => {
      if (url === 'https://a.example.com/start') return redirect('/middle');
      if (url === 'https://a.example.com/middle') return redirect('https://b.example.com/end', 307);
      return new Response('done', { status: 200 });
    },
    async (calls) => {
      const { response, finalUrl } = await fetchWithSafeRedirects('https://a.example.com/start', {}, { validate: offlineValidate });
      assert.equal(await response.text(), 'done');
      assert.equal(finalUrl, 'https://b.example.com/end');
      assert.equal(calls.length, 3);
    }
  );
});

test('fetchWithSafeRedirects: stops after the maximum number of redirects', async () => {
  await withMockedFetch(
    (url) => redirect(`${url}x`),
    async (calls) => {
      await assert.rejects(
        fetchWithSafeRedirects('https://loop.example.com/', {}, { validate: offlineValidate, maxRedirects: 5 }),
        /Exceeded maximum redirect limit of 5/
      );
      assert.equal(calls.length, 6);
    }
  );
});

test('fetchWithSafeRedirects: redirect without Location header is an error', async () => {
  await withMockedFetch(
    () => new Response(null, { status: 302 }),
    async () => {
      await assert.rejects(fetchWithSafeRedirects('https://a.example.com/', {}, { validate: offlineValidate }), /without a Location header/);
    }
  );
});

test('readBodyCapped: returns small bodies and rejects oversized ones', async () => {
  const ok = await readBodyCapped(new Response('hello'), 1024);
  assert.equal(ok.toString('utf8'), 'hello');

  await assert.rejects(readBodyCapped(new Response('x'.repeat(2048)), 1024), /exceeds maximum allowed size/);
  await assert.rejects(
    readBodyCapped(new Response('x', { headers: { 'content-length': '999999999' } }), 1024),
    /exceeds maximum limit/
  );
});
