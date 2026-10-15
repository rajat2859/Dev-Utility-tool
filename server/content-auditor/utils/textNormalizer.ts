export function normalizeText(str: string): string {
  if (!str || typeof str !== 'string') return '';

  return str
    // 1. Remove zero-width characters
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // 2. Decode standard HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&(?:#39|apos);/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&(?:mdash|ndash);/g, '-')
    // 3. Replace non-breaking and special unicode spaces with standard space
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // 4. Normalize smart quotes and dashes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[–—]/g, '-')
    // 5. Collapse all consecutive whitespace (spaces, tabs, newlines) into a single space
    .replace(/\s+/g, ' ')
    .trim();
}

export function areTextsMatching(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}
