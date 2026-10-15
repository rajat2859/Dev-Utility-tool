// Mapping of common HTML entities
const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&trade;': '™',
  '&copy;': '©',
  '&reg;': '®',
};

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&[a-zA-Z0-9#]+;/g, (match) => {
      if (HTML_ENTITIES[match]) return HTML_ENTITIES[match];
      if (match.startsWith('&#x') || match.startsWith('&#X')) {
        const hex = match.slice(3, -1);
        const code = parseInt(hex, 16);
        return !isNaN(code) ? String.fromCharCode(code) : match;
      }
      if (match.startsWith('&#')) {
        const dec = match.slice(2, -1);
        const code = parseInt(dec, 10);
        return !isNaN(code) ? String.fromCharCode(code) : match;
      }
      return match;
    });
}

export function normalizeText(text: string): string {
  if (!text) return '';
  return decodeHtmlEntities(text)
    // Non-breaking spaces and zero-width characters
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
    // Smart quotes and apostrophes
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    // Unicode dashes to standard hyphen
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Collapse all whitespace into single spaces
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalize(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeWords(text: string): string[] {
  return canonicalize(text)
    .split(' ')
    .filter((w) => w.length > 0);
}
