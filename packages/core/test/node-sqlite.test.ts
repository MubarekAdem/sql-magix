import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeSqliteAdapter } from '../src/server/sqlite.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('NodeSqliteAdapter (native node:sqlite)', () => {
  let tempDbPath: string;
  let adapter: NodeSqliteAdapter;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `test_db_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);
    adapter = new NodeSqliteAdapter(tempDbPath);
    await adapter.init();
  });

  afterEach(async () => {
    await adapter.close();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {
        // Ignored if file locked
      }
    }
  });

  it('initializes and executes queries with parameters', async () => {
    await adapter.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);');
    const insertRes = await adapter.query(
      'INSERT INTO users (name, email) VALUES (?, ?);',
      ['Alice', 'alice@test.com']
    );
    expect(insertRes.affectedRows).toBe(1);

    const selectRes = await adapter.query('SELECT * FROM users;');
    expect(selectRes.rowCount).toBe(1);
    expect(selectRes.rows[0].name).toBe('Alice');
    expect(selectRes.rows[0].email).toBe('alice@test.com');
  });

  it('introspects schema including tables, columns, indexes, and FKs', async () => {
    await adapter.query(`
      CREATE TABLE depts (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE staff (
        id INTEGER PRIMARY KEY,
        name TEXT,
        dept_id INTEGER,
        FOREIGN KEY (dept_id) REFERENCES depts(id)
      );
      CREATE INDEX idx_staff_dept ON staff(dept_id);
    `);

    const schema = await adapter.getSchema();
    expect(schema.tables.length).toBe(2);

    const staffTbl = schema.tables.find((t) => t.name === 'staff');
    expect(staffTbl).toBeDefined();
    expect(staffTbl?.columns.length).toBe(3);
    expect(staffTbl?.foreignKeys.length).toBe(1);
    expect(staffTbl?.foreignKeys[0].referencedTable).toBe('depts');
    expect(staffTbl?.indexes.length).toBe(1);
  });

  it('produces execution plan via explain()', async () => {
    await adapter.query('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT);');
    const plan = await adapter.explain("SELECT * FROM items WHERE val = 'test';");
    expect(plan.dialect).toBe('sqlite');
    expect(plan.nodes).toBeDefined();
    expect(plan.text).toContain('items');
  });

  it('enforces read-only at the adapter level', async () => {
    await adapter.query('CREATE TABLE secured (id INT);');
    await adapter.close();

    // Reopen in read-only mode
    const roAdapter = new NodeSqliteAdapter(tempDbPath, { readOnly: true });
    await roAdapter.init();

    await expect(roAdapter.query('INSERT INTO secured VALUES (1);')).rejects.toThrow();

    await roAdapter.close();
  });
});
