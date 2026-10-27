import crypto from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export interface SecurityConfig {
  token?: string;
  host: string;
  port: number;
}

/**
 * Generates a cryptographically secure random startup token.
 */
export function generateRandomToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Creates security middleware that enforces:
 * 1. Host header validation against DNS rebinding attacks
 * 2. Origin / Referer validation against CSRF
 * 3. Startup token validation
 */
export function createSecurityMiddleware(config: SecurityConfig): MiddlewareHandler {
  const allowedHostNames = new Set([
    '127.0.0.1',
    'localhost',
    '::1',
    config.host,
  ]);

  return async (c, next) => {
    const reqHost = c.req.header('host');

    // 1. Host Validation (DNS Rebinding protection)
    if (reqHost) {
      const hostWithoutPort = reqHost.split(':')[0].toLowerCase();
      if (config.host === '127.0.0.1' || config.host === 'localhost') {
        if (!allowedHostNames.has(hostWithoutPort)) {
          return c.text('Forbidden: Invalid Host header (DNS rebinding protection)', 403);
        }
      }
    }

    // 2. Origin Validation (Cross-Site Request Forgery protection)
    const origin = c.req.header('origin');
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (!allowedHostNames.has(originUrl.hostname.toLowerCase())) {
          return c.text('Forbidden: Cross-site requests are rejected', 403);
        }
      } catch {
        return c.text('Forbidden: Invalid Origin header', 403);
      }
    }

    // 3. Token Authentication
    if (config.token) {
      // Check query parameter, Authorization header, or cookie
      const queryToken = c.req.query('token');
      const authHeader = c.req.header('authorization');
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const cookieHeader = c.req.header('cookie') || '';
      const cookieToken = cookieHeader
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('sql_magic_token='))
        ?.split('=')[1];

      const providedToken = queryToken || bearerToken || cookieToken;

      if (providedToken !== config.token) {
        // If requesting API endpoint without valid token, deny
        if (c.req.path.startsWith('/api')) {
          return c.json({ error: 'Unauthorized: Invalid or missing startup token' }, 401);
        }
      }

      // If valid query token on page load, set HTTP cookie for subsequent requests
      if (queryToken === config.token) {
        c.header('Set-Cookie', `sql_magic_token=${config.token}; Path=/; SameSite=Strict; HttpOnly`);
      }
    }

    await next();
  };
}
