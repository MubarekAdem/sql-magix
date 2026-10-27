import type { Dialect } from '../types.js';

export interface ColumnDefinition {
  name: string;
  type: string;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  defaultValue?: string;
  unique?: boolean;
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  foreignKeys?: {
    column: string;
    referencedTable: string;
    referencedColumn: string;
    onDelete?: string;
  }[];
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
}

function quote(name: string, dialect: Dialect): string {
  if (dialect === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Generates CREATE TABLE SQL tailored to the specified dialect.
 */
export function generateCreateTableSql(def: TableDefinition, dialect: Dialect = 'sqlite'): string {
  const lines: string[] = [];

  for (const col of def.columns) {
    let colSql = `${quote(col.name, dialect)} `;

    if (col.primaryKey && col.autoIncrement) {
      if (dialect === 'sqlite') {
        colSql += 'INTEGER PRIMARY KEY AUTOINCREMENT';
      } else if (dialect === 'postgres') {
        colSql += 'SERIAL PRIMARY KEY';
      } else {
        colSql += 'INT AUTO_INCREMENT PRIMARY KEY';
      }
    } else {
      colSql += col.type;
      if (col.primaryKey) colSql += ' PRIMARY KEY';
      if (col.nullable === false) colSql += ' NOT NULL';
      if (col.unique) colSql += ' UNIQUE';
      if (col.defaultValue !== undefined && col.defaultValue !== '') {
        colSql += ` DEFAULT ${col.defaultValue}`;
      }
    }
    lines.push(`  ${colSql}`);
  }

  // Foreign keys
  if (def.foreignKeys && def.foreignKeys.length > 0) {
    for (const fk of def.foreignKeys) {
      let fkSql = `FOREIGN KEY (${quote(fk.column, dialect)}) REFERENCES ${quote(fk.referencedTable, dialect)}(${quote(fk.referencedColumn, dialect)})`;
      if (fk.onDelete) fkSql += ` ON DELETE ${fk.onDelete}`;
      lines.push(`  ${fkSql}`);
    }
  }

  return `CREATE TABLE ${quote(def.name, dialect)} (\n${lines.join(',\n')}\n);`;
}

/**
 * Generates DROP TABLE SQL statement.
 */
export function generateDropTableSql(tableName: string, dialect: Dialect = 'sqlite'): string {
  return `DROP TABLE ${quote(tableName, dialect)};`;
}

/**
 * Generates CREATE INDEX SQL statement.
 */
export function generateCreateIndexSql(def: IndexDefinition, dialect: Dialect = 'sqlite'): string {
  const uniqueStr = def.unique ? 'UNIQUE ' : '';
  const colList = def.columns.map((c) => quote(c, dialect)).join(', ');
  return `CREATE ${uniqueStr}INDEX ${quote(def.name, dialect)} ON ${quote(def.table, dialect)} (${colList});`;
}

/**
 * Generates DROP INDEX SQL statement.
 */
export function generateDropIndexSql(
  indexName: string,
  tableName: string,
  dialect: Dialect = 'sqlite'
): string {
  if (dialect === 'mysql') {
    return `DROP INDEX ${quote(indexName, dialect)} ON ${quote(tableName, dialect)};`;
  }
  return `DROP INDEX ${quote(indexName, dialect)};`;
}

/**
 * Generates ALTER TABLE ADD COLUMN SQL statement.
 */
export function generateAddColumnSql(
  tableName: string,
  col: ColumnDefinition,
  dialect: Dialect = 'sqlite'
): string {
  let colSql = `${quote(col.name, dialect)} ${col.type}`;
  if (col.nullable === false) colSql += ' NOT NULL';
  if (col.defaultValue !== undefined && col.defaultValue !== '') {
    colSql += ` DEFAULT ${col.defaultValue}`;
  }
  return `ALTER TABLE ${quote(tableName, dialect)} ADD COLUMN ${colSql};`;
}

/**
 * Generates ALTER TABLE DROP COLUMN SQL statement.
 */
export function generateDropColumnSql(
  tableName: string,
  columnName: string,
  dialect: Dialect = 'sqlite'
): string {
  return `ALTER TABLE ${quote(tableName, dialect)} DROP COLUMN ${quote(columnName, dialect)};`;
}

/**
 * Generates ALTER TABLE RENAME TABLE SQL statement.
 */
export function generateRenameTableSql(
  oldName: string,
  newName: string,
  dialect: Dialect = 'sqlite'
): string {
  return `ALTER TABLE ${quote(oldName, dialect)} RENAME TO ${quote(newName, dialect)};`;
}
