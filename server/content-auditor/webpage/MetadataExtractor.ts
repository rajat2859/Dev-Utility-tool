import type { CheerioAPI } from 'cheerio';
import type { PageImage } from '../types/page';
import { normalizeText } from '../reference/ReferenceNormalizer';

export interface PageMetadata {
  titleTag?: string;
  metaDescription?: string;
  canonical?: string;
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

export function extractPageMetadata($: CheerioAPI): {
  meta: PageMetadata;
  images: PageImage[];
} {
  // STRICT Fix 1: Only real <title> tag in <head> or anywhere
  const rawTitle = $('head title').first().text() || $('title').first().text();
  const titleTag = rawTitle ? normalizeText(rawTitle) : undefined;

  // STRICT Fix 2: Only <meta name="description">
  const rawDesc = $('meta[name="description" i]').attr('content');
  const metaDescription = rawDesc ? normalizeText(rawDesc) : undefined;

  // Canonical URL
  const canonical = $('link[rel="canonical" i]').attr('href')?.trim();

  // Open Graph
  const ogTitle = $('meta[property="og:title" i]').attr('content')?.trim();
  const ogDesc = $('meta[property="og:description" i]').attr('content')?.trim();
  const ogImage = $('meta[property="og:image" i]').attr('content')?.trim();
  const ogUrl = $('meta[property="og:url" i]').attr('content')?.trim();

  // Twitter
  const twTitle = ($('meta[name="twitter:title" i]').attr('content') || $('meta[property="twitter:title" i]').attr('content'))?.trim();
  const twDesc = ($('meta[name="twitter:description" i]').attr('content') || $('meta[property="twitter:description" i]').attr('content'))?.trim();
  const twImage = ($('meta[name="twitter:image" i]').attr('content') || $('meta[property="twitter:image" i]').attr('content'))?.trim();

  const meta: PageMetadata = {
    titleTag,
    metaDescription,
    canonical,
    openGraph: (ogTitle || ogDesc || ogImage || ogUrl) ? {
      title: ogTitle,
      description: ogDesc,
      image: ogImage,
      url: ogUrl,
    } : undefined,
    twitter: (twTitle || twDesc || twImage) ? {
      title: twTitle,
      description: twDesc,
      image: twImage,
    } : undefined,
  };

  // Feature Image candidates with ranked source attribution (Fix 24)
  const images: PageImage[] = [];

  if (ogImage) {
    images.push({ src: ogImage, source: 'og:image' });
  }
  if (twImage && twImage !== ogImage) {
    images.push({ src: twImage, source: 'twitter:image' });
  }

  // Look for hero / article images
  $('article img, main img, .hero img, [class*="hero"] img, [class*="banner"] img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    const alt = $(el).attr('alt')?.trim();
    if (src && !images.some((i) => i.src === src)) {
      images.push({ src, alt, source: 'hero' });
    }
  });

  // First content image fallback
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const alt = $(el).attr('alt')?.trim();
    if (src && !images.some((i) => i.src === src)) {
      images.push({ src, alt, source: 'first-content-image' });
    }
  });

  return { meta, images };
}
