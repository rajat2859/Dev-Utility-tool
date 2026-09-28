import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.resolve(process.cwd(), '.google-tokens.json');
const READONLY_DOCS_SCOPE = 'https://www.googleapis.com/auth/documents.readonly';

let oauth2ClientInstance: OAuth2Client | null = null;

/**
 * Initializes and returns the shared Google OAuth2Client.
 */
export function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    'http://localhost:2000/api/google/oauth/callback';

  if (!oauth2ClientInstance) {
    oauth2ClientInstance = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Load persisted tokens if available
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const raw = fs.readFileSync(TOKEN_PATH, 'utf-8');
        const tokens = JSON.parse(raw);
        oauth2ClientInstance.setCredentials(tokens);
      }
    } catch (err) {
      console.warn('[GoogleAuth] Failed to load saved tokens from disk:', err);
    }

    // Automatically persist refreshed tokens
    oauth2ClientInstance.on('tokens', (tokens) => {
      try {
        const existing = fs.existsSync(TOKEN_PATH)
          ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
          : {};
        const merged = { ...existing, ...tokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2), 'utf-8');
      } catch (saveErr) {
        console.warn('[GoogleAuth] Failed to persist refreshed tokens:', saveErr);
      }
    });
  }

  return oauth2ClientInstance;
}

/**
 * Checks whether Google OAuth credentials are configured in the environment.
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

/**
 * Returns current authentication status.
 */
export function getAuthStatus(): { authenticated: boolean; configured: boolean } {
  const configured = isGoogleOAuthConfigured();
  if (!configured) {
    return { authenticated: false, configured: false };
  }

  const client = getOAuth2Client();
  const creds = client.credentials;
  const hasToken = !!(creds && (creds.access_token || creds.refresh_token));

  return {
    authenticated: hasToken,
    configured: true,
  };
}

/**
 * Generates the Google OAuth authorization URL for offline access.
 */
export function generateAuthUrl(): string {
  if (!isGoogleOAuthConfigured()) {
    throw new Error(
      'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.'
    );
  }

  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [READONLY_DOCS_SCOPE],
    prompt: 'consent',
  });
}

/**
 * Handles the OAuth redirect callback, exchanges code for tokens, and persists them.
 */
export async function handleAuthCallback(code: string): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[GoogleAuth] Failed to persist tokens:', err);
  }
}

/**
 * Logs out the current user by clearing in-memory credentials and deleting token file.
 */
export function logout(): void {
  const client = getOAuth2Client();
  client.setCredentials({});

  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
  } catch (err) {
    console.warn('[GoogleAuth] Failed to remove token file on logout:', err);
  }
}

/**
 * Returns an authenticated Google Docs API client.
 * Throws if the user is not authenticated.
 */
export function getGoogleDocsClient() {
  const status = getAuthStatus();
  if (!status.authenticated) {
    throw new Error(
      'Not authenticated with Google. Please sign in with Google to access this document.'
    );
  }

  const auth = getOAuth2Client();
  return google.docs({ version: 'v1', auth });
}
