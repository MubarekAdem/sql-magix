import type {
  DbAdapter,
  DbCapabilities,
  DatabaseSchema,
  Dialect,
  Plan,
  PlanNode,
  ResultSet,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  TriggerInfo,
} from '../types.js';
import { normalizeValue } from './url.js';

export interface PostgresAdapterOptions {
  connectionString: string;
  readOnly?: boolean;
  timeoutMs?: number;
}

export const POSTGRES_CAPABILITIES: DbCapabilities = {
  schemas: true,
  explain: true,
  pragma: false,
  createTable: true,
  alterTable: true,
  dropTable: true,
  views: true,
  triggers: true,
  indexes: true,
  foreignKeys: true,
  readOnly: false,
  exportDatabase: false,
  multipleDatabases: false,
  fullTextSearch: true,
  streaming: true,
};

/**
 * PostgreSQL Database Adapter.
 * Lazy-loads 'pg' driver and provides full catalog introspection and plan parsing.
 */
export class PostgresAdapter implements DbAdapter {
  readonly dialect: Dialect = 'postgres';
  public capabilities: DbCapabilities;
  private pool: any = null;
  private readonly options: PostgresAdapterOptions;

  constructor(options: PostgresAdapterOptions) {
    this.options = options;
    this.capabilities = {
      ...POSTGRES_CAPABILITIES,
      readOnly: !!options.readOnly,
    };
  }

  /**
   * Initializes PostgreSQL connection pool.
   */
  async init(): Promise<void> {
    const { Pool } = await import('pg');
    this.pool = new Pool({
      connectionString: this.options.connectionString,
      statement_timeout: this.options.timeoutMs || 10000, // 10s default timeout
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      if (this.capabilities.readOnly) {
        await client.query('SET default_transaction_read_only = on;');
      }
    } finally {
      client.release();
    }
  }

  async listSchemas(): Promise<string[]> {
    if (!this.pool) throw new Error('PostgresAdapter is not initialized');
    const res = await this.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
       ORDER BY schema_name;`
    );
    const schemas = res.rows.map((r) => String((r as any).schema_name));
    return schemas.length > 0 ? schemas : ['public'];
  }

  async getSchema(schemaName = 'public'): Promise<DatabaseSchema> {
    if (!this.pool) throw new Error('PostgresAdapter is not initialized');

    // 1. Tables & Views
    const tablesRes = await this.query(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_type, table_name;`,
      [schemaName]
    );

    // 2. Columns
    const columnsRes = await this.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = $1
       ORDER BY table_name, ordinal_position;`,
      [schemaName]
    );

    // 3. Primary Keys
    const pkRes = await this.query(
      `SELECT kcu.table_name, kcu.column_name, kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1
       ORDER BY kcu.table_name, kcu.ordinal_position;`,
      [schemaName]
    );

    // 4. Foreign Keys
    const fkRes = await this.query(
      `SELECT
         tc.table_name,
         kcu.column_name,
         ccu.table_name AS referenced_table,
         ccu.column_name AS referenced_column,
         rc.update_rule,
         rc.delete_rule
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       JOIN information_schema.referential_constraints AS rc
         ON rc.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1;`,
      [schemaName]
    );

    // 5. Indexes
    const idxRes = await this.query(
      `SELECT tablename, indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = $1;`,
      [schemaName]
    );

    // 6. Triggers
    const triggerRes = await this.query(
      `SELECT trigger_name, event_object_table, action_timing, event_manipulation, action_statement
       FROM information_schema.triggers
       WHERE trigger_schema = $1;`,
      [schemaName]
    );

    // Group columns by table
    const colMap = new Map<string, ColumnInfo[]>();
    for (const c of columnsRes.rows as any[]) {
      const list = colMap.get(c.table_name) || [];
      list.push({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
        primaryKey: false,
        defaultValue: c.column_default,
        ordinalPosition: c.ordinal_position,
      });
      colMap.set(c.table_name, list);
    }

    // Attach PKs
    const pkMap = new Map<string, string[]>();
    for (const pk of pkRes.rows as any[]) {
      const list = pkMap.get(pk.table_name) || [];
      list.push(pk.column_name);
      pkMap.set(pk.table_name, list);

      const cols = colMap.get(pk.table_name);
      const col = cols?.find((c) => c.name === pk.column_name);
      if (col) col.primaryKey = true;
    }

    // Group FKs
    const fkMap = new Map<string, ForeignKeyInfo[]>();
    for (const fk of fkRes.rows as any[]) {
      const list = fkMap.get(fk.table_name) || [];
      list.push({
        column: fk.column_name,
        referencedTable: fk.referenced_table,
        referencedColumn: fk.referenced_column,
        onUpdate: fk.update_rule,
        onDelete: fk.delete_rule,
      });
      fkMap.set(fk.table_name, list);
    }

    // Group Indexes
    const idxMap = new Map<string, IndexInfo[]>();
    for (const idx of idxRes.rows as any[]) {
      const list = idxMap.get(idx.tablename) || [];
      const isUnique = /CREATE\s+UNIQUE\s+INDEX/i.test(idx.indexdef);
      list.push({
        name: idx.indexname,
        columns: extractIndexColumns(idx.indexdef),
        unique: isUnique,
        primary: /_pkey$/i.test(idx.indexname),
        sql: idx.indexdef,
      });
      idxMap.set(idx.tablename, list);
    }

    const tables: TableInfo[] = [];
    const views: TableInfo[] = [];

    for (const t of tablesRes.rows as any[]) {
      const isView = t.table_type === 'VIEW';
      const info: TableInfo = {
        name: t.table_name,
        schema: schemaName,
        type: isView ? 'view' : 'table',
        columns: colMap.get(t.table_name) || [],
        primaryKey: pkMap.get(t.table_name),
        foreignKeys: fkMap.get(t.table_name) || [],
        indexes: idxMap.get(t.table_name) || [],
      };
      if (isView) {
        views.push(info);
      } else {
        tables.push(info);
      }
    }

    const triggers: TriggerInfo[] = (triggerRes.rows as any[]).map((trg) => ({
      name: trg.trigger_name,
      table: trg.event_object_table,
      timing: trg.action_timing,
      event: trg.event_manipulation,
      sql: trg.action_statement,
    }));

    return {
      tables,
      views,
      triggers,
      currentSchema: schemaName,
    };
  }

  async query(sql: string, params?: unknown[]): Promise<ResultSet> {
    if (!this.pool) throw new Error('PostgresAdapter is not initialized');

    const trimmed = sql.trim();
    if (this.capabilities.readOnly && isMutationQuery(trimmed)) {
      throw new Error('Database connection is read-only. Mutation statements are rejected.');
    }

    const start = performance.now();
    const result = await this.pool.query(trimmed, params);
    const end = performance.now();

    const columns = (result.fields || []).map((f: any) => ({ name: f.name }));
    const rows = result.rows.map((row: any) => {
      const normalized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[k] = normalizeValue(v);
      }
      return normalized;
    });

    return {
      columns,
      rows,
      rowCount: rows.length,
      affectedRows: result.rowCount ?? undefined,
      executionTimeMs: Math.round((end - start) * 100) / 100,
    };
  }

  async explain(sql: string): Promise<Plan> {
    if (!this.pool) throw new Error('PostgresAdapter is not initialized');
    const cleanSql = sql.replace(/;\s*$/, '');
    const explainSql = `EXPLAIN (FORMAT JSON, VERBOSE) ${cleanSql};`;
    const res = await this.query(explainSql);

    const rawPlan = (res.rows[0] as any)?.['QUERY PLAN'] || res.rows[0];
    const rootNode = Array.isArray(rawPlan) ? rawPlan[0]?.Plan : rawPlan?.Plan;

    return {
      dialect: 'postgres',
      raw: rawPlan,
      text: formatPostgresPlanText(rootNode),
      nodes: rootNode ? [parsePostgresNode(rootNode)] : [],
    };
  }

  quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

function extractIndexColumns(indexDef: string): string[] {
  const match = indexDef.match(/\(([^)]+)\)$/);
  if (!match) return [];
  return match[1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

function parsePostgresNode(node: any): PlanNode {
  const detail = `${node['Node Type']}${node['Relation Name'] ? ' on ' + node['Relation Name'] : ''}`;
  const children: PlanNode[] = (node['Plans'] || []).map((child: any) => parsePostgresNode(child));

  return {
    detail,
    operation: node['Node Type'],
    estimatedCost: node['Total Cost'],
    actualRows: node['Actual Rows'] ?? node['Plan Rows'],
    children: children.length > 0 ? children : undefined,
  };
}

function formatPostgresPlanText(node: any, indent = 0): string {
  if (!node) return 'No plan details available';
  const prefix = '  '.repeat(indent);
  let text = `${prefix}• ${node['Node Type']}`;
  if (node['Relation Name']) text += ` on ${node['Relation Name']}`;
  if (node['Total Cost']) text += ` (Cost: ${node['Total Cost']})`;
  text += '\n';

  for (const child of node['Plans'] || []) {
    text += formatPostgresPlanText(child, indent + 1);
  }
  return text;
}

function isMutationQuery(sql: string): boolean {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();
  const firstWord = stripped.split(/\s+/)[0]?.toUpperCase();
  return ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE', 'TRUNCATE'].includes(
    firstWord
  );
}
