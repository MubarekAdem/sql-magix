export interface CellDiff {
  column: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ModifiedRowDiff {
  key: string;
  oldRow: Record<string, unknown>;
  newRow: Record<string, unknown>;
  changes: CellDiff[];
}

export interface ResultSetDiff {
  addedRows: Record<string, unknown>[];
  removedRows: Record<string, unknown>[];
  modifiedRows: ModifiedRowDiff[];
  identicalCount: number;
  totalBefore: number;
  totalAfter: number;
}

/**
 * Compares two row arrays and returns an in-depth diff of additions, deletions, and cell edits.
 * @param beforeRows Previous query result rows
 * @param afterRows Current query result rows
 * @param keyColumns Optional list of primary key columns for identity matching
 */
export function diffResultSets(
  beforeRows: Record<string, unknown>[],
  afterRows: Record<string, unknown>[],
  keyColumns: string[] = []
): ResultSetDiff {
  const getRowKey = (row: Record<string, unknown>, idx: number): string => {
    if (keyColumns.length > 0) {
      return keyColumns.map((col) => `${col}:${row[col]}`).join('|');
    }
    // Fallback: full JSON signature or first 3 columns
    return Object.entries(row)
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
  };

  const beforeMap = new Map<string, { row: Record<string, unknown>; index: number }>();
  beforeRows.forEach((row, i) => {
    beforeMap.set(getRowKey(row, i), { row, index: i });
  });

  const addedRows: Record<string, unknown>[] = [];
  const modifiedRows: ModifiedRowDiff[] = [];
  let identicalCount = 0;
  const visitedBeforeKeys = new Set<string>();

  afterRows.forEach((row, i) => {
    const key = getRowKey(row, i);
    const beforeItem = beforeMap.get(key);

    if (!beforeItem) {
      addedRows.push(row);
    } else {
      visitedBeforeKeys.add(key);
      const oldRow = beforeItem.row;
      const allCols = Array.from(new Set([...Object.keys(oldRow), ...Object.keys(row)]));
      const changes: CellDiff[] = [];

      for (const col of allCols) {
        if (oldRow[col] !== row[col]) {
          changes.push({
            column: col,
            oldValue: oldRow[col],
            newValue: row[col],
          });
        }
      }

      if (changes.length > 0) {
        modifiedRows.push({
          key,
          oldRow,
          newRow: row,
          changes,
        });
      } else {
        identicalCount++;
      }
    }
  });

  const removedRows: Record<string, unknown>[] = [];
  beforeRows.forEach((row, i) => {
    const key = getRowKey(row, i);
    if (!visitedBeforeKeys.has(key)) {
      removedRows.push(row);
    }
  });

  return {
    addedRows,
    removedRows,
    modifiedRows,
    identicalCount,
    totalBefore: beforeRows.length,
    totalAfter: afterRows.length,
  };
}
