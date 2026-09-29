/**
 * Extracts and validates a Google Docs document ID from a URL or raw ID string.
 *
 * Supported formats:
 * - https://docs.google.com/document/d/<DOCUMENT_ID>/edit
 * - https://docs.google.com/document/d/<DOCUMENT_ID>
 * - https://docs.google.com/document/u/0/d/<DOCUMENT_ID>/preview
 * - https://docs.google.com/document/d/<DOCUMENT_ID>/edit?usp=sharing&tab=t.0
 * - plain DOCUMENT_ID (base64url format, >= 25 alphanumeric chars with - and _)
 *
 * Rejects:
 * - Google Sheets URLs (docs.google.com/spreadsheets/...)
 * - Google Slides URLs (docs.google.com/presentation/...)
 * - Malformed links and non-Google-Doc URLs
 */
export function extractGoogleDocId(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Please provide a valid Google Doc URL.');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Please provide a valid Google Doc URL.');
  }

  if (trimmed.includes('docs.google.com/spreadsheets')) {
    throw new Error('This is a Google Sheets URL. Please provide a Google Doc URL.');
  }
  if (trimmed.includes('docs.google.com/presentation')) {
    throw new Error('This is a Google Slides URL. Please provide a Google Doc URL.');
  }

  const urlMatch = trimmed.match(
    /(?:docs\.google\.com\/document\/(?:u\/\d+\/)?d\/)([a-zA-Z0-9_-]+)/i
  );
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Accept raw document ID if it matches Google Doc ID patterns
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(
    'Invalid Google Doc URL. Expected format: https://docs.google.com/document/d/<DOCUMENT_ID>/edit'
  );
}
