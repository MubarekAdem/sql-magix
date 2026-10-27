#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

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

const pm = detectPackageManager();
const cmd = pm === 'pnpm' ? 'pnpm' : 'npm';
const args = pm === 'pnpm' ? ['-r', 'run', 'test'] : ['test', '--workspaces'];

const res = spawnSync(cmd, args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});
process.exit(res.status ?? 0);
