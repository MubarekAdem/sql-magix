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
    '0.0.0.0',
    config.host.toLowerCase(),
  ]);

  return async (c, next) => {
    const reqHost = c.req.header('host');
    const origin = c.req.header('origin');

    // 0. Preflight & CORS Support for trusted local tooling
    let isAllowedOrigin = false;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (allowedHostNames.has(originUrl.hostname.toLowerCase())) {
          isAllowedOrigin = true;
          c.header('Access-Control-Allow-Origin', origin);
          c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-viewer-token');
          c.header('Access-Control-Allow-Credentials', 'true');
        }
      } catch {
        return c.text('Forbidden: Invalid Origin header', 403);
      }
    }

    // Always respond 204 to preflight OPTIONS requests from allowed origins (or general preflights)
    if (c.req.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin) {
        return c.text('Forbidden: Cross-site requests are rejected', 403);
      }
      return c.body(null, 204);
    }

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
    if (origin && !isAllowedOrigin) {
      return c.text('Forbidden: Cross-site requests are rejected', 403);
    }

    // 3. Token Authentication
    if (config.token) {
      // Check query parameter, Authorization header, x-viewer-token, or cookie
      const queryToken = c.req.query('token');
      const authHeader = c.req.header('authorization');
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const customToken = c.req.header('x-viewer-token');
      const cookieHeader = c.req.header('cookie') || '';
      const cookieToken = cookieHeader
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('sql_magic_token='))
        ?.split('=')[1];

      const providedToken = queryToken || bearerToken || customToken || cookieToken;

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
