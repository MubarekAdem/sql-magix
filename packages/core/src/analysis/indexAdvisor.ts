import type { Dialect, Plan } from '../types.js';

export interface IndexRecommendation {
  table: string;
  suggestedColumns: string[];
  suggestedIndexName: string;
  createIndexSql: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Analyzes an execution plan and recommends missing indexes to eliminate sequential scans.
 */
export function analyzePlanForMissingIndexes(
  plan: Plan,
  dialect: Dialect = 'sqlite',
  querySql?: string
): IndexRecommendation[] {
  const recommendations: IndexRecommendation[] = [];
  const planText = plan.text || '';

  // SQLite EXPLAIN QUERY PLAN parsing
  // Matches e.g. "SCAN TABLE products" or "SCAN customer"
  if (dialect === 'sqlite') {
    const scanRegex = /SCAN\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)/gi;
    let match: RegExpExecArray | null;

    while ((match = scanRegex.exec(planText)) !== null) {
      const table = match[1];

      // Attempt to extract filtered columns from query WHERE / JOIN clause
      const filteredCols = extractCandidateColumns(table, querySql);
      const cols = filteredCols.length > 0 ? filteredCols : ['<filtered_column>'];
      const indexName = `idx_${table}_${cols.join('_').replace(/[^a-zA-Z0-9_]/g, '')}`;

      recommendations.push({
        table,
        suggestedColumns: cols,
        suggestedIndexName: indexName,
        createIndexSql: `CREATE INDEX "${indexName}" ON "${table}" (${cols.map((c) => `"${c}"`).join(', ')});`,
        reason: `Full table scan detected on "${table}". Creating an index on filtered or joined columns will eliminate scan cost.`,
        severity: 'high',
      });
    }
  }

  // Postgres Seq Scan
  if (dialect === 'postgres') {
    const pgRegex = /Seq Scan on\s+([a-zA-Z0-9_]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = pgRegex.exec(planText)) !== null) {
      const table = match[1];
      const filteredCols = extractCandidateColumns(table, querySql);
      const cols = filteredCols.length > 0 ? filteredCols : ['<filtered_column>'];
      const indexName = `idx_${table}_${cols.join('_').replace(/[^a-zA-Z0-9_]/g, '')}`;

      recommendations.push({
        table,
        suggestedColumns: cols,
        suggestedIndexName: indexName,
        createIndexSql: `CREATE INDEX "${indexName}" ON "${table}" (${cols.map((c) => `"${c}"`).join(', ')});`,
        reason: `Sequential scan (Seq Scan) detected on "${table}". Adding an index will convert this to an Index Scan or Bitmap Index Scan.`,
        severity: 'high',
      });
    }
  }

  // MySQL type ALL (table scan)
  if (dialect === 'mysql') {
    const myRegex = /"type":\s*"ALL"[^}]*"table_name":\s*"([a-zA-Z0-9_]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = myRegex.exec(planText)) !== null) {
      const table = match[1];
      const filteredCols = extractCandidateColumns(table, querySql);
      const cols = filteredCols.length > 0 ? filteredCols : ['<filtered_column>'];
      const indexName = `idx_${table}_${cols.join('_').replace(/[^a-zA-Z0-9_]/g, '')}`;

      recommendations.push({
        table,
        suggestedColumns: cols,
        suggestedIndexName: indexName,
        createIndexSql: `CREATE INDEX \`${indexName}\` ON \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')});`,
        reason: `Full table scan (type: ALL) detected on \`${table}\`. An index will optimize row lookups.`,
        severity: 'high',
      });
    }
  }

  return recommendations;
}

/**
 * Extracts candidate columns from SQL WHERE, ORDER BY, and JOIN ON clauses.
 */
function extractCandidateColumns(table: string, querySql?: string): string[] {
  if (!querySql) return [];

  const candidates = new Set<string>();
  const sql = querySql.replace(/\s+/g, ' ');

  // Look for WHERE or ON conditions: WHERE col = ... or WHERE table.col = ...
  const conditionRegex = /(?:WHERE|AND|OR|ON)\s+(?:(?:[a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)\s*(?:=|<|>|<=|>=|IN|LIKE)\s*/gi;
  let m: RegExpExecArray | null;

  while ((m = conditionRegex.exec(sql)) !== null) {
    const col = m[1].toLowerCase();
    // Exclude SQL keywords
    if (!['select', 'from', 'where', 'limit', 'order', 'group', 'by', 'as'].includes(col)) {
      candidates.add(m[1]);
    }
  }

  return Array.from(candidates);
}
