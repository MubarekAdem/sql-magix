/**
 * Supported SQL Dialects in sql-magic
 */
export type Dialect = 'sqlite' | 'postgres' | 'mysql';

/**
 * Feature capability flags supported by a specific adapter or database connection.
 * Used by UI components to dynamically adapt, show, or disable features.
 */
export interface DbCapabilities {
  /** Supports distinct database schemas or namespaces (e.g. Postgres schemas, MySQL databases) */
  schemas: boolean;
  /** Supports EXPLAIN / EXPLAIN QUERY PLAN */
  explain: boolean;
  /** Supports SQLite PRAGMA commands (foreign_key_check, integrity_check, vacuum, etc.) */
  pragma: boolean;
  /** Supports visual table creation */
  createTable: boolean;
  /** Supports visual table alteration */
  alterTable: boolean;
  /** Supports dropping tables */
  dropTable: boolean;
  /** Supports views listing and definitions */
  views: boolean;
  /** Supports triggers listing and definitions */
  triggers: boolean;
  /** Supports index listing and definitions */
  indexes: boolean;
  /** Supports foreign keys listing and navigation */
  foreignKeys: boolean;
  /** Indicates whether the current connection is strictly read-only */
  readOnly: boolean;
  /** Supports binary database export / download (e.g. SQLite WASM in browser) */
  exportDatabase: boolean;
  /** Supports attaching multiple databases in a single session */
  multipleDatabases: boolean;
  /** Supports Full-Text Search extensions (e.g. SQLite FTS5) */
  fullTextSearch: boolean;
  /** Supports client/server streaming of large result sets */
  streaming: boolean;
}

/**
 * Information about a single column within a table or view
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string | null;
  autoIncrement?: boolean;
  comment?: string;
  ordinalPosition?: number;
}

/**
 * Foreign key relationship information
 */
export interface ForeignKeyInfo {
  id?: number | string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate?: string;
  onDelete?: string;
}

/**
 * Index metadata on a table
 */
export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
  sql?: string;
}

/**
 * Database trigger metadata
 */
export interface TriggerInfo {
  name: string;
  table: string;
  timing?: 'BEFORE' | 'AFTER' | 'INSTEAD OF' | string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  sql: string;
}

/**
 * Metadata about a table or view in the database
 */
export interface TableInfo {
  name: string;
  schema?: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  primaryKey?: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
  sql?: string; // Original DDL statement if available
}

/**
 * Complete introspected schema of a database or schema namespace
 */
export interface DatabaseSchema {
  tables: TableInfo[];
  views: TableInfo[];
  triggers: TriggerInfo[];
  currentSchema?: string;
}

/**
 * Column descriptor in a query result set
 */
export interface ColumnMeta {
  name: string;
  type?: string;
}

/**
 * Result set returned by query execution
 */
export interface ResultSet<T = Record<string, unknown>> {
  columns: ColumnMeta[];
  rows: T[];
  rowCount: number;
  affectedRows?: number;
  executionTimeMs: number;
}

/**
 * Individual node in an EXPLAIN query plan hierarchy
 */
export interface PlanNode {
  id?: number | string;
  parent?: number | string;
  detail: string;
  operation?: string;
  estimatedCost?: number;
  actualRows?: number;
  children?: PlanNode[];
}

/**
 * Complete query execution plan structure
 */
export interface Plan {
  dialect: Dialect;
  raw: unknown;
  text?: string;
  nodes?: PlanNode[];
}

/**
 * Core Database Adapter interface implemented by all database drivers
 * (Browser SQLite WASM, Node SQLite, Postgres, MySQL)
 */
export interface DbAdapter {
  /** Database dialect */
  readonly dialect: Dialect;

  /** Capability flags indicating supported features */
  readonly capabilities: DbCapabilities;

  /**
   * List available schema or database names (e.g. Postgres schemas, MySQL databases).
   * For SQLite, returns empty list or ['main'].
   */
  listSchemas(): Promise<string[]>;

  /**
   * Retrieve full introspection metadata for tables, columns, indexes, foreign keys, triggers.
   */
  getSchema(schemaName?: string): Promise<DatabaseSchema>;

  /**
   * Execute an arbitrary SQL statement with optional parameterized values.
   */
  query(sql: string, params?: unknown[]): Promise<ResultSet>;

  /**
   * Produce an execution plan for a SQL statement.
   */
  explain(sql: string): Promise<Plan>;

  /**
   * Quote an identifier according to dialect rules (e.g. "ident" or `ident`).
   */
  quoteIdent(name: string): string;

  /**
   * Close connection and release resources.
   */
  close(): Promise<void>;
}
