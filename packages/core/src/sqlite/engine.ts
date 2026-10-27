import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type {
  DbAdapter,
  DbCapabilities,
  DatabaseSchema,
  Dialect,
  Plan,
  ResultSet,
  ColumnMeta,
} from '../types.js';
import { introspectSqliteSchema } from './introspection.js';
import { parseSqliteExplainPlan } from './explain.js';
import { quoteSqliteIdent } from './quote.js';

export interface SqliteEngineOptions {
  wasmUrl?: string;
  buffer?: Uint8Array | ArrayBuffer;
  readOnly?: boolean;
}

/**
 * SQLite capability flags in sql-magic
 */
export const SQLITE_CAPABILITIES: DbCapabilities = {
  schemas: false, // SQLite uses attached databases instead of schemas
  explain: true,
  pragma: true,
  createTable: true,
  alterTable: true,
  dropTable: true,
  views: true,
  triggers: true,
  indexes: true,
  foreignKeys: true,
  readOnly: false,
  exportDatabase: true,
  multipleDatabases: true,
  fullTextSearch: true,
  streaming: false,
};

let cachedSqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Retrieves or initializes the shared SqlJsStatic factory.
 * Caches the compiled WebAssembly instance across all SqliteEngine connections.
 */
export async function getSqlJsInstance(wasmUrl?: string): Promise<SqlJsStatic> {
  if (cachedSqlJsPromise) {
    return cachedSqlJsPromise;
  }

  const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  if (isNode && !wasmUrl) {
    cachedSqlJsPromise = initSqlJs();
    return cachedSqlJsPromise;
  }

  const locateFile = (file: string) => {
    if (wasmUrl) return wasmUrl;
    // Route any requested wasm binary (including sql-wasm-browser.wasm) to /sql-wasm.wasm
    if (file.endsWith('.wasm')) return '/sql-wasm.wasm';
    return file;
  };

  cachedSqlJsPromise = initSqlJs({ locateFile }).catch(async (err: unknown) => {
    if (!isNode) {
      console.warn('Local WASM binary could not be instantiated; falling back to CDN...', err);
      return initSqlJs({
        locateFile: () => 'https://sql.js.org/dist/sql-wasm.wasm',
      });
    }
    cachedSqlJsPromise = null;
    throw err;
  });

  return cachedSqlJsPromise;
}

export function resetSqlJsCache(): void {
  cachedSqlJsPromise = null;
}

/**
 * Core SQLite Engine that operates on sql.js Database instance.
 * Used both directly (in Node/tests) and inside Web Workers (in browser).
 */
export class SqliteEngine implements DbAdapter {
  readonly dialect: Dialect = 'sqlite';
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private readonly options: SqliteEngineOptions;
  public capabilities: DbCapabilities;

  constructor(options: SqliteEngineOptions = {}) {
    this.options = options;
    this.capabilities = {
      ...SQLITE_CAPABILITIES,
      readOnly: !!options.readOnly,
    };
  }

  /**
   * Initializes sql.js and opens the database
   */
  async init(): Promise<void> {
    if (!this.SQL) {
      this.SQL = await getSqlJsInstance(this.options.wasmUrl);
    }

    if (this.options.buffer) {
      this.loadBinary(this.options.buffer);
    } else {
      this.db = new this.SQL.Database();
    }
  }

  /**
   * Load raw database bytes (.db, .sqlite, .sqlite3 file)
   */
  loadBinary(buffer: Uint8Array | ArrayBuffer): void {
    if (!this.SQL) {
      throw new Error('SqliteEngine must be initialized before loading binary');
    }
    if (this.db) {
      this.db.close();
    }
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.db = new this.SQL.Database(data);
  }

  /**
   * Export the entire database as Uint8Array
   */
  exportBinary(): Uint8Array {
    if (!this.db) {
      throw new Error('Database is not open');
    }
    return this.db.export();
  }

  listSchemas(): Promise<string[]> {
    return Promise.resolve(['main']);
  }

  async getSchema(_schemaName?: string): Promise<DatabaseSchema> {
    if (!this.db) {
      throw new Error('Database is not open');
    }
    return introspectSqliteSchema((sql, params) => this.query(sql, params));
  }

  async query(sql: string, params?: unknown[]): Promise<ResultSet> {
    if (!this.db) {
      throw new Error('Database is not open');
    }

    const trimmed = sql.trim();
    if (this.capabilities.readOnly && isMutationQuery(trimmed)) {
      throw new Error('Database connection is read-only. Mutation statements are forbidden.');
    }

    const start = performance.now();

    try {
      if (params && params.length > 0) {
        // Prepared statement execution
        const stmt = this.db.prepare(trimmed);
        stmt.bind(params as (string | number | null | Uint8Array)[]);

        const rows: Record<string, unknown>[] = [];
        let columnNames: string[] = [];

        if (stmt.step()) {
          columnNames = stmt.getColumnNames();
          rows.push(stmt.getAsObject());
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
        } else {
          columnNames = stmt.getColumnNames();
        }

        stmt.free();
        const end = performance.now();
        const affected = this.db.getRowsModified();

        return {
          columns: columnNames.map((name) => ({ name })),
          rows,
          rowCount: rows.length,
          affectedRows: affected,
          executionTimeMs: Math.round((end - start) * 100) / 100,
        };
      }

      // Multi or single statement execution with db.exec
      const results = this.db.exec(trimmed);
      const end = performance.now();
      const affected = this.db.getRowsModified();

      if (results.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: affected,
          executionTimeMs: Math.round((end - start) * 100) / 100,
        };
      }

      // Return the last statement result set (standard for SQL query execution)
      const lastResult = results[results.length - 1];
      const columns: ColumnMeta[] = lastResult.columns.map((name) => ({ name }));
      const rows: Record<string, unknown>[] = lastResult.values.map((rowValues) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < lastResult.columns.length; i++) {
          obj[lastResult.columns[i]] = rowValues[i];
        }
        return obj;
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        affectedRows: affected,
        executionTimeMs: Math.round((end - start) * 100) / 100,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLite query execution error: ${message}`);
    }
  }

  async explain(sql: string): Promise<Plan> {
    if (!this.db) {
      throw new Error('Database is not open');
    }
    const cleanSql = sql.replace(/;\s*$/, '');
    const explainSql = `EXPLAIN QUERY PLAN ${cleanSql};`;
    const res = await this.query(explainSql);
    return parseSqliteExplainPlan(res.rows as any);
  }

  quoteIdent(name: string): string {
    return quoteSqliteIdent(name);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Basic check for mutation statements when in read-only mode
 */
function isMutationQuery(sql: string): boolean {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();
  const firstWord = stripped.split(/\s+/)[0]?.toUpperCase();
  return ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE', 'TRUNCATE'].includes(
    firstWord
  );
}
