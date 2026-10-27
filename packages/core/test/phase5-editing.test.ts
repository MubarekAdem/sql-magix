import { describe, it, expect, beforeEach } from 'vitest';
import {
  SqliteEngine,
  generateSqlForChange,
  generateCommitScript,
  inferColumnType,
  generateImportStatements,
  generateCreateTableSql,
  generateCreateIndexSql,
  generateDropTableSql,
  generateDropIndexSql,
  generateAddColumnSql,
  generateDropColumnSql,
  generateRenameTableSql,
  type UpdateCellChange,
  type InsertRowChange,
  type DeleteRowChange,
  type TableDefinition,
  type IndexDefinition,
} from '../src/index.js';

describe('Phase 5 - Changeset SQL Generation', () => {
  it('generates UPDATE SQL with primary key for sqlite, postgres, mysql', () => {
    const updateChange: UpdateCellChange = {
      id: 'c1',
      table: 'users',
      type: 'update-cell',
      timestamp: Date.now(),
      pkValues: { id: 42 },
      column: 'email',
      oldValue: 'old@example.com',
      newValue: 'new@example.com',
    };

    const sqliteSql = generateSqlForChange(updateChange, 'sqlite');
    expect(sqliteSql).toBe('UPDATE "users" SET "email" = \'new@example.com\' WHERE "id" = 42;');

    const pgSql = generateSqlForChange(updateChange, 'postgres');
    expect(pgSql).toBe('UPDATE "users" SET "email" = \'new@example.com\' WHERE "id" = 42;');

    const mysqlSql = generateSqlForChange(updateChange, 'mysql');
    expect(mysqlSql).toBe('UPDATE `users` SET `email` = \'new@example.com\' WHERE `id` = 42;');
  });

  it('generates INSERT SQL with column values', () => {
    const insertChange: InsertRowChange = {
      id: 'c2',
      table: 'items',
      type: 'insert-row',
      timestamp: Date.now(),
      values: { name: 'Gadget', price: 19.99, in_stock: true },
    };

    const sql = generateSqlForChange(insertChange, 'sqlite');
    expect(sql).toContain('INSERT INTO "items"');
    expect(sql).toContain('"name"');
    expect(sql).toContain('\'Gadget\'');
    expect(sql).toContain('19.99');
  });

  it('generates DELETE SQL with primary key', () => {
    const deleteChange: DeleteRowChange = {
      id: 'c3',
      table: 'orders',
      type: 'delete-row',
      timestamp: Date.now(),
      pkValues: { order_id: 101 },
      row: { order_id: 101, customer: 'John' },
    };

    const sql = generateSqlForChange(deleteChange, 'sqlite');
    expect(sql).toBe('DELETE FROM "orders" WHERE "order_id" = 101;');
  });

  it('wraps changes in atomic transaction script', () => {
    const changes = [
      {
        id: '1',
        table: 't1',
        type: 'update-cell' as const,
        timestamp: 1,
        pkValues: { id: 1 },
        column: 'val',
        oldValue: 1,
        newValue: 2,
      },
    ];

    const sqliteCommit = generateCommitScript(changes, 'sqlite');
    expect(sqliteCommit).toContain('BEGIN TRANSACTION;');
    expect(sqliteCommit).toContain('COMMIT;');

    const mysqlCommit = generateCommitScript(changes, 'mysql');
    expect(mysqlCommit).toContain('START TRANSACTION;');
    expect(mysqlCommit).toContain('COMMIT;');
  });
});

describe('Phase 5 - DDL Generator', () => {
  it('generates CREATE TABLE with various column options', () => {
    const def: TableDefinition = {
      name: 'products',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
        { name: 'title', type: 'TEXT', nullable: false },
        { name: 'price', type: 'REAL', defaultValue: '0.0' },
      ],
      foreignKeys: [
        {
          column: 'category_id',
          referencedTable: 'categories',
          referencedColumn: 'id',
          onDelete: 'CASCADE',
        },
      ],
    };

    const sqliteSql = generateCreateTableSql(def, 'sqlite');
    expect(sqliteSql).toContain('CREATE TABLE "products"');
    expect(sqliteSql).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(sqliteSql).toContain('"title" TEXT NOT NULL');
    expect(sqliteSql).toContain('FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE');

    const pgSql = generateCreateTableSql(def, 'postgres');
    expect(pgSql).toContain('"id" SERIAL PRIMARY KEY');

    const mysqlSql = generateCreateTableSql(def, 'mysql');
    expect(mysqlSql).toContain('`id` INT AUTO_INCREMENT PRIMARY KEY');
  });

  it('generates CREATE and DROP INDEX', () => {
    const idx: IndexDefinition = {
      name: 'idx_user_email',
      table: 'users',
      columns: ['email'],
      unique: true,
    };

    const createSql = generateCreateIndexSql(idx, 'sqlite');
    expect(createSql).toBe('CREATE UNIQUE INDEX "idx_user_email" ON "users" ("email");');

    const dropSqlSqlite = generateDropIndexSql('idx_user_email', 'users', 'sqlite');
    expect(dropSqlSqlite).toBe('DROP INDEX "idx_user_email";');

    const dropSqlMysql = generateDropIndexSql('idx_user_email', 'users', 'mysql');
    expect(dropSqlMysql).toBe('DROP INDEX `idx_user_email` ON `users`;');
  });

  it('generates ALTER TABLE statements (add column, drop column, rename)', () => {
    const addCol = generateAddColumnSql(
      'users',
      { name: 'phone', type: 'TEXT', nullable: true },
      'sqlite'
    );
    expect(addCol).toBe('ALTER TABLE "users" ADD COLUMN "phone" TEXT;');

    const dropCol = generateDropColumnSql('users', 'phone', 'postgres');
    expect(dropCol).toBe('ALTER TABLE "users" DROP COLUMN "phone";');

    const rename = generateRenameTableSql('old_table', 'new_table', 'sqlite');
    expect(rename).toBe('ALTER TABLE "old_table" RENAME TO "new_table";');
  });
});

describe('Phase 5 - Type Inference & CSV/JSON Import', () => {
  it('correctly infers types from raw data', () => {
    expect(inferColumnType([1, 2, 3], 'sqlite').type).toBe('INTEGER');
    expect(inferColumnType([1.5, 2.8, 3.0], 'sqlite').type).toBe('REAL');
    expect(inferColumnType([true, false, true], 'sqlite').type).toBe('BOOLEAN');
    expect(inferColumnType(['2026-01-01', '2026-02-15'], 'sqlite').type).toBe('TIMESTAMP');
    expect(inferColumnType(['hello', 'world'], 'sqlite').type).toBe('TEXT');
  });

  it('generates import statements for tabular data', () => {
    const rows = [
      { name: 'Apple', count: 10, organic: true },
      { name: 'Banana', count: 25, organic: false },
    ];

    const result = generateImportStatements('fruits', rows, 'sqlite');
    expect(result.createTableSql).toContain('CREATE TABLE "fruits"');
    expect(result.insertSqls.length).toBe(1); // 2 rows bundled in multi-row or insert
    expect(result.insertSqls[0]).toContain('INSERT INTO "fruits"');
  });
});

describe('Phase 5 - End-to-End Changeset Execution in SqliteEngine', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = new SqliteEngine();
    await engine.init();
    await engine.query(`
      CREATE TABLE inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        stock INTEGER NOT NULL
      );
      INSERT INTO inventory (name, stock) VALUES ('Widget A', 10), ('Widget B', 20);
    `);
  });

  it('commits cell update, row insert, and row delete atomically', async () => {
    const changes = [
      {
        id: 'c1',
        table: 'inventory',
        type: 'update-cell' as const,
        timestamp: Date.now(),
        pkValues: { id: 1 },
        column: 'stock',
        oldValue: 10,
        newValue: 99,
      },
      {
        id: 'c2',
        table: 'inventory',
        type: 'insert-row' as const,
        timestamp: Date.now(),
        values: { name: 'Widget C', stock: 50 },
      },
      {
        id: 'c3',
        table: 'inventory',
        type: 'delete-row' as const,
        timestamp: Date.now(),
        pkValues: { id: 2 },
        row: { id: 2, name: 'Widget B', stock: 20 },
      },
    ];

    const script = generateCommitScript(changes, 'sqlite');
    await engine.query(script);

    const res = await engine.query('SELECT * FROM inventory ORDER BY id ASC;');
    expect(res.rowCount).toBe(2);
    expect(res.rows[0].stock).toBe(99); // updated
    expect(res.rows[1].name).toBe('Widget C'); // inserted
    // Widget B (id: 2) was deleted
    expect(res.rows.find((r) => r.id === 2)).toBeUndefined();
  });
});
