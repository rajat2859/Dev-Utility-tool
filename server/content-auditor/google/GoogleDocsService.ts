import { google, type docs_v1 } from 'googleapis';

/**
 * Fetches a publicly accessible Google Doc using the backend Google API key.
 *
 * Requirements:
 * - Reads GOOGLE_API_KEY from backend environment only.
 * - If the document is restricted/private, returns a friendly actionable message.
 * - Handles 404, 429 rate limits, and network errors without exposing stack traces.
 */
export async function fetchPublicGoogleDoc(
  documentId: string
): Promise<docs_v1.Schema$Document> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'Google API key is not configured. Please set GOOGLE_API_KEY in your environment (.env file).'
    );
  }

  const docs = google.docs({ version: 'v1', auth: apiKey });

  try {
    const response = await docs.documents.get({
      documentId,
    });

    if (!response.data) {
      throw new Error('Google Docs API returned an empty response.');
    }

    return response.data;
  } catch (err: any) {
    const status = err.status || err.code || (err.response && err.response.status);

    if (status === 403) {
      throw new Error(
        'This Google Doc could not be read publicly.\n\nMake sure sharing is set to:\nAnyone with the link → Viewer'
      );
    }

    if (status === 404) {
      throw new Error(
        'Google Doc not found. Please check that the URL is correct and the document exists.'
      );
    }

    if (status === 429) {
      throw new Error(
        'Google Docs API rate limit exceeded. Please wait a moment and try again.'
      );
    }

    const message = err.message || 'Failed to fetch Google Doc.';
    if (message.includes('API key not valid')) {
      throw new Error(
        'The configured GOOGLE_API_KEY is invalid or does not have Google Docs API enabled in Google Cloud Console.'
      );
    }

    throw new Error(`Google Docs API error (${status || 'UNKNOWN'}): ${message}`);
  }
}
