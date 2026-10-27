import type { Dialect } from '../types.js';
import { quoteSqliteIdent } from '../sqlite/quote.js';

export type ChangeType = 'update-cell' | 'insert-row' | 'delete-row';

export interface BaseChange {
  id: string;
  table: string;
  timestamp: number;
}

export interface UpdateCellChange extends BaseChange {
  type: 'update-cell';
  pkValues: Record<string, unknown>;
  column: string;
  oldValue: unknown;
  newValue: unknown;
  row?: Record<string, unknown>;
}

export interface InsertRowChange extends BaseChange {
  type: 'insert-row';
  values: Record<string, unknown>;
}

export interface DeleteRowChange extends BaseChange {
  type: 'delete-row';
  pkValues: Record<string, unknown>;
  row: Record<string, unknown>;
}

export type ChangeItem = UpdateCellChange | InsertRowChange | DeleteRowChange;

function quoteIdentifier(name: string, dialect: Dialect): string {
  if (dialect === 'mysql') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeLiteral(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Generates an executable SQL statement for a specific pending change.
 */
export function generateSqlForChange(change: ChangeItem, dialect: Dialect = 'sqlite'): string {
  const quotedTable = quoteIdentifier(change.table, dialect);

  switch (change.type) {
    case 'update-cell': {
      const quotedCol = quoteIdentifier(change.column, dialect);
      const valLiteral = escapeLiteral(change.newValue);

      const whereClauses = Object.entries(change.pkValues).map(
        ([pkCol, pkVal]) => `${quoteIdentifier(pkCol, dialect)} = ${escapeLiteral(pkVal)}`
      );

      if (whereClauses.length === 0) {
        if (change.row && Object.keys(change.row).length > 0) {
          const fallback = Object.entries(change.row)
            .filter(([_, v]) => v !== null && v !== undefined)
            .map(([col, val]) => `${quoteIdentifier(col, dialect)} = ${escapeLiteral(val)}`);
          if (fallback.length > 0) {
            return `UPDATE ${quotedTable} SET ${quotedCol} = ${valLiteral} WHERE ${fallback.slice(0, 3).join(' AND ')};`;
          }
        }
        return `UPDATE ${quotedTable} SET ${quotedCol} = ${valLiteral} WHERE ${quotedCol} = ${escapeLiteral(change.oldValue)};`;
      }

      return `UPDATE ${quotedTable} SET ${quotedCol} = ${valLiteral} WHERE ${whereClauses.join(' AND ')};`;
    }

    case 'insert-row': {
      const cols = Object.keys(change.values).filter((k) => change.values[k] !== undefined);
      if (cols.length === 0) {
        return `INSERT INTO ${quotedTable} DEFAULT VALUES;`;
      }

      const colList = cols.map((c) => quoteIdentifier(c, dialect)).join(', ');
      const valList = cols.map((c) => escapeLiteral(change.values[c])).join(', ');

      return `INSERT INTO ${quotedTable} (${colList}) VALUES (${valList});`;
    }

    case 'delete-row': {
      const whereClauses = Object.entries(change.pkValues).map(
        ([pkCol, pkVal]) => `${quoteIdentifier(pkCol, dialect)} = ${escapeLiteral(pkVal)}`
      );

      if (whereClauses.length === 0) {
        // Fallback: match all column values if no PK
        const fallbackClauses = Object.entries(change.row)
          .filter(([_, v]) => v !== null && v !== undefined)
          .map(([col, val]) => `${quoteIdentifier(col, dialect)} = ${escapeLiteral(val)}`);

        return `DELETE FROM ${quotedTable} WHERE ${fallbackClauses.slice(0, 3).join(' AND ')};`;
      }

      return `DELETE FROM ${quotedTable} WHERE ${whereClauses.join(' AND ')};`;
    }
  }
}

/**
 * Wraps an array of pending changes in a transactional SQL script.
 */
export function generateCommitScript(changes: ChangeItem[], dialect: Dialect = 'sqlite'): string {
  if (changes.length === 0) return '-- No changes to commit\n';

  const begin = dialect === 'mysql' ? 'START TRANSACTION;' : 'BEGIN TRANSACTION;';
  const commit = 'COMMIT;';

  const statements = changes.map((c) => generateSqlForChange(c, dialect));

  return [begin, ...statements, commit].join('\n');
}
