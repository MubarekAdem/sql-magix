import type {
  DbAdapter,
  DbCapabilities,
  DatabaseSchema,
  Dialect,
  Plan,
  ResultSet,
  ColumnMeta,
} from '../types.js';
import { SQLITE_CAPABILITIES } from '../sqlite/engine.js';
import { introspectSqliteSchema } from '../sqlite/introspection.js';
import { parseSqliteExplainPlan } from '../sqlite/explain.js';
import { quoteSqliteIdent } from '../sqlite/quote.js';

export interface NodeSqliteOptions {
  readOnly?: boolean;
}

/**
 * Server SQLite Adapter for Node.js environments.
 * Uses native node:sqlite (DatabaseSync) with optional better-sqlite3 fallback.
 */
export class NodeSqliteAdapter implements DbAdapter {
  readonly dialect: Dialect = 'sqlite';
  public capabilities: DbCapabilities;
  private db: any = null;
  private readonly filepath: string;
  private readonly options: NodeSqliteOptions;

  constructor(filepath: string, options: NodeSqliteOptions = {}) {
    this.filepath = filepath;
    this.options = options;
    this.capabilities = {
      ...SQLITE_CAPABILITIES,
      readOnly: !!options.readOnly,
      streaming: true,
    };
  }

  /**
   * Initializes the native database connection.
   */
  async init(): Promise<void> {
    try {
      // 1. Try native node:sqlite (Node 22+)
      const { DatabaseSync } = await import('node:sqlite');
      this.db = new DatabaseSync(this.filepath, {
        readOnly: !!this.options.readOnly,
        open: true,
      });
      return;
    } catch {
      // 2. Try better-sqlite3 fallback if node:sqlite is unavailable
      try {
        const BetterSqlite3 = (await import('better-sqlite3' as any)).default;
        this.db = new BetterSqlite3(this.filepath, {
          readonly: !!this.options.readOnly,
        });
        return;
      } catch (err: unknown) {
        throw new Error(
          `Failed to initialize SQLite server adapter. Neither 'node:sqlite' nor 'better-sqlite3' could be loaded: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  listSchemas(): Promise<string[]> {
    return Promise.resolve(['main']);
  }

  async getSchema(_schemaName?: string): Promise<DatabaseSchema> {
    if (!this.db) {
      throw new Error('Database is not initialized. Call init() first.');
    }
    return introspectSqliteSchema((sql, params) => this.query(sql, params));
  }

  async query(sql: string, params?: unknown[]): Promise<ResultSet> {
    if (!this.db) {
      throw new Error('Database is not initialized. Call init() first.');
    }

    const trimmed = sql.trim();
    if (this.capabilities.readOnly && isMutationQuery(trimmed)) {
      throw new Error('Database connection is read-only. Mutation statements are forbidden.');
    }

    const start = performance.now();

    try {
      // Check if statement produces rows or is DDL / execution
      const isSelect = /^(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(trimmed);

      if (isSelect) {
        const stmt = this.db.prepare(trimmed);
        const rows: Record<string, unknown>[] = params && params.length > 0
          ? stmt.all(...(params as any[]))
          : stmt.all();

        const end = performance.now();

        // Extract column names from first row or stmt if available
        let columns: ColumnMeta[] = [];
        if (rows.length > 0) {
          columns = Object.keys(rows[0]).map((name) => ({ name }));
        }

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: Math.round((end - start) * 100) / 100,
        };
      }

      // Mutation or DDL statement
      if (params && params.length > 0) {
        const stmt = this.db.prepare(trimmed);
        const result = stmt.run(...(params as any[]));
        const end = performance.now();
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: result?.changes ?? 0,
          executionTimeMs: Math.round((end - start) * 100) / 100,
        };
      }

      // Execute batch / multi-statement via exec
      this.db.exec(trimmed);
      const end = performance.now();

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        affectedRows: 0,
        executionTimeMs: Math.round((end - start) * 100) / 100,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLite query execution error: ${message}`);
    }
  }

  async explain(sql: string): Promise<Plan> {
    if (!this.db) {
      throw new Error('Database is not initialized. Call init() first.');
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

function isMutationQuery(sql: string): boolean {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();
  const firstWord = stripped.split(/\s+/)[0]?.toUpperCase();
  return ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE', 'TRUNCATE'].includes(
    firstWord
  );
}
