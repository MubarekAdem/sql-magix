/**
 * Quote an identifier safely for SQLite.
 */
export function quoteSqliteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
