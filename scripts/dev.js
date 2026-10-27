#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('npm')) return 'npm';
  return 'npm';
}

const pm = detectPackageManager();
const cmd = pm === 'pnpm' ? 'pnpm' : 'npm';
const args = pm === 'pnpm' ? ['--filter', '@sql-magic/ui', 'dev'] : ['run', 'dev', '--workspace', '@sql-magic/ui'];

const child = spawn(cmd, args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
