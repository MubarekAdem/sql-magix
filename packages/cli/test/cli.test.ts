import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

describe('@sql-magic/cli', () => {
  it('configures options correctly', () => {
    const program = new Command();
    program
      .name('sql-magic')
      .option('-p, --port <number>', 'Port to bind local server', '3000')
      .option('--readonly', 'Enforce strict read-only mode', false);

    program.parse(['node', 'cli.js', '-p', '8080', '--readonly']);
    const opts = program.opts();

    expect(opts.port).toBe('8080');
    expect(opts.readonly).toBe(true);
  });
});
