import type { docs_v1 } from 'googleapis';

export type GoogleDocData =
  | (docs_v1.Schema$Document & { isHtml?: false })
  | { isHtml: true; html: string; title?: string };

/**
 * Fetches a publicly accessible Google Doc.
 *
 * Behavior:
 * - If GOOGLE_API_KEY is configured in backend environment, uses Google Docs API.
 * - If GOOGLE_API_KEY is missing or restricted, falls back to Google's public export
 *   for documents shared as "Anyone with the link can view".
 * - If the document is restricted/private, returns a friendly actionable message.
 */
export async function fetchPublicGoogleDoc(
  documentId: string
): Promise<GoogleDocData> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();

  // 1. If API key is present, attempt official Google Docs API v1 first
  if (apiKey) {
    try {
      const apiResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}?key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (apiResponse.ok) {
        return (await apiResponse.json()) as docs_v1.Schema$Document;
      }
      console.warn(
        `[GoogleDocsService] API key fetch failed (status ${apiResponse.status}), attempting public export fallback...`
      );
    } catch {
      console.warn('[GoogleDocsService] API key fetch failed, attempting public export fallback...');
    }
  }

  // 2. Fetch public document export (supported natively by Google Docs for shared links)
  try {
    const exportUrl = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/export?format=html`;
    const res = await fetch(exportUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (res.status === 404) {
      throw new Error(
        'Google Doc not found. Please check that the URL is correct and the document exists.'
      );
    }

    if (!res.ok) {
      throw new Error(`Google Doc export returned HTTP ${res.status}.`);
    }

    const html = await res.text();
    // Check if Google redirected to a sign-in wall (meaning link sharing is disabled)
    if (html.includes('ServiceLogin') || html.includes('accounts.google.com')) {
      throw new Error(
        'This Google Doc could not be read publicly.\n\nMake sure sharing is set to:\nAnyone with the link → Viewer'
      );
    }

    return { isHtml: true, html, title: '' };
  } catch (err: any) {
    const message = err.message || 'Failed to fetch Google Doc.';
    if (!apiKey) {
      throw new Error(
        `Google API key is not configured. Public document fetch failed: ${message}. Please set GOOGLE_API_KEY in your environment (.env file) or ensure sharing is set to "Anyone with the link → Viewer".`
      );
    }

    if (
      message.includes('Anyone with the link') ||
      message.includes('Google Doc not found')
    ) {
      throw err;
    }

    throw new Error(`Failed to fetch Google Doc: ${message}`);
  }
}

