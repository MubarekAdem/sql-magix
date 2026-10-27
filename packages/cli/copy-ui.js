import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(__dirname, '../ui/dist');
const targetDir = path.resolve(__dirname, 'dist/public');

if (fs.existsSync(sourceDir)) {
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log('✓ Bundled pre-built UI into CLI package dist/public');
} else {
  console.log('Notice: packages/ui/dist does not exist yet; skipping UI bundling');
}
