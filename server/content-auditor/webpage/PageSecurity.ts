import dns from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Shared SSRF protection used by every route that fetches a user-supplied URL.
 *
 * Known limitation: validation resolves DNS itself, and the subsequent fetch resolves it again, so a
 * hostile DNS server could still answer differently the second time (DNS rebinding). Closing that
 * fully requires pinning the resolved address in the HTTP connection, which the global fetch cannot do.
 */

// Obvious non-public names. Real public domains such as fdic.gov or fcbarcelona.com must NOT match.
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.internal', '.local', '.localdomain'];

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.some((n) => Number.isNaN(n) || n > 255) ? null : nums;
}

function isPrivateIPv4Octets([a, b, c]: number[]): boolean {
  if (a === 0) return true; // 0.0.0.0/8 ("this" network)
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local & cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** Expands an IPv6 literal (with optional embedded dotted IPv4) into eight 16-bit groups. */
function parseIPv6(ip: string): number[] | null {
  let addr = ip;
  const zone = addr.indexOf('%');
  if (zone !== -1) addr = addr.slice(0, zone);

  // Convert an embedded dotted IPv4 tail into two hex groups.
  const lastColon = addr.lastIndexOf(':');
  const tail = addr.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    addr = `${addr.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function ipv4FromGroups(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

function isPrivateIPv6(ip: string): boolean {
  const g = parseIPv6(ip);
  if (!g) return true; // unparseable literal: fail closed
  const allZeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (allZeroUpTo(7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if (allZeroUpTo(5) && g[5] === 0xffff) return isPrivateIPv4Octets(ipv4FromGroups(g[6], g[7])); // IPv4-mapped ::ffff:a.b.c.d
  if (allZeroUpTo(4) && g[4] === 0xffff && g[5] === 0) return isPrivateIPv4Octets(ipv4FromGroups(g[6], g[7])); // IPv4-translated ::ffff:0:a.b.c.d
  if (allZeroUpTo(6)) return isPrivateIPv4Octets(ipv4FromGroups(g[6], g[7])); // deprecated IPv4-compatible ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isPrivateIPv4Octets(ipv4FromGroups(g[6], g[7])); // NAT64 64:ff9b::/96
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true; // local-use NAT64 64:ff9b:1::/48
  if (g[0] === 0x2002) return isPrivateIPv4Octets(ipv4FromGroups(g[1], g[2])); // 6to4 embeds IPv4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/**
 * True when the host (a hostname or an IPv4/IPv6 literal, brackets allowed) points at a loopback,
 * private, link-local or otherwise non-public destination. IPv6 prefix rules apply to IPv6
 * literals only, so domains that merely start with "fc"/"fd"/"fe80" are not affected.
 */
export function isPrivateIp(host: string): boolean {
  const clean = host.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!clean) return true;

  const family = isIP(clean.split('%')[0]);
  if (family === 4) {
    const octets = parseIPv4(clean);
    return octets ? isPrivateIPv4Octets(octets) : true;
  }
  if (family === 6) return isPrivateIPv6(clean);

  if (clean === 'localhost') return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => clean.endsWith(suffix));
}

export type HostResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const results = await dns.lookup(hostname, { all: true });
  return results.map((r) => r.address);
};

export interface SafeUrlResult {
  valid: boolean;
  reason?: string;
  parsedUrl?: URL;
}

/**
 * Validates protocol, host and DNS resolution. Every resolved address must be public. A failed
 * lookup is not treated as unsafe (the fetch will surface ENOTFOUND itself).
 * `resolver` exists so tests can run without network access.
 */
export async function validateSafeUrl(urlStr: string, resolver: HostResolver = defaultResolver): Promise<SafeUrlResult> {
  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: `Disallowed protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.` };
    }

    const hostname = parsed.hostname;
    if (isPrivateIp(hostname)) {
      return { valid: false, reason: `Access to private or local network host "${hostname}" is blocked for security.` };
    }

    // A literal IP needs no DNS; otherwise resolve ALL records (SSRF via DNS rebinding / multi-A records).
    if (!isIP(hostname.replace(/^\[|\]$/g, ''))) {
      let addresses: string[] = [];
      try {
        addresses = await resolver(hostname);
      } catch {
        // Let the fetch attempt handle the standard ENOTFOUND error.
      }
      const bad = addresses.find((address) => isPrivateIp(address));
      if (bad) {
        return { valid: false, reason: `Host "${hostname}" resolved to private IP "${bad}", which is blocked.` };
      }
    }

    return { valid: true, parsedUrl: parsed };
  } catch (err: any) {
    return { valid: false, reason: `Invalid URL: ${err.message || err}` };
  }
}

/** Thrown when a URL (or a redirect hop) fails SSRF validation. */
export class UnsafeUrlError extends Error {
  constructor(reason: string | undefined) {
    super(`Security validation failed: ${reason}`);
    this.name = 'UnsafeUrlError';
  }
}

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
export const MAX_SAFE_REDIRECTS = 5;

export interface SafeFetchOptions {
  maxRedirects?: number;
  /** Override for tests. Defaults to validateSafeUrl. */
  validate?: (url: string) => Promise<SafeUrlResult>;
}

/**
 * fetch() that validates the initial URL and every redirect hop against validateSafeUrl instead of
 * letting the runtime follow redirects blindly. Intended for GET requests (redirect bodies are not replayed).
 * Throws UnsafeUrlError when a hop is blocked. Returns the final response and its URL.
 */
export async function fetchWithSafeRedirects(
  url: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<{ response: Response; finalUrl: string }> {
  const maxRedirects = options.maxRedirects ?? MAX_SAFE_REDIRECTS;
  const validate = options.validate ?? validateSafeUrl;
  let currentUrl = url;

  for (let hops = 0; ; hops++) {
    const check = await validate(currentUrl);
    if (!check.valid) throw new UnsafeUrlError(check.reason);

    const response = await fetch(currentUrl, { ...init, redirect: 'manual' });
    if (!REDIRECT_STATUSES.includes(response.status)) {
      return { response, finalUrl: currentUrl };
    }

    try {
      await response.body?.cancel();
    } catch {
      // body already consumed or locked; nothing to release
    }
    if (hops >= maxRedirects) {
      throw new Error(`Exceeded maximum redirect limit of ${maxRedirects} redirects.`);
    }
    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`Server returned redirect status ${response.status} without a Location header.`);
    }
    currentUrl = new URL(location, currentUrl).toString();
  }
}

/** Reads a response body as bytes, aborting as soon as it exceeds maxBytes. */
export async function readBodyCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    throw new Error(`Response size (${Math.round(declared / 1024)} KB) exceeds maximum limit of ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds maximum allowed size of ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
