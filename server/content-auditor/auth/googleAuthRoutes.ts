import { Router, type Request, type Response } from 'express';
import {
  getAuthStatus,
  generateAuthUrl,
  handleAuthCallback,
  logout,
} from './googleAuth';

export const googleAuthRouter = Router();

// GET /api/google/auth/status
googleAuthRouter.get('/auth/status', (_req: Request, res: Response) => {
  try {
    const status = getAuthStatus();
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({
      authenticated: false,
      configured: false,
      error: err.message || 'Failed to determine auth status',
    });
  }
});

// GET /api/google/auth/start
googleAuthRouter.get('/auth/start', (req: Request, res: Response) => {
  try {
    const authUrl = generateAuthUrl();
    const acceptsJson =
      req.query.format === 'json' ||
      (req.headers.accept && req.headers.accept.includes('application/json'));

    if (acceptsJson) {
      return res.json({ success: true, url: authUrl });
    }
    return res.redirect(authUrl);
  } catch (err: any) {
    return res.status(400).json({
      errorType: 'AUTH_CONFIG_MISSING',
      error: err.message || 'Failed to generate Google auth URL.',
    });
  }
});

// GET /api/google/oauth/callback
googleAuthRouter.get('/oauth/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    console.warn('[GoogleAuth] OAuth callback error:', error);
    return res.redirect(`/?google_auth=error&error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?google_auth=error&error=missing_code');
  }

  try {
    await handleAuthCallback(code);
    return res.redirect('/?google_auth=success');
  } catch (err: any) {
    console.error('[GoogleAuth] Token exchange failed:', err);
    return res.redirect(
      `/?google_auth=error&error=${encodeURIComponent(err.message || 'token_exchange_failed')}`
    );
  }
});

// POST /api/google/auth/logout
googleAuthRouter.post('/auth/logout', (_req: Request, res: Response) => {
  try {
    logout();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Failed to logout from Google.',
    });
  }
});
