import type { CheerioAPI } from 'cheerio';
import type { SchemaItem } from './types';
import { sanitizeAndParseJsonLd } from '../../src/lib/utils';

interface Rule {
  required?: string[];
  oneOf?: string[];
  recommended?: string[];
  rich?: string;
}

const RULES: Record<string, Rule> = {
  Article: { recommended: ['author', 'datePublished', 'headline', 'image', 'dateModified'], rich: 'Article' },
  Product: { required: ['name'], oneOf: ['offers', 'review', 'aggregateRating'], recommended: ['image', 'description', 'brand', 'sku'], rich: 'Product snippet' },
  Offer: { oneOf: ['price', 'priceSpecification'], recommended: ['priceCurrency', 'availability'] },
  AggregateRating: { required: ['ratingValue'], oneOf: ['ratingCount', 'reviewCount'] },
  Review: { required: ['author', 'reviewRating'], rich: 'Review snippet' },
  Rating: { required: ['ratingValue'] },
  Organization: { recommended: ['name', 'url', 'logo', 'sameAs'], rich: 'Organization' },
  LocalBusiness: { required: ['name', 'address'], recommended: ['telephone', 'url', 'image', 'geo', 'priceRange', 'openingHoursSpecification'], rich: 'Local business' },
  Person: { recommended: ['name'] },
  WebSite: { recommended: ['name', 'url'] },
  BreadcrumbList: { required: ['itemListElement'], rich: 'Breadcrumb' },
  ListItem: { required: ['position'], oneOf: ['name', 'item'], recommended: ['item'] },
  FAQPage: { required: ['mainEntity'], rich: 'FAQ' },
  Question: { required: ['name', 'acceptedAnswer'] },
  Answer: { required: ['text'] },
  HowTo: { required: ['name', 'step'], rich: 'How-to' },
  Event: { required: ['name', 'startDate', 'location'], recommended: ['description', 'endDate', 'image', 'offers', 'eventStatus', 'organizer'], rich: 'Event' },
  Recipe: { required: ['name', 'image'], recommended: ['author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions', 'aggregateRating'], rich: 'Recipe' },
  VideoObject: { required: ['name', 'thumbnailUrl', 'uploadDate'], recommended: ['description', 'contentUrl', 'duration'], rich: 'Video' },
  JobPosting: { required: ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation'], recommended: ['validThrough', 'baseSalary', 'employmentType'], rich: 'Job posting' },
  SoftwareApplication: { required: ['name'], oneOf: ['aggregateRating', 'review'], recommended: ['offers', 'applicationCategory', 'operatingSystem'], rich: 'Software app' },
};

const ALIASES: Record<string, string> = {
  NewsArticle: 'Article', BlogPosting: 'Article', TechArticle: 'Article',
  WebApplication: 'SoftwareApplication', MobileApplication: 'SoftwareApplication',
  Restaurant: 'LocalBusiness', Store: 'LocalBusiness', Dentist: 'LocalBusiness', LegalService: 'LocalBusiness',
  ProfessionalService: 'LocalBusiness', RealEstateAgent: 'LocalBusiness', AutoRepair: 'LocalBusiness',
  HomeAndConstructionBusiness: 'LocalBusiness', MedicalBusiness: 'LocalBusiness',
  Corporation: 'Organization', NGO: 'Organization', EducationalOrganization: 'Organization',
};

const shortType = (t: string) => t.replace(/^.*[/:#]/, '');

const has = (obj: Record<string, unknown>, key: string) => {
  const v = obj[key];
  return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
};

function validate(obj: Record<string, unknown>, types: string[]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rich = new Set<string>();
  for (const type of types) {
    const rule = RULES[ALIASES[type] ?? type];
    if (!rule) continue;
    if (rule.rich) rich.add(rule.rich);
    rule.required?.filter((k) => !has(obj, k)).forEach((k) => errors.push(`${type}: missing required property "${k}"`));
    if (rule.oneOf && !rule.oneOf.some((k) => has(obj, k))) {
      errors.push(`${type}: missing required property, one of ${rule.oneOf.map((k) => `"${k}"`).join(', ')}`);
    }
    rule.recommended?.filter((k) => !has(obj, k)).forEach((k) => warnings.push(`${type}: missing recommended property "${k}"`));
  }
  return { errors, warnings, richResult: rich.size ? [...rich].join(', ') : undefined };
}

function collectJsonLd(node: unknown, out: SchemaItem[], depth: number) {
  if (Array.isArray(node)) return node.forEach((n) => collectJsonLd(n, out, depth));
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const types = [obj['@type']].flat().filter((t): t is string => typeof t === 'string').map(shortType);

  if (types.length) {
    out.push({ type: types.join(', '), format: 'JSON-LD', ...validate(obj, types), json: depth === 0 ? obj : undefined });
  } else if (depth === 0 && !obj['@graph']) {
    out.push({ type: '(none)', format: 'JSON-LD', errors: ['Missing "@type"'], warnings: [], json: obj });
  }
  collectJsonLd(obj['@graph'], out, 0);
  for (const [key, value] of Object.entries(obj)) {
    if (key !== '@context' && key !== '@graph') collectJsonLd(value, out, depth + 1);
  }
}

function collectMarkup(
  $: CheerioAPI,
  scope: string,
  typeAttr: string,
  propAttr: string,
  format: 'Microdata' | 'RDFa',
  out: SchemaItem[]
) {
  $(scope).each((_, el) => {
    const types = ($(el).attr(typeAttr) || '').split(/\s+/).filter(Boolean).map(shortType);
    if (!types.length) return;
    const props: Record<string, unknown> = {};
    $(el).find(`[${propAttr}]`).each((_, p) => {
      if ($(p).parent().closest(scope).get(0) !== el) return;
      const value = $(p).attr('content') || $(p).attr('href') || $(p).attr('src') || $(p).text().trim() || true;
      ($(p).attr(propAttr) || '').split(/\s+/).filter(Boolean).forEach((name) => (props[name] = value));
    });
    out.push({ type: types.join(', '), format, ...validate(props, types) });
  });
}

export function extractStructuredData($: CheerioAPI): { items: SchemaItem[]; errors: number; warnings: number } {
  const items: SchemaItem[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || '';
    if (!raw.trim()) return;
    try {
      const parsed = sanitizeAndParseJsonLd(raw);
      const before = items.length;
      collectJsonLd(parsed, items, 0);
      const context = JSON.stringify((Array.isArray(parsed) ? parsed[0] : parsed)?.['@context'] ?? '');
      if (items.length > before && !/schema\.org/i.test(context)) {
        items[before].warnings.push(context === '""' ? 'Missing "@context"' : 'Unrecognised "@context" (expected https://schema.org)');
      }
    } catch (e: any) {
      items.push({ type: 'Invalid JSON-LD', format: 'JSON-LD', errors: [`JSON syntax error: ${e.message}`], warnings: [], json: { raw: raw.trim().slice(0, 300) } });
    }
  });

  collectMarkup($, '[itemscope]', 'itemtype', 'itemprop', 'Microdata', items);
  collectMarkup($, '[typeof]', 'typeof', 'property', 'RDFa', items);

  return {
    items,
    errors: items.reduce((n, i) => n + i.errors.length, 0),
    warnings: items.reduce((n, i) => n + i.warnings.length, 0),
  };
}
