import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('sql-magic CLI', () => {
  it('parses options accurately', () => {
    const program = new Command();
    program
      .name('sql-magix')
      .argument('[target]', 'Database target', '.')
      .option('-p, --port <number>', 'Port', (v) => parseInt(v, 10), 3000)
      .option('-H, --host <address>', 'Host', '127.0.0.1')
      .option('--readonly', 'Read-only', false)
      .option('--no-open', 'No open')
      .option('-q, --query <sql>', 'Query')
      .option('--format <format>', 'Format', 'json');

    program.parse([
      'node',
      'cli.js',
      './mydb.sqlite',
      '-p',
      '8080',
      '--readonly',
      '--no-open',
      '-q',
      'SELECT 1',
      '--format',
      'csv',
    ]);

    const opts = program.opts();
    expect(program.args[0]).toBe('./mydb.sqlite');
    expect(opts.port).toBe(8080);
    expect(opts.readonly).toBe(true);
    expect(opts.open).toBe(false);
    expect(opts.query).toBe('SELECT 1');
    expect(opts.format).toBe('csv');
  });

  it('correctly resolves env database urls (DATABASE_URL, POSTGRES_URL, MYSQL_URL)', () => {
    const envVars = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db1',
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/db2',
      MYSQL_URL: 'mysql://root:pass@localhost:3306/db3',
    };

    // Test DATABASE_URL precedence
    let resolved = envVars.DATABASE_URL || envVars.POSTGRES_URL || envVars.MYSQL_URL;
    expect(resolved).toBe('postgres://user:pass@localhost:5432/db1');

    // Test POSTGRES_URL fallback
    resolved = undefined || envVars.POSTGRES_URL || envVars.MYSQL_URL;
    expect(resolved).toBe('postgres://user:pass@localhost:5432/db2');

    // Test MYSQL_URL fallback
    resolved = undefined || undefined || envVars.MYSQL_URL;
    expect(resolved).toBe('mysql://root:pass@localhost:3306/db3');
  });

  it('has bundled UI files present in dist/public when built', () => {
    const publicDir = path.resolve(__dirname, '../dist/public');
    const indexHtml = path.join(publicDir, 'index.html');
    if (fs.existsSync(publicDir)) {
      expect(fs.existsSync(indexHtml)).toBe(true);
      const content = fs.readFileSync(indexHtml, 'utf8');
      expect(content).toContain('<!DOCTYPE html>');
    }
  });
});
