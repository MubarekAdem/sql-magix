#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import pc from 'picocolors';
import open from 'open';
import dotenv from 'dotenv';
import { createAdapter, maskConnectionString, detectDialectFromUrl, seedSampleDatabase } from 'sql-magic-core/server';
import { startViewer, scanDirectoryForDatabases } from 'sql-magic-server';

// Load .env or .env.local if present
dotenv.config();
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveCliStaticDir(): string | undefined {
  const candidates = [
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, '../dist/public'),
    path.resolve(__dirname, '../../ui/dist'),
    path.resolve(process.cwd(), 'packages/ui/dist'),
    path.resolve(process.cwd(), 'packages/cli/dist/public'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return undefined;
}

const program = new Command();

program
  .name('sql-magix')
  .description('High-performance, dialect-neutral database viewer and query studio')
  .version('0.1.3')
  .argument('[target]', 'Database file path or connection string URL (postgres://, mysql://, sqlite:)')
  .option('-u, --url <connectionString>', 'Database connection URL')
  .option('-p, --port <number>', 'Port to bind server', (val) => parseInt(val, 10), 8989)
  .option('-H, --host <address>', 'Host address to bind', '127.0.0.1')
  .option('--allow-write', 'Permit write/mutation operations (read-only by default)', false)
  .option('--readonly', 'Explicitly enforce read-only mode', true)
  .option('--no-open', 'Do not automatically open the browser')
  .option('--no-watch', 'Disable file watching for database changes')
  .option('-q, --query <sql>', 'Execute headless SQL query and exit')
  .option('--format <format>', 'Output format for headless query (json, csv)', 'json')
  .option('--create-sample [filepath]', 'Generate a sample SQLite database populated with demo tables and data')
  .option('--demo', 'Shortcut to create and start studio with sample data')
  .action(async (targetArg, options) => {
    // 0. Handle explicit sample creation
    if (options.createSample || options.demo) {
      const sampleFile = typeof options.createSample === 'string'
        ? path.resolve(options.createSample)
        : (targetArg && targetArg !== '.' ? path.resolve(targetArg) : path.resolve('./app.db'));
      console.log(pc.gray(`🌱 Seeding sample SQLite database at ${pc.white(sampleFile)}...`));
      await seedSampleDatabase(sampleFile);
      console.log(pc.green(`✔ Sample database created with categories, customers, products, orders tables!\n`));
      if (options.createSample && !options.demo && !options.query) {
        process.exit(0);
      }
    }

    // Determine target from flag, argument, or DATABASE_URL/POSTGRES_URL/MYSQL_URL env
    const envUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.MYSQL_URL;
    const envVarName = process.env.DATABASE_URL
      ? 'DATABASE_URL'
      : process.env.POSTGRES_URL
      ? 'POSTGRES_URL'
      : process.env.MYSQL_URL
      ? 'MYSQL_URL'
      : null;
    const isFromEnv = !options.url && !targetArg && !!envUrl;
    const rawTarget =
      options.url ||
      targetArg ||
      envUrl ||
      '.';

    const isUrl = /^(postgres(ql)?|mysql|mariadb|sqlite):\/\//i.test(rawTarget);
    const resolvedTarget = isUrl ? rawTarget : path.resolve(rawTarget);
    const isReadOnly = !options.allowWrite;
    const dialect = detectDialectFromUrl(resolvedTarget);

    // 1. Headless Query Execution Mode
    if (options.query) {
      if (!isUrl && resolvedTarget !== ':memory:' && !fs.existsSync(resolvedTarget)) {
        console.error(pc.red(`\n✖ Database file not found: ${pc.bold(resolvedTarget)}`));
        console.log(pc.gray(`  Ensure the file exists, or generate a demo database first:`));
        console.log(`  ${pc.cyan('pnpm run start --create-sample ./app.db')}\n`);
        process.exit(1);
      }

      try {
        const adapter = await createAdapter(resolvedTarget, { readOnly: isReadOnly });
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
        console.error(pc.red(`Query execution failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    }

    // 2. Target Display & Logging with password masking
    console.log();
    console.log(pc.bold(pc.cyan('⚡ sql-magic studio v0.1.2')));

    // Auto-seed if target file specified does not exist yet in server mode
    if (!isUrl && resolvedTarget !== ':memory:' && !fs.existsSync(resolvedTarget)) {
      console.log(pc.yellow(`⚠️  Database file "${pc.white(resolvedTarget)}" not found.`));
      console.log(pc.gray(`   Auto-seeding demo database with sample tables and records...`));
      await seedSampleDatabase(resolvedTarget);
      console.log(pc.green(`✔ Created sample database at ${resolvedTarget}\n`));
    }

    const maskedTarget = isUrl ? maskConnectionString(resolvedTarget) : resolvedTarget;

    let isDirectory = false;
    if (!isUrl && fs.existsSync(resolvedTarget)) {
      isDirectory = fs.statSync(resolvedTarget).isDirectory();
    }

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
      const sourceLabel = isFromEnv && envVarName ? pc.cyan(` [from ${envVarName} in .env]`) : '';
      console.log(pc.gray(`🗄️  Target: ${pc.white(maskedTarget)} (${dialect})${sourceLabel}`));
      if (isReadOnly) {
        console.log(pc.yellow(`🔒 Mode: Read-Only (Pass --allow-write to enable write operations)`));
      } else {
        console.log(pc.red(`⚠️  Mode: Read-Write enabled`));
      }
    }

    // 3. Start Viewer Server
    try {
      const staticDir = resolveCliStaticDir();
      const instance = await startViewer({
        port: options.port,
        host: options.host,
        targetPath: resolvedTarget,
        readOnly: isReadOnly,
        watch: options.watch,
        staticDir,
      });

      console.log();
      console.log(`   ${pc.green('➜')}  ${pc.bold('Studio:')}  ${pc.cyan(instance.url)}`);
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

      console.log(pc.gray('   Press Ctrl+C to stop studio'));

      // Graceful shutdown
      const shutdown = async () => {
        console.log(pc.gray('\nStopping studio...'));
        await instance.close();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (err: unknown) {
      console.error(pc.red(`Failed to start studio: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
