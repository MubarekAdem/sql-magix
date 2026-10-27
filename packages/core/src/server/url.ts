import type { Dialect } from '../types.js';

/**
 * Detects the SQL dialect from a connection string URL or file path.
 */
export function detectDialectFromUrl(input: string): Dialect {
  const trimmed = input.trim();
  if (/^postgres(ql)?:\/\//i.test(trimmed)) {
    return 'postgres';
  }
  if (/^(mysql|mariadb):\/\//i.test(trimmed)) {
    return 'mysql';
  }
  if (/^sqlite:\/\//i.test(trimmed) || /\.(db|sqlite|sqlite3)$/i.test(trimmed)) {
    return 'sqlite';
  }
  // Default to sqlite if not URL scheme
  return 'sqlite';
}

/**
 * Masks sensitive passwords in database connection strings for safe logging and UI display.
 */
export function maskConnectionString(connectionUrl: string): string {
  try {
    const parsed = new URL(connectionUrl);
    if (parsed.password) {
      parsed.password = '*****';
    }
    return parsed.toString();
  } catch {
    // If not standard URL, use regex to mask password parameter or pattern
    return connectionUrl.replace(
      /(:\/\/[^:]+:)([^@]+)(@)/,
      '$1*****$3'
    );
  }
}

/**
 * Normalizes database cell values across different drivers and dialects.
 * Converts BigInt and Decimal/Numeric types to string to avoid JavaScript IEEE-754 precision loss.
 */
export function normalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'bigint') return val.toString();
  if (val instanceof Date) return val.toISOString();
  if (Buffer.isBuffer(val)) {
    // Return byte size or preview
    return `<BLOB ${val.length} bytes>`;
  }
  if (typeof val === 'object') {
    return val;
  }
  return val;
}
