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

export function copyText(text: string): Promise<boolean> {
  if (!text) return Promise.resolve(false);
  try {
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

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

export function semanticTagsForInlineStyle(style: {
  fontWeight?: string;
  fontStyle?: string;
  textDecorationLine?: string;
  textDecoration?: string;
}): string[] {
  const tags: string[] = [];
  const weight = (style.fontWeight || '').trim().toLowerCase();
  if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) tags.push('strong');

  const fontStyle = (style.fontStyle || '').trim().toLowerCase();
  if (fontStyle === 'italic' || fontStyle === 'oblique') tags.push('em');

  const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`.toLowerCase();
  if (decoration.includes('line-through')) tags.push('del');
  if (decoration.includes('underline')) tags.push('u');

  return tags;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HTML_NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™'
};

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return HTML_NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function sanitizeAndParseJsonLd(rawJsonLd: string): any {
  if (!rawJsonLd) return null;
  // 1. Remove CDATA wrappers
  let s = rawJsonLd
    .replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/$/gi, '')
    .replace(/^\s*<!\[CDATA\[|\]\]>\s*$/gi, '')
    .trim();

  // 2. Strip JavaScript comments (block comments and line comments preserving urls)
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^\\:])\/\/.*$/gm, '$1').trim();

  // 3. Try standard parse first (optimal performance)
  try {
    return JSON.parse(s);
  } catch {
    // 4. Try stripping trailing commas before closing braces/brackets
    let fixed = s.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch {
      // 5. Decode HTML entities (e.g. &quot;, &#34;) and retry
      fixed = decodeHtmlEntities(fixed).replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(fixed);
    }
  }
}



export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildFaqSchemaMarkup(faqEntries: FaqEntry[]): string {
  const filledEntries = faqEntries
    .map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() }))
    .filter(({ question, answer }) => question && answer);

  if (filledEntries.length === 0) return '';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: filledEntries.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  const schemaJson = JSON.stringify(faqSchema, null, 2).replace(/<\/(script)/gi, '<\\/$1');
  return `<script type="application/ld+json">\n${schemaJson}\n</script>`;
}
