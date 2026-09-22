import type { FeatureImageComparison } from '../types/report';
import type { PageImage } from '../types/page';

function extractFilename(urlStr: string): string {
  if (!urlStr) return '';
  const clean = urlStr.split('?')[0].split('#')[0];
  const parts = clean.split('/');
  return (parts[parts.length - 1] || '').toLowerCase().trim();
}

function normalizeImageUrl(urlStr: string): string {
  if (!urlStr) return '';
  return urlStr
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function auditFeatureImage(
  expectedImage: string | undefined,
  detectedImages: PageImage[]
): FeatureImageComparison {
  if (!expectedImage || !expectedImage.trim()) {
    return {
      applicable: false,
      expected: 'No feature image specified in reference',
      actual: detectedImages[0]?.src || 'None detected',
      status: 'NOT_APPLICABLE',
      matches: true,
      evidence: 'No feature image specified in the reference document.',
    };
  }

  const cleanExpected = expectedImage.trim();
  const expFilename = extractFilename(cleanExpected);
  const normExpectedUrl = normalizeImageUrl(cleanExpected);

  // Ranked checks across all detected page images
  for (const img of detectedImages) {
    if (!img.src) continue;

    // 1. Exact URL
    if (img.src === cleanExpected) {
      return {
        applicable: true,
        expected: cleanExpected,
        actual: img.src,
        source: img.source,
        status: 'EXACT',
        matches: true,
        evidence: `Exact URL match found in ${img.source}`,
      };
    }

    // 2. Normalized URL (protocol, www, trailing slashes)
    if (normalizeImageUrl(img.src) === normExpectedUrl) {
      return {
        applicable: true,
        expected: cleanExpected,
        actual: img.src,
        source: img.source,
        status: 'NORMALIZED_MATCH',
        matches: true,
        evidence: `Normalized URL match found in ${img.source}`,
      };
    }

    // 3. Exact filename match (e.g. hero-banner.webp regardless of CDN domain/query strings)
    const actFilename = extractFilename(img.src);
    if (expFilename && actFilename && expFilename === actFilename && expFilename.length > 3) {
      return {
        applicable: true,
        expected: cleanExpected,
        actual: img.src,
        source: img.source,
        status: 'FILENAME_MATCH',
        matches: true,
        evidence: `Matching image asset filename "${expFilename}" found in ${img.source}`,
      };
    }
  }

  const primaryActual = detectedImages[0]?.src || '(No feature image found)';
  const primarySource = detectedImages[0]?.source;

  return {
    applicable: true,
    expected: cleanExpected,
    actual: primaryActual,
    source: primarySource,
    status: detectedImages.length > 0 ? 'MISMATCH' : 'MISSING',
    matches: false,
    evidence: detectedImages.length > 0
      ? `Primary image found in ${primarySource || 'page'} did not match expected asset.`
      : 'No matching or candidate images found on the webpage.',
  };
}
