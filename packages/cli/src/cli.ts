#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';

const program = new Command();

program
  .name('sql-magic')
  .description('High-performance, dialect-neutral database viewer and query studio')
  .version('0.1.0')
  .argument('[target]', 'Database file path or connection URL', '.')
  .option('-p, --port <number>', 'Port to bind local server', '3000')
  .option('-H, --host <address>', 'Host address to bind', '127.0.0.1')
  .option('--readonly', 'Enforce strict read-only mode', false)
  .option('--no-open', 'Do not automatically open the browser')
  .option('-q, --query <sql>', 'Execute headless SQL query and output results')
  .action((target, options) => {
    console.log(pc.bold(pc.cyan('⚡ sql-magic v0.1.0')));
    console.log(pc.gray(`Target: ${target}`));
    console.log(pc.gray(`Mode: ${options.readonly ? 'read-only' : 'read-write'}`));
    console.log(pc.green(`Server listening at http://${options.host}:${options.port}`));
  });

program.parse(process.argv);
