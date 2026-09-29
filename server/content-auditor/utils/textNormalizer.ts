/**
 * Shared text normalization utility used across Google Doc parser,
 * website DOM extractor, and deterministic comparator.
 *
 * Normalizes harmless differences:
 * - leading/trailing whitespace
 * - multiple consecutive spaces, tabs, line breaks -> single space
 * - non-breaking spaces (\u00A0, \u2007, \u202F) -> space
 * - zero-width characters (\u200B, \u200C, \u200D, \uFEFF) -> stripped
 * - HTML entities (&amp;, &quot;, &lt;, &gt;, &#39;, &nbsp;, etc.) -> decoded
 * - smart quotes/dashes normalized
 */
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

/**
 * Checks whether two strings are identical after shared normalization.
 */
export function areTextsMatching(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}
