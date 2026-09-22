import dns from 'node:dns/promises';

const BLOCKED_HOST_REGEX = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0|::1)$/i;

export function isPrivateIp(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (clean === 'localhost' || clean === '::1' || clean === '0.0.0.0') return true;
  if (/^127\./.test(clean)) return true;
  if (/^10\./.test(clean)) return true;
  if (/^192\.168\./.test(clean)) return true;
  if (/^169\.254\./.test(clean)) return true; // Link-local & cloud metadata 169.254.169.254
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(clean)) return true;
  if (/^(fc|fd|fe80)/i.test(clean)) return true;
  return false;
}

export async function validateSafeUrl(urlStr: string): Promise<{ valid: boolean; reason?: string; parsedUrl?: URL }> {
  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: `Disallowed protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.` };
    }

    const hostname = parsed.hostname;
    if (BLOCKED_HOST_REGEX.test(hostname) || isPrivateIp(hostname)) {
      return { valid: false, reason: `Access to private or local network host "${hostname}" is blocked for security.` };
    }

    // Resolve DNS to verify it doesn't resolve to private IP address (SSRF via DNS rebinding)
    try {
      const lookup = await dns.lookup(hostname);
      if (isPrivateIp(lookup.address)) {
        return { valid: false, reason: `Host "${hostname}" resolved to private IP "${lookup.address}", which is blocked.` };
      }
    } catch (dnsErr: any) {
      // If DNS lookup fails, let the fetch attempt handle standard ENOTFOUND error
    }

    return { valid: true, parsedUrl: parsed };
  } catch (err: any) {
    return { valid: false, reason: `Invalid URL: ${err.message || err}` };
  }
}
