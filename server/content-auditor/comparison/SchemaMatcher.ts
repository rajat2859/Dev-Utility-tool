import type { CheerioAPI } from 'cheerio';
import type { FaqSchemaCheck, SchemaComparison } from '../types/report';
import type { ReferenceSchemaBlock } from '../types/reference';
import { sanitizeAndParseJsonLd } from '../../../src/lib/utils';

const MAX_BLOCK_LINES = 400;
const LABEL = String.raw`(?:[\w&.-]+\s+){0,3}?(?:json-?ld\s+)?(?:schema|structured\s+data)(?:\s+(?:markup|code|script|snippet))?`;
const LABEL_PREFIX = new RegExp(String.raw`^\s*${LABEL}\s*[:\-–—]\s*`, 'i');
const LABEL_ONLY = new RegExp(String.raw`^\s*${LABEL}\s*:?\s*$`, 'i');

const straighten = (s: string) =>
  s.replace(/[“”„‟]/g, '"').replace(/[‘’]/g, "'").replace(/[​﻿]/g, '').replace(/ /g, ' ');

function parseJson(text: string): unknown {
  try {
    return sanitizeAndParseJsonLd(text) ?? undefined;
  } catch {
    return undefined;
  }
}

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
      if (!/"@(?:context|type)"/.test(json)) break;
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

const shortType = (t: string) => t.replace(/^.*[/:#]/, '');

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

export function collectPageSchemaTypes($: CheerioAPI): string[] {
  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    collectTypes(parseJson($(el).html() || ''), true, types);
  });
  return [...types];
}

const hasType = (obj: Record<string, unknown>, type: string) =>
  [obj['@type']].flat().some((t) => typeof t === 'string' && shortType(t) === type);

function findTyped(node: unknown, type: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) node.forEach((n) => findTyped(n, type, out));
  else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (hasType(obj, type)) out.push(obj);
    else Object.values(obj).forEach((v) => findTyped(v, type, out));
  }
  return out;
}

const nonEmpty = (v: unknown) => typeof v === 'string' && v.replace(/<[^>]*>/g, '').trim().length > 0;
const questionKey = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function auditFaqSchema($: CheerioAPI): FaqSchemaCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pages: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((i, el) => {
    const raw = $(el).html() || '';
    const json = parseJson(raw);
    if (json === undefined) {
      if (/FAQPage/.test(raw)) errors.push(`JSON-LD script #${i + 1} mentions FAQPage but is not valid JSON.`);
      return;
    }
    findTyped(json, 'FAQPage', pages);
  });

  const questions: string[] = [];
  pages.forEach((page) => {
    const entities = [page.mainEntity].flat().filter((e) => e != null);
    if (!entities.length) errors.push('FAQPage has no mainEntity questions.');
    entities.forEach((e, i) => {
      const n = `Question ${questions.length + 1}`;
      const q = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      if (!hasType(q, 'Question')) errors.push(`${n}: mainEntity item ${i + 1} is not @type "Question".`);
      if (!nonEmpty(q.name)) errors.push(`${n}: missing "name" (the question text).`);
      const answer = [q.acceptedAnswer].flat()[0] as Record<string, unknown> | undefined;
      if (!answer || typeof answer !== 'object') errors.push(`${n}: missing "acceptedAnswer".`);
      else {
        if (!hasType(answer, 'Answer')) errors.push(`${n}: acceptedAnswer is not @type "Answer".`);
        if (!nonEmpty(answer.text)) errors.push(`${n}: acceptedAnswer is missing "text".`);
      }
      questions.push(typeof q.name === 'string' ? q.name.trim() : '');
    });
  });
  if (pages.length > 1) warnings.push(`Page has ${pages.length} FAQPage blocks; Google reads only one per page.`);

  const keys = questions.map(questionKey);
  const dupes = keys.filter((k, i) => k && keys.indexOf(k) !== i);
  if (dupes.length) warnings.push(`${dupes.length} duplicate question(s) in the FAQ schema.`);

  return {
    present: pages.length > 0,
    valid: pages.length > 0 && errors.length === 0,
    questionCount: questions.length,
    errors,
    warnings,
  };
}

export function auditSchemas(blocks: ReferenceSchemaBlock[], pageTypes: string[]): SchemaComparison[] {
  const onPage = new Set(pageTypes);
  return blocks.map(({ json }) => {
    const types = [...collectTypes(json, false)];
    if (!types.length) return { types, status: 'INVALID', missingTypes: [] };
    const missingTypes = types.filter((t) => !onPage.has(t));
    return { types, status: missingTypes.length ? 'MISSING' : 'FOUND', missingTypes };
  });
}
