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

if (pm === 'pnpm') {
  const res = spawnSync('pnpm', ['-r', 'run', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });
  process.exit(res.status ?? 0);
} else {
  // Topological order for npm workspaces: core -> server -> ui -> cli
  const packages = [
    '@sql-magic/core',
    '@sql-magic/server',
    '@sql-magic/ui',
    'sql-magic',
  ];
  for (const pkg of packages) {
    console.log(`\n📦 Building ${pkg}...`);
    const res = spawnSync('npm', ['run', 'build', '--workspace', pkg], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    });
    if (res.status !== 0) {
      process.exit(res.status ?? 1);
    }
  }
}
