import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createSecurityMiddleware, generateRandomToken } from '../src/security.js';

describe('Server Security Subsystem', () => {
  it('generates 32-character hex random startup tokens', () => {
    const token1 = generateRandomToken();
    const token2 = generateRandomToken();
    expect(token1).toHaveLength(32);
    expect(token2).toHaveLength(32);
    expect(token1).not.toBe(token2);
  });

  it('blocks DNS rebinding requests with foreign Host headers', async () => {
    const app = new Hono();
    app.use('*', createSecurityMiddleware({ host: '127.0.0.1', port: 3000 }));
    app.get('/test', (c) => c.text('ok'));

    // Malicious Host header (e.g., DNS rebinding attack)
    const attackRes = await app.request('/test', {
      headers: { host: 'attacker.com' },
    });
    expect(attackRes.status).toBe(403);
    const body = await attackRes.text();
    expect(body).toContain('DNS rebinding');

    // Legitimate local Host header
    const legitRes = await app.request('/test', {
      headers: { host: 'localhost:3000' },
    });
    expect(legitRes.status).toBe(200);
  });

  it('blocks cross-origin requests from untrusted origins', async () => {
    const app = new Hono();
    app.use('*', createSecurityMiddleware({ host: '127.0.0.1', port: 3000 }));
    app.get('/test', (c) => c.text('ok'));

    // Malicious Origin
    const crossOriginRes = await app.request('/test', {
      headers: {
        host: 'localhost:3000',
        origin: 'http://malicious-website.com',
      },
    });
    expect(crossOriginRes.status).toBe(403);
    const body = await crossOriginRes.text();
    expect(body).toContain('Cross-site');

    // Trusted local Origin
    const validOriginRes = await app.request('/test', {
      headers: {
        host: '127.0.0.1:3000',
        origin: 'http://127.0.0.1:3000',
      },
    });
    expect(validOriginRes.status).toBe(200);
  });

  it('validates startup token via query param and sets session cookie', async () => {
    const secret = 'test-token-xyz';
    const app = new Hono();
    app.use('*', createSecurityMiddleware({ host: '127.0.0.1', port: 3000, token: secret }));
    app.get('/api/data', (c) => c.json({ protected: true }));

    // Unauthenticated API call
    const unauthRes = await app.request('/api/data');
    expect(unauthRes.status).toBe(401);

    // Valid token in query param
    const authRes = await app.request(`/api/data?token=${secret}`);
    expect(authRes.status).toBe(200);
    const setCookie = authRes.headers.get('set-cookie');
    expect(setCookie).toContain(`sql_magic_token=${secret}`);

    // Subsequent call with cookie
    const cookieRes = await app.request('/api/data', {
      headers: { cookie: `sql_magic_token=${secret}` },
    });
    expect(cookieRes.status).toBe(200);
  });
});
