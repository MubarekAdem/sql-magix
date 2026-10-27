import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(__dirname, '../core/node_modules/sql.js/dist/sql-wasm.wasm'),
  path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
  path.resolve(__dirname, '../../node_modules/.pnpm/sql.js@1.15.1/node_modules/sql.js/dist/sql-wasm.wasm'),
];

const destDir = path.resolve(__dirname, 'public');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const dest = path.resolve(destDir, 'sql-wasm.wasm');
const destBrowser = path.resolve(destDir, 'sql-wasm-browser.wasm');
let found = false;
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    fs.copyFileSync(cand, dest);
    fs.copyFileSync(cand, destBrowser);
    console.log(`✓ Copied sql-wasm.wasm and sql-wasm-browser.wasm (${fs.statSync(dest).size} bytes) to packages/ui/public/`);
    found = true;
    break;
  }
}

if (!found) {
  console.warn('⚠️ Could not find sql-wasm.wasm in local node_modules candidates');
}
