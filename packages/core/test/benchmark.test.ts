import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteEngine } from '../src/index.js';

describe('Phase 7 - Large Dataset Performance Benchmark', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = new SqliteEngine();
    await engine.init();
    await engine.query(`
      CREATE TABLE benchmark_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        metric REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  it('efficiently bulk inserts and queries thousands of records in sub-second time', async () => {
    const BATCH_SIZE = 5000;
    const values: string[] = [];

    for (let i = 1; i <= BATCH_SIZE; i++) {
      values.push(`(${i % 100}, ${Math.random() * 1000}, 'status_${i % 5}')`);
    }

    const insertSql = `
      BEGIN TRANSACTION;
      INSERT INTO benchmark_records (account_id, metric, status) VALUES ${values.join(', ')};
      COMMIT;
    `;

    const startInsert = Date.now();
    await engine.query(insertSql);
    const insertDuration = Date.now() - startInsert;

    // Verify record count
    const countRes = await engine.query('SELECT COUNT(*) as cnt FROM benchmark_records;');
    expect(countRes.rows[0].cnt).toBe(BATCH_SIZE);
    expect(insertDuration).toBeLessThan(3000); // Sub 3 seconds for 5000 records

    // Query performance with aggregation and ordering
    const startQuery = Date.now();
    const queryRes = await engine.query(`
      SELECT account_id, COUNT(*) as cnt, AVG(metric) as avg_metric
      FROM benchmark_records
      GROUP BY account_id
      ORDER BY cnt DESC
      LIMIT 10;
    `);
    const queryDuration = Date.now() - startQuery;

    expect(queryRes.rowCount).toBe(10);
    expect(queryDuration).toBeLessThan(500); // Sub 500ms
  });
});
