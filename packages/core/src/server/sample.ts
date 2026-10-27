import * as fs from 'node:fs';
import * as path from 'node:path';
import { SAMPLE_STORE_SQL } from '../sample.js';

/**
 * Creates and populates a SQLite database file with the demonstration sample schema and records.
 */
export async function seedSampleDatabase(filepath: string): Promise<void> {
  const resolved = path.resolve(filepath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. Try native node:sqlite (Node 22+)
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(resolved);
    db.exec(SAMPLE_STORE_SQL);
    db.close();
    return;
  } catch {
    // 2. Try better-sqlite3 fallback
    const BetterSqlite3 = (await import('better-sqlite3' as any)).default;
    const db = new BetterSqlite3(resolved);
    db.exec(SAMPLE_STORE_SQL);
    db.close();
  }
}
