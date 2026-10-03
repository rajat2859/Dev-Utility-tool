import type { CheerioAPI } from 'cheerio';
import type { AltTextComparison } from '../types/report';
import { normalizeText } from '../reference/ReferenceNormalizer';

// "Alt text: x", "Alt: x", "Image alt-text - x", "Feature image alt tag: x", "Alt text for image 2: x", "[Alt text: x]"
const ALT_TEXT_LINE =
  /^\s*\[?\s*(?:(?:feature(?:d)?|hero|banner|main|blog|thumbnail)\s+)?(?:(?:image|img|photo|picture)\s*\d*\s+)?(?:alt(?:ernative)?[\s-]*(?:text|tag|attribute)|alt)(?:\s*\([^)]{1,30}\))?(?:\s+for\s+[^:\-–—]{1,40}?)?\s*[:\-–—]\s*(.+)$/i;

/** Returns the alt text if the line is an "alt text" label line from a reference doc, else undefined. */
export function parseAltTextLine(line: string): string | undefined {
  const raw = line.match(ALT_TEXT_LINE)?.[1];
  if (!raw) return undefined;
  let alt = raw.replace(/\(\d+\s*chars?\)\s*$/i, '').trim();
  if (line.trimStart().startsWith('[')) alt = alt.replace(/\]$/, '');
  return alt.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim() || undefined;
}

/** The alt attribute of every <img> in the page source, duplicates kept. */
export function collectAltTexts($: CheerioAPI): string[] {
  return $('img[alt]').map((_, el) => $(el).attr('alt')!.trim()).get().filter(Boolean);
}

const key = (s: string) => normalizeText(s).toLowerCase();

/**
 * Checks every alt text listed in the reference against the alt attributes found on the page.
 * "duplicate" = the page carries it on more images than the reference lists it.
 */
export function auditAltTexts(expected: string[], pageAlts: string[]): AltTextComparison[] {
  const onPage = new Map<string, number>();
  for (const alt of pageAlts) onPage.set(key(alt), (onPage.get(key(alt)) || 0) + 1);

  const wanted = new Map<string, { text: string; count: number }>();
  for (const text of expected) {
    const k = key(text);
    if (!k) continue;
    const entry = wanted.get(k);
    if (entry) entry.count++;
    else wanted.set(k, { text: normalizeText(text), count: 1 });
  }

  return [...wanted].map(([k, { text, count }]) => {
    const pageCount = onPage.get(k) || 0;
    return {
      expected: text,
      status: pageCount > 0 ? 'FOUND' : 'MISSING',
      pageCount,
      expectedCount: count,
      duplicate: pageCount > count,
    };
  });
}
