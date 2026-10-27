import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

describe('sql-magic CLI', () => {
  it('parses options accurately', () => {
    const program = new Command();
    program
      .name('sql-magic')
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
});
