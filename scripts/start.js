#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const cliEntry = resolve(rootDir, 'packages/cli/dist/cli.js');

function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('npm')) return 'npm';
  try {
    const res = spawnSync('pnpm', ['--version'], { shell: true, stdio: 'ignore' });
    if (res.status === 0) return 'pnpm';
  } catch {
    // Ignore
  }
  return 'npm';
}

// 1. Ensure project is built before starting
if (!existsSync(cliEntry)) {
  console.log('⚡ First-time startup: building sql-magic packages...');
  const pm = detectPackageManager();
  const buildCmd = pm === 'pnpm' ? 'pnpm' : 'npm';
  const buildArgs = pm === 'pnpm' ? ['run', 'build'] : ['run', 'build'];
  const res = spawnSync(buildCmd, buildArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });
  if (res.status !== 0) {
    console.error('❌ Build failed. Please run "npm run build" to inspect errors.');
    process.exit(res.status || 1);
  }
}

// 2. Start the CLI with forwarded arguments
const args = process.argv.slice(2);
const child = spawn(process.execPath, [cliEntry, ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
