import type { ColumnMeta, ResultSet } from 'sql-magic-core';

/**
 * Escapes a cell value for RFC 4180 compliant CSV.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports query results to CSV string.
 */
export function exportToCsv(resultSet: ResultSet): string {
  const headers = resultSet.columns.map((c) => escapeCsvValue(c.name)).join(',');
  const rows = resultSet.rows.map((row) =>
    resultSet.columns.map((c) => escapeCsvValue((row as any)[c.name])).join(',')
  );
  return [headers, ...rows].join('\r\n');
}

/**
 * Exports query results to JSON string.
 */
export function exportToJson(resultSet: ResultSet, pretty = true): string {
  return JSON.stringify(resultSet.rows, null, pretty ? 2 : 0);
}

/**
 * Exports query results to SQL INSERT statements.
 */
export function exportToSqlInsert(resultSet: ResultSet, tableName = 'exported_table'): string {
  if (resultSet.rows.length === 0 || resultSet.columns.length === 0) return '-- No rows to export\n';

  const colList = resultSet.columns.map((c) => `"${c.name}"`).join(', ');
  const lines: string[] = [];

  for (const row of resultSet.rows) {
    const values = resultSet.columns
      .map((c) => {
        const val = (row as any)[c.name];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return String(val);
        if (typeof val === 'boolean') return val ? '1' : '0';
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `'${String(val).replace(/'/g, "''")}'`;
      })
      .join(', ');

    lines.push(`INSERT INTO "${tableName}" (${colList}) VALUES (${values});`);
  }

  return lines.join('\n');
}

/**
 * Exports query results to GitHub Flavored Markdown table.
 */
export function exportToMarkdown(resultSet: ResultSet): string {
  if (resultSet.columns.length === 0) return '_Empty result set_';

  const headers = '| ' + resultSet.columns.map((c) => c.name).join(' | ') + ' |';
  const divider = '| ' + resultSet.columns.map(() => '---').join(' | ') + ' |';
  const rows = resultSet.rows.map(
    (row) =>
      '| ' +
      resultSet.columns
        .map((c) => {
          const val = (row as any)[c.name];
          if (val === null || val === undefined) return '`null`';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        })
        .join(' | ') +
      ' |'
  );

  return [headers, divider, ...rows].join('\n');
}

/**
 * Exports query results to an Excel-compatible XML Spreadsheet 2003 format.
 */
export function exportToExcelXml(resultSet: ResultSet, sheetName = 'Query Results'): string {
  const headerCells = resultSet.columns
    .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c.name)}</Data></Cell>`)
    .join('');

  const rowCells = resultSet.rows
    .map((row) => {
      const cells = resultSet.columns
        .map((c) => {
          const val = (row as any)[c.name];
          if (val === null || val === undefined) {
            return '<Cell><Data ss:Type="String"></Data></Cell>';
          }
          if (typeof val === 'number') {
            return `<Cell><Data ss:Type="Number">${val}</Data></Cell>`;
          }
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `<Cell><Data ss:Type="String">${escapeXml(str)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   <Row>${headerCells}</Row>
   ${rowCells}
  </Table>
 </Worksheet>
</Workbook>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Triggers a client-side file download for a Blob or string.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
