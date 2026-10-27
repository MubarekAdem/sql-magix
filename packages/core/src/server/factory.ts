import type { DbAdapter } from '../types.js';
import { detectDialectFromUrl } from './url.js';
import { NodeSqliteAdapter } from './sqlite.js';
import { PostgresAdapter } from './postgres.js';
import { MysqlAdapter } from './mysql.js';

export interface CreateAdapterOptions {
  readOnly?: boolean;
  timeoutMs?: number;
  database?: string;
}

/**
 * Universal Database Adapter Factory.
 * Automatically inspects the URL scheme or file path and initializes the appropriate driver.
 */
export async function createAdapter(
  target: string,
  options: CreateAdapterOptions = {}
): Promise<DbAdapter> {
  const dialect = detectDialectFromUrl(target);

  switch (dialect) {
    case 'postgres': {
      const adapter = new PostgresAdapter({
        connectionString: target,
        readOnly: options.readOnly,
        timeoutMs: options.timeoutMs,
      });
      await adapter.init();
      return adapter;
    }

    case 'mysql': {
      const adapter = new MysqlAdapter({
        connectionUri: target,
        database: options.database,
        readOnly: options.readOnly,
        timeoutMs: options.timeoutMs,
      });
      await adapter.init();
      return adapter;
    }

    case 'sqlite':
    default: {
      const cleanPath = target.replace(/^sqlite:\/\//i, '');
      const adapter = new NodeSqliteAdapter(cleanPath, {
        readOnly: options.readOnly,
      });
      await adapter.init();
      return adapter;
    }
  }
}
