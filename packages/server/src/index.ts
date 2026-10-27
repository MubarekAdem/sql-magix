import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { serve } from '@hono/node-server';
import type { DbAdapter } from '@sql-magic/core';
import { NodeSqliteAdapter, createAdapter, detectDialectFromUrl, maskConnectionString } from '@sql-magic/core/server';
import { createSecurityMiddleware, generateRandomToken } from './security.js';
import { DatabaseWatcher } from './watcher.js';
import { scanDirectoryForDatabases, type DatabaseFileInfo } from './scanner.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  targetPath?: string;
  adapter?: DbAdapter;
  token?: string;
  readOnly?: boolean;
  watch?: boolean;
  staticDir?: string;
}

export interface ViewerInstance {
  app: Hono;
  server: any;
  host: string;
  port: number;
  url: string;
  token?: string;
  watcher?: DatabaseWatcher;
  close: () => Promise<void>;
}

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

/**
 * Creates the Hono application for sql-magic server mode.
 */
export function createViewerApp(options: ServerOptions = {}) {
  const app = new Hono();
  const host = options.host || '127.0.0.1';
  const port = options.port || 3000;
  const token = options.token;

  // 1. Security Middleware (DNS rebinding, CSRF, Token auth)
  app.use('*', createSecurityMiddleware({ host, port, token }));

  // 2. Health & metadata check
  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      dialect: options.adapter?.dialect ?? 'none',
      capabilities: options.adapter?.capabilities,
      readOnly: !!options.readOnly,
      targetPath: options.targetPath,
    });
  });

  // 3. Database listing (if directory was passed)
  app.get('/api/databases', (c) => {
    if (!options.targetPath) {
      return c.json({ databases: [] });
    }
    const databases = scanDirectoryForDatabases(options.targetPath);
    return c.json({ databases });
  });

  // 3.1. Schemas listing (Postgres schemas, MySQL databases)
  app.get('/api/schemas', async (c) => {
    if (!options.adapter) {
      return c.json({ schemas: ['main'] });
    }
    try {
      const schemas = await options.adapter.listSchemas();
      return c.json({ schemas });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  // 3.2 Switch or connect database dynamically
  app.post('/api/connect', async (c) => {
    try {
      const { url, readOnly } = await c.req.json<{ url: string; readOnly?: boolean }>();
      if (!url || typeof url !== 'string') {
        return c.json({ error: 'Database connection URL or file path is required' }, 400);
      }

      const isReadOnly = readOnly !== undefined ? !!readOnly : !!options.readOnly;
      const newAdapter = await createAdapter(url, { readOnly: isReadOnly });

      if (options.adapter) {
        try {
          await options.adapter.close();
        } catch {
          // Ignore close error on previous adapter
        }
      }

      options.adapter = newAdapter;
      options.targetPath = url;
      options.readOnly = isReadOnly;

      const schema = await newAdapter.getSchema();
      return c.json({
        status: 'ok',
        dialect: newAdapter.dialect,
        capabilities: newAdapter.capabilities,
        targetPath: url,
        readOnly: isReadOnly,
        schema,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: `Connection failed: ${msg}` }, 500);
    }
  });

  // 4. Schema introspection
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

  // 5. Query execution
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

  // 6. Execution plan
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

  // 7. Server-Sent Events (SSE) for file watcher
  app.get('/api/events', (c) => {
    const watcher = (options as any)._watcher as DatabaseWatcher | undefined;
    if (!watcher) {
      return c.text('No active file watcher', 404);
    }

    return new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(': connected\n\n'));

          const unsubscribe = watcher.subscribe((evt) => {
            const data = JSON.stringify(evt);
            controller.enqueue(encoder.encode(`event: db-change\ndata: ${data}\n\n`));
          });

          c.req.raw.signal.addEventListener('abort', () => {
            unsubscribe();
          });
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    );
  });

  // 8. Serve built UI static files & SPA Fallback
  const staticRoot = options.staticDir || resolveDefaultUiDir();

  if (staticRoot && fs.existsSync(staticRoot)) {
    app.get('*', (c) => {
      const reqPath = c.req.path;
      const cleanPath = reqPath === '/' ? '/index.html' : reqPath;
      const filePath = path.join(staticRoot, cleanPath);

      // Dedicated handler for SQLite WASM binary
      if (reqPath === '/sql-wasm.wasm' || reqPath === '/sql-wasm-browser.wasm') {
        const wasmCandidates = [
          filePath,
          path.resolve(staticRoot, 'sql-wasm.wasm'),
          path.resolve(staticRoot, 'sql-wasm-browser.wasm'),
          path.resolve(__dirname, '../../../packages/ui/public/sql-wasm.wasm'),
          path.resolve(__dirname, '../../../packages/ui/public/sql-wasm-browser.wasm'),
          path.resolve(__dirname, '../../../packages/core/node_modules/sql.js/dist/sql-wasm.wasm'),
          path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
          path.resolve(process.cwd(), 'packages/ui/public/sql-wasm.wasm'),
        ];
        for (const wPath of wasmCandidates) {
          if (fs.existsSync(wPath) && fs.statSync(wPath).isFile()) {
            return new Response(fs.readFileSync(wPath), {
              headers: {
                'Content-Type': 'application/wasm',
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }
        }
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_MAP[ext] || 'application/octet-stream';
        const fileContent = fs.readFileSync(filePath);
        return new Response(fileContent, {
          headers: { 'Content-Type': mime },
        });
      }

      // Do NOT return index.html for missing static assets (.wasm, .js, .css, images)
      const ext = path.extname(cleanPath).toLowerCase();
      if (ext && ext !== '.html') {
        return c.text('Not Found', 404);
      }

      // SPA Fallback: serve index.html
      const indexPath = path.join(staticRoot, 'index.html');
      if (fs.existsSync(indexPath)) {
        return new Response(fs.readFileSync(indexPath), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      return c.text('Not Found', 404);
    });
  }

  return app;
}

/**
 * Resolves the default built UI directory whether installed as package or in monorepo.
 */
function resolveDefaultUiDir(): string | null {
  const candidates = [
    // Pre-built UI bundled alongside server dist
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../ui/dist'),
    path.resolve(process.cwd(), 'packages/ui/dist'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Programmatic API to start the SQL Magic viewer server.
 */
export async function startViewer(options: ServerOptions = {}): Promise<ViewerInstance> {
  const port = options.port || 3000;
  const host = options.host || '127.0.0.1';
  const token = options.token !== undefined ? options.token : generateRandomToken();

  // Warn if exposed to all network interfaces
  if (host === '0.0.0.0') {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  WARNING: Binding to 0.0.0.0 exposes sql-magic to your entire network.');
    console.warn('\x1b[33m%s\x1b[0m', '   Anyone with access to your network can execute queries via this server.');
  }

  let adapter = options.adapter;
  let watcher: DatabaseWatcher | undefined;

  // If a connection string or file path was provided, initialize adapter
  if (!adapter && options.targetPath) {
    const isUrl = /^(postgres(ql)?|mysql|mariadb|sqlite):\/\//i.test(options.targetPath);
    if (isUrl) {
      adapter = await createAdapter(options.targetPath, {
        readOnly: options.readOnly,
      });
    } else if (fs.existsSync(options.targetPath)) {
      const stat = fs.statSync(options.targetPath);
      if (stat.isFile()) {
        adapter = await createAdapter(options.targetPath, {
          readOnly: options.readOnly,
        });

        if (options.watch !== false) {
          watcher = new DatabaseWatcher(options.targetPath);
          watcher.start();
        }
      }
    }
  }

  const app = createViewerApp({
    ...options,
    host,
    port,
    token,
    adapter,
    ...(watcher ? { _watcher: watcher } : {}),
  } as any);

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });

  const url = token
    ? `http://${host}:${port}/?token=${token}`
    : `http://${host}:${port}`;

  return {
    app,
    server,
    host,
    port,
    url,
    token,
    watcher,
    close: async () => {
      if (watcher) watcher.close();
      if (adapter) await adapter.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

export const createServer = createViewerApp;
export * from './security.js';
export * from './watcher.js';
export * from './scanner.js';
