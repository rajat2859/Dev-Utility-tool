import * as cheerio from 'cheerio';
import type { IssueTab, Priority, SeoIssue, SeoPage } from './types';
import { descriptionPixelWidth, titlePixelWidth } from './pixelWidth';
import { extractStructuredData } from './structuredData';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function failedPage(address: string, error: string): SeoPage {
  return {
    address,
    error,
    title: [],
    titlePixels: 0,
    description: [],
    descriptionPixels: 0,
    h1: [],
    h2: [],
    canonical: [],
    robots: [],
    images: { total: 0, missingAltAttribute: [], missingAltText: [], altOver100: [] },
    structuredData: { items: [], errors: 0, warnings: 0 },
    issues: [],
  };
}

const urlKey = (raw: string, base: string) => {
  try {
    const u = new URL(raw, base);
    return u.origin + u.pathname.replace(/\/$/, '') + u.search;
  } catch {
    return raw;
  }
};

export function auditPage(html: string, address: string): SeoPage {
  const $ = cheerio.load(html);
  const texts = (selector: string) =>
    $(selector).map((_, el) => clean($(el).text())).get().filter(Boolean);

  const title = $('title')
    .filter((_, el) => !$(el).closest('svg').length)
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean);
  const description = $('meta[name="description" i]').map((_, el) => clean($(el).attr('content') || '')).get().filter(Boolean);
  const h1 = texts('h1');
  const h2 = texts('h2');
  const canonical = $('link[rel~="canonical" i]').map((_, el) => ($(el).attr('href') || '').trim()).get().filter(Boolean);
  const robots = $('meta[name="robots" i], meta[name="googlebot" i]')
    .map((_, el) => ($(el).attr('content') || '').toLowerCase().split(/[\s,]+/).filter(Boolean))
    .get() as string[];

  const images: SeoPage['images'] = { total: 0, missingAltAttribute: [], missingAltText: [], altOver100: [] };
  $('img').each((_, el) => {
    images.total++;
    const src = $(el).attr('src') || $(el).attr('data-src') || '(no src)';
    const alt = $(el).attr('alt');
    if (alt === undefined) images.missingAltAttribute.push(src);
    else if (!clean(alt)) images.missingAltText.push(src);
    else if (clean(alt).length > 100) images.altOver100.push(src);
  });

  const structuredData = extractStructuredData($);

  const titlePixels = titlePixelWidth(title[0] || '');
  const descriptionPixels = descriptionPixelWidth(description[0] || '');

  const issues: SeoIssue[] = [];
  const add = (tab: IssueTab, name: string, priority: Priority, detail?: string) => issues.push({ tab, name, priority, detail });
  const firstFew = (list: string[]) => list.slice(0, 3).join('; ') + (list.length > 3 ? `; +${list.length - 3} more` : '');

  // Page Titles
  if (!title.length) add('Page Titles', 'Missing', 'High', 'No <title> element, or it is empty.');
  else {
    const len = title[0].length;
    if (len > 60) add('Page Titles', 'Over 60 Characters', 'Medium', `${len} characters.`);
    if (len < 30) add('Page Titles', 'Below 30 Characters', 'Medium', `${len} characters.`);
    if (titlePixels > 561) add('Page Titles', 'Over 561 Pixels', 'Medium', `${titlePixels}px wide.`);
    if (titlePixels < 200) add('Page Titles', 'Below 200 Pixels', 'Medium', `${titlePixels}px wide.`);
    if (h1[0] && title[0].toLowerCase() === h1[0].toLowerCase()) add('Page Titles', 'Same as H1', 'Low');
    if (title.length > 1) add('Page Titles', 'Multiple', 'Medium', `${title.length} <title> elements.`);
  }

  // Meta Description
  if (!description.length) add('Meta Description', 'Missing', 'Low', 'No meta description.');
  else {
    const len = description[0].length;
    if (len > 155) add('Meta Description', 'Over 155 Characters', 'Low', `${len} characters.`);
    if (len < 70) add('Meta Description', 'Below 70 Characters', 'Low', `${len} characters.`);
    if (descriptionPixels > 985) add('Meta Description', 'Over 985 Pixels', 'Low', `${descriptionPixels}px wide.`);
    if (descriptionPixels < 400) add('Meta Description', 'Below 400 Pixels', 'Low', `${descriptionPixels}px wide.`);
    if (description.length > 1) add('Meta Description', 'Multiple', 'Low', `${description.length} meta descriptions.`);
  }

  // H1 / H2
  if (!h1.length) add('H1', 'Missing', 'High', 'No <h1> element, or it is empty.');
  else {
    if (h1[0].length > 70) add('H1', 'Over 70 Characters', 'Low', `${h1[0].length} characters.`);
    if (h1.length > 1) add('H1', 'Multiple', 'Low', `${h1.length} <h1> elements.`);
  }
  if (!h2.length) add('H2', 'Missing', 'Low', 'No <h2> element.');
  else {
    if (h2[0].length > 70) add('H2', 'Over 70 Characters', 'Low', `${h2[0].length} characters.`);
    if (h2.length > 1) add('H2', 'Multiple', 'Info', `${h2.length} <h2> elements.`);
  }

  // Images
  if (images.missingAltText.length) add('Images', 'Missing Alt Text', 'Medium', firstFew(images.missingAltText));
  if (images.missingAltAttribute.length) add('Images', 'Missing Alt Attribute', 'Medium', firstFew(images.missingAltAttribute));
  if (images.altOver100.length) add('Images', 'Alt Text Over 100 Characters', 'Low', firstFew(images.altOver100));

  // Canonicals
  if (!canonical.length) add('Canonicals', 'Missing', 'Medium', 'No <link rel="canonical">.');
  else {
    if (canonical.length > 1) add('Canonicals', 'Multiple', 'High', firstFew(canonical));
    if (/^https?:\/\//i.test(address) && urlKey(canonical[0], address) !== urlKey(address, address)) {
      add('Canonicals', 'Canonicalised', 'Info', `Points to ${canonical[0]}`);
    }
  }

  // Directives
  if (robots.includes('noindex') || robots.includes('none')) add('Directives', 'Noindex', 'High', robots.join(', '));
  if (robots.includes('nofollow') || robots.includes('none')) add('Directives', 'Nofollow', 'Medium', robots.join(', '));

  // Structured Data
  const parseErrors = structuredData.items.filter((i) => i.type === 'Invalid JSON-LD');
  const validated = structuredData.items.filter((i) => i.type !== 'Invalid JSON-LD');
  const errors = validated.flatMap((i) => i.errors);
  const warnings = validated.flatMap((i) => i.warnings);
  if (!structuredData.items.length) add('Structured Data', 'Missing', 'Info', 'No JSON-LD, Microdata or RDFa found.');
  if (parseErrors.length) add('Structured Data', 'Parse Errors', 'High', firstFew(parseErrors.flatMap((i) => i.errors)));
  if (errors.length) add('Structured Data', 'Validation Errors', 'High', firstFew(errors));
  if (warnings.length) add('Structured Data', 'Validation Warnings', 'Medium', firstFew(warnings));
  const rich = [...new Set(validated.map((i) => i.richResult).filter((r): r is string => !!r))];
  if (rich.length) add('Structured Data', 'Rich Result Feature Detected', 'Info', rich.join(', '));

  return { address, title, titlePixels, description, descriptionPixels, h1, h2, canonical, robots, images, structuredData, issues };
}
