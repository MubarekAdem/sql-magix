import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteEngine } from '@sql-magic/core';
import { createServer } from '../src/index.js';

describe('@sql-magic/server HTTP API', () => {
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
});
