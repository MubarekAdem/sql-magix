import type {
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  TriggerInfo,
  ResultSet,
} from '../types.js';
import { quoteSqliteIdent } from './quote.js';

type QueryExecutor = (sql: string, params?: unknown[]) => Promise<ResultSet>;

interface MasterRow {
  name: string;
  type: 'table' | 'view' | 'trigger';
  tbl_name?: string;
  sql?: string;
}

interface TableInfoRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface ForeignKeyRow {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

interface IndexListRow {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

interface IndexInfoRow {
  seqno: number;
  cid: number;
  name: string;
}

/**
 * Introspects a SQLite database via SQL queries and PRAGMA statements.
 */
export async function introspectSqliteSchema(exec: QueryExecutor): Promise<DatabaseSchema> {
  const masterRes = await exec(
    `SELECT name, type, tbl_name, sql FROM sqlite_master
     WHERE name NOT LIKE 'sqlite_%'
     ORDER BY type, name;`
  );

  const masterRows = masterRes.rows as unknown as MasterRow[];
  const tableRows = masterRows.filter((r) => r.type === 'table');
  const viewRows = masterRows.filter((r) => r.type === 'view');
  const triggerRows = masterRows.filter((r) => r.type === 'trigger');

  const tables: TableInfo[] = [];
  const views: TableInfo[] = [];

  for (const item of tableRows) {
    const tableInfo = await introspectSqliteTable(exec, item.name, 'table', item.sql);
    tables.push(tableInfo);
  }

  for (const item of viewRows) {
    const viewInfo = await introspectSqliteTable(exec, item.name, 'view', item.sql);
    views.push(viewInfo);
  }

  const triggers: TriggerInfo[] = triggerRows.map((r) => ({
    name: r.name,
    table: r.tbl_name || '',
    sql: r.sql || '',
  }));

  return {
    tables,
    views,
    triggers,
    currentSchema: 'main',
  };
}

async function introspectSqliteTable(
  exec: QueryExecutor,
  tableName: string,
  type: 'table' | 'view',
  sql?: string
): Promise<TableInfo> {
  const quoted = quoteSqliteIdent(tableName);

  // 1. Column info
  const colRes = await exec(`PRAGMA table_info(${quoted});`);
  const colRows = colRes.rows as unknown as TableInfoRow[];

  const columns: ColumnInfo[] = colRows.map((col) => ({
    name: col.name,
    type: col.type || 'TEXT',
    nullable: col.notnull === 0,
    primaryKey: col.pk > 0,
    defaultValue: col.dflt_value,
    ordinalPosition: col.cid,
  }));

  const primaryKey = colRows
    .filter((col) => col.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((col) => col.name);

  // 2. Foreign keys (only relevant for tables)
  const foreignKeys: ForeignKeyInfo[] = [];
  if (type === 'table') {
    try {
      const fkRes = await exec(`PRAGMA foreign_key_list(${quoted});`);
      const fkRows = fkRes.rows as unknown as ForeignKeyRow[];
      for (const fk of fkRows) {
        foreignKeys.push({
          id: fk.id,
          column: fk.from,
          referencedTable: fk.table,
          referencedColumn: fk.to,
          onUpdate: fk.on_update,
          onDelete: fk.on_delete,
        });
      }
    } catch {
      // Ignored if PRAGMA foreign_key_list fails
    }
  }

  // 3. Indexes
  const indexes: IndexInfo[] = [];
  if (type === 'table') {
    try {
      const idxListRes = await exec(`PRAGMA index_list(${quoted});`);
      const idxListRows = idxListRes.rows as unknown as IndexListRow[];

      for (const idx of idxListRows) {
        const quotedIdx = quoteSqliteIdent(idx.name);
        const idxInfoRes = await exec(`PRAGMA index_info(${quotedIdx});`);
        const idxCols = (idxInfoRes.rows as unknown as IndexInfoRow[])
          .sort((a, b) => a.seqno - b.seqno)
          .map((c) => c.name);

        indexes.push({
          name: idx.name,
          columns: idxCols,
          unique: idx.unique === 1,
          primary: idx.origin === 'pk',
        });
      }
    } catch {
      // Ignored if PRAGMA index_list fails
    }
  }

  // 4. Approximate row count (safe execution)
  let rowCount: number | undefined;
  if (type === 'table') {
    try {
      const countRes = await exec(`SELECT COUNT(*) as cnt FROM ${quoted};`);
      if (countRes.rows.length > 0) {
        const countVal = (countRes.rows[0] as Record<string, unknown>).cnt;
        rowCount = typeof countVal === 'number' ? countVal : Number(countVal);
      }
    } catch {
      rowCount = undefined;
    }
  }

  return {
    name: tableName,
    schema: 'main',
    type,
    columns,
    primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
    foreignKeys,
    indexes,
    rowCount,
    sql,
  };
}
