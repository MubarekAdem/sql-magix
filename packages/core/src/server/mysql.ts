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

export interface MysqlAdapterOptions {
  connectionUri: string;
  database?: string;
  readOnly?: boolean;
  timeoutMs?: number;
}

export const MYSQL_CAPABILITIES: DbCapabilities = {
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
  multipleDatabases: true,
  fullTextSearch: true,
  streaming: true,
};

/**
 * MySQL & MariaDB Database Adapter.
 * Lazy-loads 'mysql2/promise' driver with full schema introspection and explain plan parser.
 */
export class MysqlAdapter implements DbAdapter {
  readonly dialect: Dialect = 'mysql';
  public capabilities: DbCapabilities;
  private pool: any = null;
  private readonly options: MysqlAdapterOptions;
  private activeDatabase: string = '';

  constructor(options: MysqlAdapterOptions) {
    this.options = options;
    this.capabilities = {
      ...MYSQL_CAPABILITIES,
      readOnly: !!options.readOnly,
    };
  }

  /**
   * Initializes connection pool with mysql2.
   */
  async init(): Promise<void> {
    const mysql = await import('mysql2/promise');
    this.pool = mysql.createPool({
      uri: this.options.connectionUri,
      database: this.options.database,
      waitForConnections: true,
      connectionLimit: 10,
    });

    // Determine initial active database
    try {
      const res = await this.query('SELECT DATABASE() as db;');
      this.activeDatabase = String((res.rows[0] as any)?.db || '');
    } catch {
      // Ignored
    }
  }

  async listSchemas(): Promise<string[]> {
    if (!this.pool) throw new Error('MysqlAdapter is not initialized');
    const res = await this.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
       ORDER BY schema_name;`
    );
    const list = res.rows.map((r) => String((r as any).schema_name));
    return list.length > 0 ? list : [this.activeDatabase || 'default'];
  }

  async getSchema(schemaName?: string): Promise<DatabaseSchema> {
    if (!this.pool) throw new Error('MysqlAdapter is not initialized');
    const targetDb = schemaName || this.activeDatabase;
    if (!targetDb) {
      const schemas = await this.listSchemas();
      return this.getSchema(schemas[0]);
    }

    // 1. Tables & Views
    const tablesRes = await this.query(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = ?
       ORDER BY table_type, table_name;`,
      [targetDb]
    );

    // 2. Columns
    const columnsRes = await this.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position, column_key, extra
       FROM information_schema.columns
       WHERE table_schema = ?
       ORDER BY table_name, ordinal_position;`,
      [targetDb]
    );

    // 3. Primary & Foreign Keys
    const keysRes = await this.query(
      `SELECT
         table_name,
         column_name,
         referenced_table_name,
         referenced_column_name,
         constraint_name
       FROM information_schema.key_column_usage
       WHERE table_schema = ? AND referenced_table_name IS NOT NULL;`,
      [targetDb]
    );

    // 4. Indexes
    const idxRes = await this.query(
      `SELECT
         table_name,
         index_name,
         column_name,
         non_unique,
         seq_in_index
       FROM information_schema.statistics
       WHERE table_schema = ?
       ORDER BY table_name, index_name, seq_in_index;`,
      [targetDb]
    );

    // 5. Triggers
    const triggerRes = await this.query(
      `SELECT trigger_name, event_object_table, action_timing, event_manipulation, action_statement
       FROM information_schema.triggers
       WHERE trigger_schema = ?;`,
      [targetDb]
    );

    // Group columns by table
    const colMap = new Map<string, ColumnInfo[]>();
    const pkMap = new Map<string, string[]>();

    for (const c of columnsRes.rows as any[]) {
      const list = colMap.get(c.table_name) || [];
      const isPk = c.column_key === 'PRI';
      list.push({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
        primaryKey: isPk,
        defaultValue: c.column_default,
        autoIncrement: /auto_increment/i.test(c.extra || ''),
        ordinalPosition: c.ordinal_position,
      });
      colMap.set(c.table_name, list);

      if (isPk) {
        const pks = pkMap.get(c.table_name) || [];
        pks.push(c.column_name);
        pkMap.set(c.table_name, pks);
      }
    }

    // Group Foreign Keys
    const fkMap = new Map<string, ForeignKeyInfo[]>();
    for (const fk of keysRes.rows as any[]) {
      const list = fkMap.get(fk.table_name) || [];
      list.push({
        column: fk.column_name,
        referencedTable: fk.referenced_table_name,
        referencedColumn: fk.referenced_column_name,
      });
      fkMap.set(fk.table_name, list);
    }

    // Group Indexes
    const idxMap = new Map<string, IndexInfo[]>();
    for (const idx of idxRes.rows as any[]) {
      const list = idxMap.get(idx.table_name) || [];
      const existing = list.find((i) => i.name === idx.index_name);
      if (existing) {
        existing.columns.push(idx.column_name);
      } else {
        list.push({
          name: idx.index_name,
          columns: [idx.column_name],
          unique: idx.non_unique === 0,
          primary: idx.index_name === 'PRIMARY',
        });
      }
      idxMap.set(idx.table_name, list);
    }

    const tables: TableInfo[] = [];
    const views: TableInfo[] = [];

    for (const t of tablesRes.rows as any[]) {
      const isView = t.table_type === 'VIEW';
      const info: TableInfo = {
        name: t.table_name,
        schema: targetDb,
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
      currentSchema: targetDb,
    };
  }

  async query(sql: string, params?: unknown[]): Promise<ResultSet> {
    if (!this.pool) throw new Error('MysqlAdapter is not initialized');

    const trimmed = sql.trim();
    if (this.capabilities.readOnly && isMutationQuery(trimmed)) {
      throw new Error('Database connection is read-only. Mutation statements are rejected.');
    }

    const start = performance.now();
    const [result, fields] = await this.pool.query(trimmed, params);
    const end = performance.now();

    if (Array.isArray(result)) {
      // Result rows
      const columns = (fields || []).map((f: any) => ({ name: f.name }));
      const rows = result.map((row: any) => {
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
        executionTimeMs: Math.round((end - start) * 100) / 100,
      };
    }

    // OkPacket / ResultSetHeader
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: (result as any)?.affectedRows,
      executionTimeMs: Math.round((end - start) * 100) / 100,
    };
  }

  async explain(sql: string): Promise<Plan> {
    if (!this.pool) throw new Error('MysqlAdapter is not initialized');
    const cleanSql = sql.replace(/;\s*$/, '');
    const explainSql = `EXPLAIN FORMAT=JSON ${cleanSql};`;
    const res = await this.query(explainSql);

    let parsedPlan: any = null;
    try {
      const rawJson = (res.rows[0] as any)?.EXPLAIN;
      parsedPlan = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch {
      parsedPlan = res.rows;
    }

    return {
      dialect: 'mysql',
      raw: parsedPlan,
      text: JSON.stringify(parsedPlan, null, 2),
      nodes: extractMysqlPlanNodes(parsedPlan),
    };
  }

  quoteIdent(name: string): string {
    return `\`${name.replace(/`/g, '``')}\``;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

function extractMysqlPlanNodes(plan: any): PlanNode[] {
  if (!plan?.query_block) return [];
  const qb = plan.query_block;
  const nodes: PlanNode[] = [];

  if (qb.table) {
    nodes.push({
      detail: `${qb.table.table_name || 'table'} (${qb.table.access_type || 'scan'})`,
      operation: qb.table.access_type,
      estimatedCost: qb.cost_info?.query_cost,
      actualRows: qb.table.rows_examined_per_scan,
    });
  }

  return nodes;
}

function isMutationQuery(sql: string): boolean {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();
  const firstWord = stripped.split(/\s+/)[0]?.toUpperCase();
  return ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE', 'TRUNCATE'].includes(
    firstWord
  );
}
