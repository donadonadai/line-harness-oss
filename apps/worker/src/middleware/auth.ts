import type { Context, Next } from 'hono';
import type { Env } from '../index.js';
import { verifyJwt } from '../services/jwt.js';

export async function authMiddleware(c: Context<Env>, next: Next): Promise<Response | void> {
  // Skip auth for the LINE webhook endpoint — it uses signature verification instead
  // Skip auth for OpenAPI docs — public documentation
  const path = new URL(c.req.url).pathname;
  if (
    path === '/webhook' ||
    path === '/docs' ||
    path === '/openapi.json' ||
    path === '/api/affiliates/click' ||
    path.startsWith('/t/') ||
    path.startsWith('/r/') ||
    path.startsWith('/api/liff/') ||
    path.startsWith('/auth/') ||
    path === '/api/integrations/stripe/webhook' ||
    path.match(/^\/api\/webhooks\/incoming\/[^/]+\/receive$/) ||
    path.match(/^\/api\/forms\/[^/]+\/submit$/) ||
    path.match(/^\/api\/forms\/[^/]+$/) || // GET form definition (public for LIFF)
    path === '/api/queue/checkin' || // LIFF queue check-in (public)
    path === '/api/queue/account-info' || // LIFF queue account info (public)
    path === '/api/prescriptions/submit' || // LIFF prescription submission (public)
    path === '/api/auth/login' || // Staff login (public)
    path === '/api/auth/setup' || // Initial admin setup (validates API_KEY internally)
    path === '/api/auth/check' // Check if setup is needed (public)
  ) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice('Bearer '.length);

  // Try JWT token first
  const jwtPayload = await verifyJwt(token, c.env.API_KEY);
  if (jwtPayload) {
    return next();
  }

  // Fallback: legacy API_KEY for backwards compatibility
  if (token === c.env.API_KEY) {
    return next();
  }

  return c.json({ success: false, error: 'Unauthorized' }, 401);
}
