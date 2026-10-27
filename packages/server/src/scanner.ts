import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DatabaseFileInfo {
  name: string;
  filepath: string;
  sizeBytes: number;
  sizeFormatted: string;
  modifiedAt: Date;
}

const SQLITE_EXTENSIONS = new Set(['.db', '.sqlite', '.sqlite3']);

/**
 * Scans a directory for SQLite database files.
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
        if (SQLITE_EXTENSIONS.has(ext)) {
          const fullPath = path.join(resolved, entry.name);
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
