import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DatabaseFileInfo {
  name: string;
  filepath: string;
  sizeBytes: number;
  sizeFormatted: string;
  modifiedAt: Date;
}

const SQLITE_EXTENSIONS = new Set([
  '.db',
  '.sqlite',
  '.sqlite3',
  '.db3',
  '.s3db',
  '.sl3',
  '.sqlitedb',
  '.gpkg',
  '.mbtiles',
]);

const IGNORED_EXTENSIONS = new Set([
  '.wal',
  '.shm',
  '.journal',
  '.tmp',
  '.log',
  '.json',
  '.js',
  '.ts',
  '.html',
  '.css',
]);

const SQLITE_HEADER = 'SQLite format 3\0';

function hasSqliteHeader(filepath: string): boolean {
  try {
    const fd = fs.openSync(filepath, 'r');
    const buf = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return bytesRead === 16 && buf.toString('utf8') === SQLITE_HEADER;
  } catch {
    return false;
  }
}

/**
 * Scans a directory for SQLite database files by extension and 16-byte magic header.
 */
export function scanDirectoryForDatabases(dirPath: string): DatabaseFileInfo[] {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return [];
  }

  const results: DatabaseFileInfo[] = [];
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IGNORED_EXTENSIONS.has(ext)) continue;

        const fullPath = path.join(resolved, entry.name);
        const isKnownExt = SQLITE_EXTENSIONS.has(ext);

        // If known extension or has valid SQLite 3 magic header
        if (isKnownExt || hasSqliteHeader(fullPath)) {
          const stat = fs.statSync(fullPath);
          results.push({
            name: entry.name,
            filepath: fullPath,
            sizeBytes: stat.size,
            sizeFormatted: formatBytes(stat.size),
            modifiedAt: stat.mtime,
          });
        }
      }
    }
  } catch {
    // Return whatever was collected
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
