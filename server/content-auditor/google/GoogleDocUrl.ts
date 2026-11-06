/** The tab a doc link points at (…/edit?tab=t.abc123), if any. A doc with tabs shows one tab per link. */
export function extractGoogleDocTab(input: string): string | undefined {
  return /[?&#]tab=(t\.[\w-]+)/i.exec(input || '')?.[1];
}

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

  // "Publish to web" links (/document/d/e/2PACX-.../pub) carry a publish ID, not the doc ID
  if (/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/e\//i.test(trimmed)) {
    throw new Error(
      'This is a "Publish to web" link. Please use the document\'s share link instead (Share → Copy link), which looks like https://docs.google.com/document/d/<DOCUMENT_ID>/edit'
    );
  }

  const urlMatch = trimmed.match(
    /(?:docs\.google\.com\/document\/(?:u\/\d+\/)?d\/)([a-zA-Z0-9_-]+)/i
  );
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(
    'Invalid Google Doc URL. Expected format: https://docs.google.com/document/d/<DOCUMENT_ID>/edit'
  );
}
