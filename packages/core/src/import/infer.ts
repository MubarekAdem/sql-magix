import type { Dialect } from '../types.js';

export interface InferredColumn {
  name: string;
  type: string;
  nullable: boolean;
}

/**
 * Infers a SQL column type from an array of sample values.
 */
export function inferColumnType(values: unknown[], dialect: Dialect = 'sqlite'): InferredColumn {
  let isAllInteger = true;
  let isAllNumeric = true;
  let isAllBoolean = true;
  let isAllDate = true;
  let hasNull = false;
  let sampleCount = 0;

  for (const v of values) {
    if (v === null || v === undefined || v === '') {
      hasNull = true;
      continue;
    }

    sampleCount++;
    const str = String(v).trim();

    // Check integer
    if (!/^-?\d+$/.test(str)) {
      isAllInteger = false;
    }

    // Check numeric/float
    if (!/^-?\d+(\.\d+)?$/.test(str)) {
      isAllNumeric = false;
    }

    // Check boolean
    if (!/^(true|false|1|0)$/i.test(str)) {
      isAllBoolean = false;
    }

    // Check ISO Date
    if (isNaN(Date.parse(str)) || !/\d{4}-\d{2}-\d{2}/.test(str)) {
      isAllDate = false;
    }
  }

  let type = 'TEXT';
  if (sampleCount > 0) {
    if (isAllInteger) {
      type = dialect === 'postgres' ? 'BIGINT' : dialect === 'mysql' ? 'INT' : 'INTEGER';
    } else if (isAllNumeric) {
      type = dialect === 'postgres' ? 'NUMERIC' : dialect === 'mysql' ? 'DOUBLE' : 'REAL';
    } else if (isAllBoolean) {
      type = dialect === 'mysql' ? 'TINYINT(1)' : 'BOOLEAN';
    } else if (isAllDate) {
      type = dialect === 'mysql' ? 'DATETIME' : 'TIMESTAMP';
    } else {
      type = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT';
    }
  }

  return {
    name: '',
    type,
    nullable: hasNull,
  };
}

/**
 * Generates CREATE TABLE and INSERT statements from parsed data rows.
 */
export function generateImportStatements(
  tableName: string,
  rows: Record<string, unknown>[],
  dialect: Dialect = 'sqlite'
): { createTableSql: string; insertSqls: string[] } {
  if (rows.length === 0) {
    throw new Error('No rows to import');
  }

  const columns = Object.keys(rows[0]);
  const inferredCols: InferredColumn[] = columns.map((colName) => {
    const values = rows.map((r) => r[colName]);
    const inferred = inferColumnType(values, dialect);
    return {
      ...inferred,
      name: colName,
    };
  });

  const quote = (name: string) => (dialect === 'mysql' ? `\`${name}\`` : `"${name}"`);

  // Build CREATE TABLE DDL
  const colDefs = inferredCols.map((c) => {
    const nullability = c.nullable ? '' : ' NOT NULL';
    return `  ${quote(c.name)} ${c.type}${nullability}`;
  });

  const createTableSql = `CREATE TABLE ${quote(tableName)} (\n${colDefs.join(',\n')}\n);`;

  // Build batch INSERT statements (batches of 100)
  const insertSqls: string[] = [];
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const colList = columns.map(quote).join(', ');
    const valueTuples = batch.map((row) => {
      const vals = columns.map((c) => {
        const v = row[c];
        if (v === null || v === undefined || v === '') return 'NULL';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'boolean') return v ? '1' : '0';
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `(${vals.join(', ')})`;
    });

    insertSqls.push(`INSERT INTO ${quote(tableName)} (${colList}) VALUES\n  ${valueTuples.join(',\n  ')};`);
  }

  return {
    createTableSql,
    insertSqls,
  };
}
