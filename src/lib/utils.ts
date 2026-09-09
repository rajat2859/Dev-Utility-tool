import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

// navigator.clipboard rejects (insecure context, denied permission) and every
// call site was letting that surface as an unhandled rejection.
export function copyText(text: string): Promise<boolean> {
  if (!text) return Promise.resolve(false);
  try {
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

// crypto.getRandomValues without the modulo bias of `% n`: reject the tail of
// the 32-bit range that doesn't divide evenly.
export function randomInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
}

export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Word, Google Docs and most styled web pages express bold/italic/strike as
 * inline CSS rather than as tags. Maps that CSS back to the semantic tags it
 * meant, so a cleaner can promote it before stripping the style away.
 * Returned outermost-first.
 */
export function semanticTagsForInlineStyle(style: {
  fontWeight?: string;
  fontStyle?: string;
  textDecorationLine?: string;
  textDecoration?: string;
}): string[] {
  const tags: string[] = [];
  const weight = (style.fontWeight || '').trim().toLowerCase();
  // Numeric weights ship as "700"; keywords as "bold"/"bolder". 600 is the
  // threshold browsers themselves render as bold for most families.
  if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) tags.push('strong');

  const fontStyle = (style.fontStyle || '').trim().toLowerCase();
  if (fontStyle === 'italic' || fontStyle === 'oblique') tags.push('em');

  const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`.toLowerCase();
  if (decoration.includes('line-through')) tags.push('del');
  if (decoration.includes('underline')) tags.push('u');

  return tags;
}

/**
 * Escapes text for either an HTML text node or a double-quoted attribute value.
 * Covers both contexts with one pass, so serializers can't get one right and
 * the other wrong.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
