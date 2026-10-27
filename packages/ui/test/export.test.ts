import { describe, it, expect } from 'vitest';
import type { ResultSet } from '@sql-magic/core';
import {
  exportToCsv,
  exportToJson,
  exportToSqlInsert,
  exportToMarkdown,
  exportToExcelXml,
} from '../src/utils/export.js';

describe('Data Export Utilities', () => {
  const mockResultSet: ResultSet = {
    columns: [{ name: 'id' }, { name: 'name' }, { name: 'details' }, { name: 'price' }],
    rows: [
      { id: 1, name: 'Alice, Dr.', details: 'Notes with "quotes"', price: 100.5 },
      { id: 2, name: 'Bob', details: null, price: 50 },
    ],
    rowCount: 2,
    executionTimeMs: 1.2,
  };

  it('exports to CSV with RFC 4180 escaping', () => {
    const csv = exportToCsv(mockResultSet);
    expect(csv).toContain('id,name,details,price');
    // Name with comma must be quoted
    expect(csv).toContain('"Alice, Dr."');
    // Quotes must be escaped as ""
    expect(csv).toContain('"Notes with ""quotes"""');
    expect(csv).toContain('2,Bob,,50');
  });

  it('exports to formatted JSON', () => {
    const jsonStr = exportToJson(mockResultSet);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.length).toBe(2);
    expect(parsed[0].name).toBe('Alice, Dr.');
    expect(parsed[1].details).toBe(null);
  });

  it('exports to SQL INSERT statements', () => {
    const sql = exportToSqlInsert(mockResultSet, 'test_table');
    expect(sql).toContain('INSERT INTO "test_table" ("id", "name", "details", "price") VALUES');
    expect(sql).toContain("'Alice, Dr.'");
    expect(sql).toContain('NULL');
    expect(sql).toContain('100.5');
  });

  it('exports to Markdown table', () => {
    const md = exportToMarkdown(mockResultSet);
    expect(md).toContain('| id | name | details | price |');
    expect(md).toContain('| --- | --- | --- | --- |');
    expect(md).toContain('| 1 | Alice, Dr. | Notes with "quotes" | 100.5 |');
    expect(md).toContain('| 2 | Bob | `null` | 50 |');
  });

  it('exports to Excel-compatible XML spreadsheet', () => {
    const xml = exportToExcelXml(mockResultSet, 'SampleSheet');
    expect(xml).toContain('<?xml version="1.0"?>');
    expect(xml).toContain('SampleSheet');
    expect(xml).toContain('<Data ss:Type="String">Alice, Dr.</Data>');
    expect(xml).toContain('<Data ss:Type="Number">100.5</Data>');
  });
});
