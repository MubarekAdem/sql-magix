export interface ColumnStatistics {
  column: string;
  totalRows: number;
  nullCount: number;
  nullPercent: number;
  distinctCount: number;
  isNumeric: boolean;
  min?: number | string;
  max?: number | string;
  sum?: number;
  avg?: number;
  topValues: { value: string; count: number; percent: number }[];
  histogram?: { label: string; min: number; max: number; count: number; percent: number }[];
}

/**
 * Computes deep statistical metrics and distribution for a specific column in a row dataset.
 */
export function computeColumnStatistics(
  rows: Record<string, unknown>[],
  columnName: string
): ColumnStatistics {
  const totalRows = rows.length;
  if (totalRows === 0) {
    return {
      column: columnName,
      totalRows: 0,
      nullCount: 0,
      nullPercent: 0,
      distinctCount: 0,
      isNumeric: false,
      topValues: [],
    };
  }

  let nullCount = 0;
  const valueCounts = new Map<string, number>();
  const numericValues: number[] = [];
  let isNumeric = true;
  let nonNullCount = 0;

  for (const row of rows) {
    const val = row[columnName];
    if (val === null || val === undefined) {
      nullCount++;
      continue;
    }

    nonNullCount++;
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
    valueCounts.set(strVal, (valueCounts.get(strVal) || 0) + 1);

    if (isNumeric) {
      if (typeof val === 'number') {
        numericValues.push(val);
      } else if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
        numericValues.push(Number(val));
      } else {
        isNumeric = false;
      }
    }
  }

  // Null percentage
  const nullPercent = Number(((nullCount / totalRows) * 100).toFixed(1));
  const distinctCount = valueCounts.size;

  // Top values
  const sortedValues = Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([val, count]) => ({
      value: val,
      count,
      percent: Number(((count / totalRows) * 100).toFixed(1)),
    }));

  const stats: ColumnStatistics = {
    column: columnName,
    totalRows,
    nullCount,
    nullPercent,
    distinctCount,
    isNumeric: isNumeric && numericValues.length > 0,
    topValues: sortedValues,
  };

  // If numeric, compute min, max, avg, sum and histogram
  if (stats.isNumeric && numericValues.length > 0) {
    numericValues.sort((a, b) => a - b);
    const min = numericValues[0];
    const max = numericValues[numericValues.length - 1];
    const sum = numericValues.reduce((acc, n) => acc + n, 0);
    const avg = Number((sum / numericValues.length).toFixed(2));

    stats.min = min;
    stats.max = max;
    stats.sum = sum;
    stats.avg = avg;

    // Build histogram (up to 6 buckets)
    if (min !== max) {
      const bucketCount = Math.min(6, numericValues.length);
      const step = (max - min) / bucketCount;
      const buckets: { label: string; min: number; max: number; count: number; percent: number }[] = [];

      for (let i = 0; i < bucketCount; i++) {
        const bMin = min + i * step;
        const bMax = min + (i + 1) * step;
        buckets.push({
          label: `${bMin.toFixed(1)} - ${bMax.toFixed(1)}`,
          min: bMin,
          max: bMax,
          count: 0,
          percent: 0,
        });
      }

      for (const n of numericValues) {
        let bIdx = Math.floor((n - min) / step);
        if (bIdx >= bucketCount) bIdx = bucketCount - 1;
        buckets[bIdx].count++;
      }

      for (const b of buckets) {
        b.percent = Number(((b.count / numericValues.length) * 100).toFixed(1));
      }

      stats.histogram = buckets;
    }
  } else if (nonNullCount > 0) {
    // Non-numeric min/max by lexicographical order
    const keys = Array.from(valueCounts.keys()).sort();
    stats.min = keys[0];
    stats.max = keys[keys.length - 1];
  }

  return stats;
}
