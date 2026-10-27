import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { DbAdapter } from '@sql-magic/core';

export interface ServerOptions {
  port?: number;
  host?: string;
  adapter?: DbAdapter;
  token?: string;
  readOnly?: boolean;
}

export function createServer(options: ServerOptions = {}) {
  const app = new Hono();
  const token = options.token;

  // Security middleware: Token check if configured
  app.use('*', async (c, next) => {
    if (token) {
      const auth = c.req.header('Authorization') || c.req.query('token');
      if (auth !== token && auth !== `Bearer ${token}`) {
        return c.json({ error: 'Unauthorized: Invalid access token' }, 401);
      }
    }
    await next();
  });

  // Health check
  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      dialect: options.adapter?.dialect ?? 'none',
      capabilities: options.adapter?.capabilities,
    });
  });

  // Schema introspection
  app.get('/api/schema', async (c) => {
    if (!options.adapter) {
      return c.json({ error: 'No active database adapter' }, 400);
    }
    try {
      const schemaName = c.req.query('schema');
      const schema = await options.adapter.getSchema(schemaName);
      return c.json(schema);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  // Query execution
  app.post('/api/query', async (c) => {
    if (!options.adapter) {
      return c.json({ error: 'No active database adapter' }, 400);
    }
    try {
      const { sql, params } = await c.req.json<{ sql: string; params?: unknown[] }>();
      const result = await options.adapter.query(sql, params);
      return c.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  // Query explain plan
  app.post('/api/explain', async (c) => {
    if (!options.adapter) {
      return c.json({ error: 'No active database adapter' }, 400);
    }
    try {
      const { sql } = await c.req.json<{ sql: string }>();
      const plan = await options.adapter.explain(sql);
      return c.json(plan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  return app;
}

export function startServer(options: ServerOptions = {}) {
  const port = options.port || 3000;
  const host = options.host || '127.0.0.1';
  const app = createServer(options);

  return serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });
}
