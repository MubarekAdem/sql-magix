#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import open from 'open';
import { NodeSqliteAdapter } from '@sql-magic/core/server';
import { startViewer, scanDirectoryForDatabases } from '@sql-magic/server';

const program = new Command();

program
  .name('sql-magic')
  .description('Dialect-neutral database viewer and query studio')
  .version('0.1.0')
  .argument('[target]', 'Database file path or directory', '.')
  .option('-p, --port <number>', 'Port to bind server', (val) => parseInt(val, 10), 3000)
  .option('-H, --host <address>', 'Host address to bind', '127.0.0.1')
  .option('--readonly', 'Enforce strict read-only mode at SQLite level', false)
  .option('--no-open', 'Do not automatically open the browser')
  .option('--no-watch', 'Disable file watching for database changes')
  .option('-q, --query <sql>', 'Execute headless SQL query and exit')
  .option('--format <format>', 'Output format for headless query (json, csv)', 'json')
  .action(async (targetArg, options) => {
    const resolvedTarget = path.resolve(targetArg || '.');

    // 1. Headless Query Execution Mode
    if (options.query) {
      if (!fs.existsSync(resolvedTarget) || fs.statSync(resolvedTarget).isDirectory()) {
        console.error(pc.red(`Error: Headless query requires a database file target. '${targetArg}' is invalid.`));
        process.exit(1);
      }

      try {
        const adapter = new NodeSqliteAdapter(resolvedTarget, { readOnly: options.readonly });
        await adapter.init();
        const result = await adapter.query(options.query);
        await adapter.close();

        if (options.format.toLowerCase() === 'csv') {
          const headers = result.columns.map((c) => c.name).join(',');
          const rows = result.rows.map((row) =>
            result.columns.map((c) => JSON.stringify((row as any)[c.name] ?? '')).join(',')
          );
          console.log([headers, ...rows].join('\n'));
        } else {
          console.log(JSON.stringify(result.rows, null, 2));
        }
        process.exit(0);
      } catch (err: unknown) {
        console.error(pc.red(`Query failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    }

    // 2. Directory or File Target Inspection
    let isDirectory = false;
    if (fs.existsSync(resolvedTarget)) {
      isDirectory = fs.statSync(resolvedTarget).isDirectory();
    }

    console.log();
    console.log(pc.bold(pc.cyan('⚡ sql-magic studio v0.1.0')));

    if (isDirectory) {
      const found = scanDirectoryForDatabases(resolvedTarget);
      console.log(pc.gray(`📁 Scanning directory: ${pc.white(resolvedTarget)}`));
      if (found.length === 0) {
        console.log(pc.yellow(`   No .db or .sqlite files found in directory.`));
      } else {
        console.log(pc.green(`   Found ${found.length} database(s):`));
        for (const db of found) {
          console.log(pc.gray(`   • ${pc.white(db.name)} (${db.sizeFormatted})`));
        }
      }
    } else {
      console.log(pc.gray(`🗄️  Database: ${pc.white(resolvedTarget)}`));
      if (options.readonly) {
        console.log(pc.yellow(`🔒 Mode: Strict Read-Only`));
      }
    }

    // 3. Start Viewer Server
    try {
      const instance = await startViewer({
        port: options.port,
        host: options.host,
        targetPath: resolvedTarget,
        readOnly: options.readonly,
        watch: options.watch,
      });

      console.log();
      console.log(`   ${pc.green('➜')}  ${pc.bold('Local:')}   ${pc.cyan(instance.url)}`);
      if (instance.token) {
        console.log(`   ${pc.gray('🔑 Token:')}   ${pc.gray(instance.token)}`);
      }
      console.log();

      // Automatically open browser unless --no-open
      if (options.open) {
        try {
          await open(instance.url);
        } catch {
          // Ignore if open fails in headless environment
        }
      }

      console.log(pc.gray('   Press Ctrl+C to stop server'));

      // Graceful shutdown
      const shutdown = async () => {
        console.log(pc.gray('\nStopping sql-magic server...'));
        await instance.close();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (err: unknown) {
      console.error(pc.red(`Failed to start server: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
