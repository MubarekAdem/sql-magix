import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteEngine } from '../src/sqlite/engine.js';
import { quoteSqliteIdent } from '../src/sqlite/quote.js';
import { parseSqliteExplainPlan } from '../src/sqlite/explain.js';

describe('SqliteEngine & Core Types', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = new SqliteEngine();
    await engine.init();
  });

  afterEach(async () => {
    await engine.close();
  });

  it('reports correct dialect and capabilities', () => {
    expect(engine.dialect).toBe('sqlite');
    expect(engine.capabilities.schemas).toBe(false);
    expect(engine.capabilities.explain).toBe(true);
    expect(engine.capabilities.pragma).toBe(true);
    expect(engine.capabilities.exportDatabase).toBe(true);
    expect(engine.capabilities.readOnly).toBe(false);
  });

  it('correctly quotes SQLite identifiers', () => {
    expect(quoteSqliteIdent('users')).toBe('"users"');
    expect(quoteSqliteIdent('user"table')).toBe('"user""table"');
  });

  it('creates tables, inserts data, and executes queries', async () => {
    // 1. Create table
    await engine.query(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Insert with parameters
    const insertRes = await engine.query(
      'INSERT INTO users (name, email) VALUES (?, ?);',
      ['Alice', 'alice@example.com']
    );
    expect(insertRes.affectedRows).toBe(1);

    // 3. Insert without parameters
    await engine.query("INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com');");

    // 4. Select query
    const selectRes = await engine.query('SELECT * FROM users ORDER BY id ASC;');
    expect(selectRes.rowCount).toBe(2);
    expect(selectRes.columns.map((c) => c.name)).toEqual(['id', 'name', 'email', 'created_at']);
    expect(selectRes.rows[0].name).toBe('Alice');
    expect(selectRes.rows[1].name).toBe('Bob');
    expect(selectRes.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('introspects tables, columns, indexes, foreign keys, and views', async () => {
    // Setup schema
    await engine.query(`
      CREATE TABLE departments (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE employees (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        department_id INTEGER,
        salary REAL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_emp_dept ON employees(department_id);
      CREATE UNIQUE INDEX idx_emp_name ON employees(name);

      CREATE VIEW v_active_employees AS
        SELECT e.id, e.name, d.name as dept_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id;
    `);

    const schema = await engine.getSchema();

    // Check tables
    expect(schema.tables.length).toBe(2);
    const empTable = schema.tables.find((t) => t.name === 'employees');
    expect(empTable).toBeDefined();
    expect(empTable?.primaryKey).toEqual(['id']);
    expect(empTable?.columns.map((c) => c.name)).toContain('department_id');

    // Check foreign keys
    expect(empTable?.foreignKeys.length).toBe(1);
    expect(empTable?.foreignKeys[0].referencedTable).toBe('departments');
    expect(empTable?.foreignKeys[0].referencedColumn).toBe('id');
    expect(empTable?.foreignKeys[0].onDelete).toBe('CASCADE');

    // Check indexes
    const deptIdx = empTable?.indexes.find((i) => i.name === 'idx_emp_dept');
    expect(deptIdx).toBeDefined();
    expect(deptIdx?.columns).toEqual(['department_id']);
    expect(deptIdx?.unique).toBe(false);

    const nameIdx = empTable?.indexes.find((i) => i.name === 'idx_emp_name');
    expect(nameIdx).toBeDefined();
    expect(nameIdx?.unique).toBe(true);

    // Check views
    expect(schema.views.length).toBe(1);
    expect(schema.views[0].name).toBe('v_active_employees');
  });

  it('generates execution plan with EXPLAIN QUERY PLAN', async () => {
    await engine.query(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL
      );
      CREATE INDEX idx_items_code ON items(code);
    `);

    const plan = await engine.explain("SELECT * FROM items WHERE code = 'XYZ';");
    expect(plan.dialect).toBe('sqlite');
    expect(plan.nodes).toBeDefined();
    expect(plan.text).toBeDefined();
    expect(plan.text).toContain('items');
  });

  it('enforces read-only mode when configured', async () => {
    const readOnlyEngine = new SqliteEngine({ readOnly: true });
    await readOnlyEngine.init();

    await expect(
      readOnlyEngine.query('CREATE TABLE hacked (id INT);')
    ).rejects.toThrow(/read-only/);

    await readOnlyEngine.close();
  });

  it('exports and re-imports database binary', async () => {
    await engine.query('CREATE TABLE config (k TEXT PRIMARY KEY, v TEXT);');
    await engine.query("INSERT INTO config VALUES ('theme', 'dark');");

    const exported = engine.exportBinary();
    expect(exported.byteLength).toBeGreaterThan(0);

    // Load into a new engine
    const engine2 = new SqliteEngine();
    await engine2.init();
    engine2.loadBinary(exported);

    const res = await engine2.query('SELECT v FROM config WHERE k = ?;', ['theme']);
    expect(res.rows[0].v).toBe('dark');

    await engine2.close();
  });
});

describe('parseSqliteExplainPlan', () => {
  it('parses hierarchical rows into parent-child tree', () => {
    const raw = [
      { id: 2, parent: 0, detail: 'SCAN TABLE users' },
      { id: 3, parent: 0, detail: 'SEARCH TABLE orders USING INDEX idx_orders (user_id=?)' },
      { id: 4, parent: 3, detail: 'SUBQUERY 1' },
    ];

    const plan = parseSqliteExplainPlan(raw);
    expect(plan.nodes?.length).toBe(2);
    expect(plan.nodes?.[0].detail).toBe('SCAN TABLE users');
    expect(plan.nodes?.[1].children?.length).toBe(1);
    expect(plan.nodes?.[1].children?.[0].detail).toBe('SUBQUERY 1');
  });
});
