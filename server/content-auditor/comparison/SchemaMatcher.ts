import type { CheerioAPI } from 'cheerio';
import type { SchemaComparison } from '../types/report';
import type { ReferenceSchemaBlock } from '../types/reference';
import { sanitizeAndParseJsonLd } from '../../../src/lib/utils';

const MAX_BLOCK_LINES = 400;
// "Schema", "FAQ Schema", "Article Schema Markup:", "JSON-LD schema code", "Structured data - " ... the label above/before pasted code
const LABEL = String.raw`(?:[\w&.-]+\s+){0,3}?(?:json-?ld\s+)?(?:schema|structured\s+data)(?:\s+(?:markup|code|script|snippet))?`;
const LABEL_PREFIX = new RegExp(String.raw`^\s*${LABEL}\s*[:\-–—]\s*`, 'i');
const LABEL_ONLY = new RegExp(String.raw`^\s*${LABEL}\s*:?\s*$`, 'i');

// Google Docs autocorrects quotes to curly ones, which breaks JSON
const straighten = (s: string) =>
  s.replace(/[“”„‟]/g, '"').replace(/[‘’]/g, "'").replace(/[​﻿]/g, '').replace(/ /g, ' ');

function parseJson(text: string): unknown {
  try {
    return sanitizeAndParseJsonLd(text) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Index just past the first balanced {...} / [...] in `s`, or -1 if there is none or it isn't closed yet. */
function jsonEnd(s: string): number {
  const start = s.search(/[{[]/);
  if (start < 0) return -1;
  let depth = 0;
  let inString = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if ((c === '}' || c === ']') && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Finds JSON-LD schema pasted into a doc, as lines of text: either a `<script type="application/ld+json">`
 * block or bare JSON containing "@context"/"@type", optionally preceded by a "Schema:" label.
 * Returns the parsed blocks (json undefined = could not be parsed) and the line indexes they occupy.
 */
export function extractSchemaBlocks(lines: string[]): { blocks: ReferenceSchemaBlock[]; consumed: Set<number> } {
  const blocks: ReferenceSchemaBlock[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const first = straighten(lines[i]).replace(LABEL_PREFIX, '').trim();
    const isScript = /^<script\b[^>]*ld\+json/i.test(first);
    if (!isScript && !/^[{[]/.test(first)) continue;

    let text = first + '\n';
    for (let j = i; j < Math.min(lines.length, i + MAX_BLOCK_LINES); j++) {
      if (j > i) text += straighten(lines[j]) + '\n';
      const end = jsonEnd(text);
      if (end < 0) continue;

      const json = text.slice(text.search(/[{[]/), end);
      if (!/"@(?:context|type)"/.test(json)) break; // some other JSON, not schema
      let last = j;
      if (isScript && !/<\/script>/i.test(text.slice(end)) && /^<\/script>/i.test(lines[j + 1]?.trim() ?? '')) last = j + 1;
      const start = i > 0 && LABEL_ONLY.test(lines[i - 1]) ? i - 1 : i;
      for (let k = start; k <= last; k++) consumed.add(k);
      blocks.push({ json: parseJson(json) });
      i = last;
      break;
    }
  }
  return { blocks, consumed };
}

// "https://schema.org/FAQPage" / "schema:FAQPage" -> "FAQPage"
const shortType = (t: string) => t.replace(/^.*[/:#]/, '');

// deep=false: only what a block itself declares (top level + @graph). deep=true: every nested @type too.
function collectTypes(node: unknown, deep: boolean, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, deep, out));
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    [obj['@type']].flat().forEach((t) => typeof t === 'string' && out.add(shortType(t)));
    if (deep) Object.values(obj).forEach((v) => collectTypes(v, deep, out));
    else collectTypes(obj['@graph'], false, out);
  }
  return out;
}

/** Every schema.org @type found in the page's JSON-LD scripts. */
export function collectPageSchemaTypes($: CheerioAPI): string[] {
  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    collectTypes(parseJson($(el).html() || ''), true, types);
  });
  return [...types];
}

/**
 * Checks that the page carries every @type the doc's schema declares.
 * ponytail: type-level only, not property values. Add a deep diff of the JSON if exact schema copy matters.
 */
export function auditSchemas(blocks: ReferenceSchemaBlock[], pageTypes: string[]): SchemaComparison[] {
  const onPage = new Set(pageTypes);
  return blocks.map(({ json }) => {
    const types = [...collectTypes(json, false)];
    if (!types.length) return { types, status: 'INVALID', missingTypes: [] };
    const missingTypes = types.filter((t) => !onPage.has(t));
    return { types, status: missingTypes.length ? 'MISSING' : 'FOUND', missingTypes };
  });
}
