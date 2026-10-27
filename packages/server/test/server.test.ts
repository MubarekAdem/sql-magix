import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteEngine } from 'sql-magic-core';
import { createServer } from '../src/index.js';

describe('sql-magic-server HTTP API', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = new SqliteEngine();
    await engine.init();
    await engine.query('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);');
    await engine.query("INSERT INTO products (name, price) VALUES ('Widget', 19.99);");
  });

  afterEach(async () => {
    await engine.close();
  });

  it('serves health check endpoint with dialect and capabilities', async () => {
    const app = createServer({ adapter: engine });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.dialect).toBe('sqlite');
    expect(data.capabilities.explain).toBe(true);
    expect(data.capabilities.schemas).toBe(false);
    expect(data.watching).toBe(false);
  });

  it('introspects schema via /api/schema', async () => {
    const app = createServer({ adapter: engine });
    const res = await app.request('/api/schema');
    expect(res.status).toBe(200);

    const schema = await res.json();
    expect(schema.tables.length).toBe(1);
    expect(schema.tables[0].name).toBe('products');
    expect(schema.tables[0].columns.length).toBe(3);
  });

  it('executes queries via /api/query', async () => {
    const app = createServer({ adapter: engine });
    const res = await app.request('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT * FROM products;' }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].name).toBe('Widget');
    expect(result.rows[0].price).toBe(19.99);
  });

  it('generates execution plan via /api/explain', async () => {
    const app = createServer({ adapter: engine });
    const res = await app.request('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT * FROM products WHERE price > 10;' }),
    });

    expect(res.status).toBe(200);
    const plan = await res.json();
    expect(plan.dialect).toBe('sqlite');
    expect(plan.nodes).toBeDefined();
  });

  it('enforces token authentication when configured', async () => {
    const app = createServer({ adapter: engine, token: 'secret-token-123' });

    // Request without token
    const unauthRes = await app.request('/api/schema');
    expect(unauthRes.status).toBe(401);

    // Request with valid token in Authorization header
    const authRes = await app.request('/api/schema', {
      headers: { Authorization: 'Bearer secret-token-123' },
    });
    expect(authRes.status).toBe(200);

    // Request with valid token in query param
    const queryAuthRes = await app.request('/api/schema?token=secret-token-123');
    expect(queryAuthRes.status).toBe(200);
  });

  it('handles /api/events gracefully without returning 404 when no watcher is active', async () => {
    const app = createServer({ adapter: engine });
    const res = await app.request('/api/events');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body?.getReader();
    const chunk = await reader?.read();
    const text = new TextDecoder().decode(chunk?.value);
    expect(text).toContain(': no-watcher');
    await reader?.cancel();
  });

  it('serves SPA fallback / with HTTP 200 when staticDir is provided', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sql-magix-ui-test-'));
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<!DOCTYPE html><html><body>SQL Magix UI</body></html>');

    try {
      const app = createServer({ adapter: engine, staticDir: tempDir });
      const res = await app.request('/');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('SQL Magix UI');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
