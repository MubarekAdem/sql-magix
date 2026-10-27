import { describe, it, expect } from 'vitest';
import {
  computeColumnStatistics,
  diffResultSets,
  analyzePlanForMissingIndexes,
  buildSchemaOnlyAiPrompt,
  type DatabaseSchema,
  type Plan,
} from '../src/index.js';

describe('Phase 6 - Column Statistics Analyzer', () => {
  it('computes numeric statistics and histogram correctly', () => {
    const rows = [
      { id: 1, age: 20 },
      { id: 2, age: 30 },
      { id: 3, age: 40 },
      { id: 4, age: null },
      { id: 5, age: 30 },
    ];

    const stats = computeColumnStatistics(rows, 'age');
    expect(stats.totalRows).toBe(5);
    expect(stats.nullCount).toBe(1);
    expect(stats.nullPercent).toBe(20.0);
    expect(stats.distinctCount).toBe(3);
    expect(stats.isNumeric).toBe(true);
    expect(stats.min).toBe(20);
    expect(stats.max).toBe(40);
    expect(stats.avg).toBe(30);
    expect(stats.topValues[0].value).toBe('30');
    expect(stats.topValues[0].count).toBe(2);
    expect(stats.histogram).toBeDefined();
    expect(stats.histogram!.length).toBeGreaterThan(0);
  });

  it('computes text statistics with top frequencies', () => {
    const rows = [
      { status: 'active' },
      { status: 'pending' },
      { status: 'active' },
      { status: 'cancelled' },
      { status: 'active' },
    ];

    const stats = computeColumnStatistics(rows, 'status');
    expect(stats.isNumeric).toBe(false);
    expect(stats.distinctCount).toBe(3);
    expect(stats.topValues[0].value).toBe('active');
    expect(stats.topValues[0].count).toBe(3);
  });
});

describe('Phase 6 - ResultSet Diffing Engine', () => {
  it('detects added, removed, and modified rows with cell diffs', () => {
    const beforeRows = [
      { id: 1, name: 'Alice', score: 100 },
      { id: 2, name: 'Bob', score: 85 },
      { id: 3, name: 'Charlie', score: 90 },
    ];

    const afterRows = [
      { id: 1, name: 'Alice', score: 105 }, // modified
      { id: 2, name: 'Bob', score: 85 },   // identical
      { id: 4, name: 'Diana', score: 95 },  // added
      // Charlie id: 3 removed
    ];

    const diff = diffResultSets(beforeRows, afterRows, ['id']);
    expect(diff.identicalCount).toBe(1);
    expect(diff.addedRows.length).toBe(1);
    expect(diff.addedRows[0].id).toBe(4);
    expect(diff.removedRows.length).toBe(1);
    expect(diff.removedRows[0].id).toBe(3);
    expect(diff.modifiedRows.length).toBe(1);
    expect(diff.modifiedRows[0].changes[0].column).toBe('score');
    expect(diff.modifiedRows[0].changes[0].oldValue).toBe(100);
    expect(diff.modifiedRows[0].changes[0].newValue).toBe(105);
  });
});

describe('Phase 6 - Index Advisor & Plan Analyzer', () => {
  it('detects sequential scans in SQLite and recommends index', () => {
    const plan: Plan = {
      text: 'SCAN TABLE products',
      nodes: [],
    };

    const recs = analyzePlanForMissingIndexes(
      plan,
      'sqlite',
      'SELECT * FROM products WHERE sku = "TEST-01";'
    );

    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].table).toBe('products');
    expect(recs[0].suggestedColumns).toContain('sku');
    expect(recs[0].createIndexSql).toContain('CREATE INDEX');
  });

  it('detects Seq Scan in PostgreSQL', () => {
    const plan: Plan = {
      text: 'Seq Scan on orders (cost=0.00..35.50 rows=10 width=8)',
      nodes: [],
    };

    const recs = analyzePlanForMissingIndexes(
      plan,
      'postgres',
      'SELECT * FROM orders WHERE customer_id = 42;'
    );

    expect(recs.length).toBe(1);
    expect(recs[0].table).toBe('orders');
    expect(recs[0].createIndexSql).toContain('CREATE INDEX');
  });
});

describe('Phase 6 - Privacy-Preserving AI Text-to-SQL Prompt Generator', () => {
  it('generates prompt containing ONLY schema metadata and NEVER table row data', () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'users',
          type: 'table',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
            { name: 'email', type: 'TEXT', primaryKey: false, nullable: false },
          ],
          foreignKeys: [],
        },
      ],
      views: [],
      triggers: [],
    };

    const promptObj = buildSchemaOnlyAiPrompt({
      dialect: 'sqlite',
      userPrompt: 'find all user emails',
      schema,
    });

    expect(promptObj.systemPrompt).toContain('expert SQL engineer');
    expect(promptObj.userPrompt).toContain('users');
    expect(promptObj.userPrompt).toContain('email');
    expect(promptObj.userPrompt).toContain('find all user emails');
  });
});
