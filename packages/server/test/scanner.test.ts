import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanDirectoryForDatabases } from '../src/scanner.js';

describe('Database Directory Scanner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sql_magic_scan_'));
    fs.writeFileSync(path.join(tempDir, 'prod.sqlite'), 'mock-content');
    fs.writeFileSync(path.join(tempDir, 'analytics.db'), 'mock-content-2');
    fs.writeFileSync(path.join(tempDir, 'backup.sqlite3'), 'mock-content-3');
    fs.writeFileSync(path.join(tempDir, 'geodata.gpkg'), 'mock-content-4');
    fs.writeFileSync(path.join(tempDir, 'mobile.sqlitedb'), 'mock-content-5');
    // Extensionless file with SQLite 3 magic header
    const headerBuf = Buffer.alloc(100);
    headerBuf.write('SQLite format 3\0', 0, 'utf8');
    fs.writeFileSync(path.join(tempDir, 'raw_database'), headerBuf);
    fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'not a db');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it('scans directory and finds all SQLite files while ignoring non-db files', () => {
    const list = scanDirectoryForDatabases(tempDir);
    expect(list.length).toBe(6);

    const names = list.map((d) => d.name);
    expect(names).toContain('prod.sqlite');
    expect(names).toContain('analytics.db');
    expect(names).toContain('backup.sqlite3');
    expect(names).toContain('geodata.gpkg');
    expect(names).toContain('mobile.sqlitedb');
    expect(names).toContain('raw_database');
    expect(names).not.toContain('readme.txt');

    expect(list[0].sizeFormatted).toBeDefined();
    expect(list[0].filepath).toBeDefined();
  });

  it('returns empty array when target path is not a directory', () => {
    const list = scanDirectoryForDatabases(path.join(tempDir, 'prod.sqlite'));
    expect(list).toEqual([]);
  });
});
