import React, { useState, useMemo } from 'react';
import type { ResultSet, TableInfo } from '@sql-magic/core';
import { computeColumnStatistics, type ColumnStatistics } from '@sql-magic/core';
import {
  X,
  BarChart2,
  Hash,
  Layers,
  Percent,
  CheckCircle,
  HelpCircle,
  Activity,
  ChevronDown,
} from 'lucide-react';

interface ColumnStatsModalProps {
  resultSet: ResultSet;
  tableInfo?: TableInfo | null;
  initialColumn?: string;
  onClose: () => void;
}

export const ColumnStatsModal: React.FC<ColumnStatsModalProps> = ({
  resultSet,
  tableInfo,
  initialColumn,
  onClose,
}) => {
  const columns = useMemo(() => resultSet.columns.map((c) => c.name), [resultSet.columns]);
  const [selectedColumn, setSelectedColumn] = useState<string>(
    initialColumn || columns[0] || ''
  );

  const stats: ColumnStatistics = useMemo(() => {
    return computeColumnStatistics(resultSet.rows, selectedColumn);
  }, [resultSet.rows, selectedColumn]);

  const maxTopCount = useMemo(() => {
    if (!stats.topValues || stats.topValues.length === 0) return 1;
    return Math.max(...stats.topValues.map((v) => v.count));
  }, [stats.topValues]);

  const maxHistogramCount = useMemo(() => {
    if (!stats.histogram || stats.histogram.length === 0) return 1;
    return Math.max(...stats.histogram.map((h) => h.count));
  }, [stats.histogram]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm text-white">Column Statistics & Profiler</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Column Selector */}
        <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-medium text-zinc-400">Target Column:</label>
            <div className="relative flex-1 max-w-xs">
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-xs text-zinc-500 font-mono">
            {stats.totalRows} sample rows analyzed
          </span>
        </div>

        {/* Stats Viewport */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
              <div className="text-[11px] text-zinc-400 font-medium">Distinct Values</div>
              <div className="text-lg font-bold text-white font-mono mt-0.5">
                {stats.distinctCount}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                {((stats.distinctCount / (stats.totalRows || 1)) * 100).toFixed(1)}% unique
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
              <div className="text-[11px] text-zinc-400 font-medium">Missing / NULL</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                {stats.nullCount}
              </div>
              <div className="text-[10px] text-amber-500/80 mt-0.5">
                {stats.nullPercent}% null
              </div>
            </div>

            {stats.isNumeric ? (
              <>
                <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                  <div className="text-[11px] text-zinc-400 font-medium">Average (Mean)</div>
                  <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">
                    {stats.avg ?? '—'}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    Sum: {stats.sum?.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                  <div className="text-[11px] text-zinc-400 font-medium">Min / Max Range</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-1 truncate">
                    {stats.min} → {stats.max}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                  <div className="text-[11px] text-zinc-400 font-medium">Type Classification</div>
                  <div className="text-sm font-bold text-indigo-400 font-mono mt-1">
                    Text / Discrete
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                  <div className="text-[11px] text-zinc-400 font-medium">Top Frequency</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-1 truncate">
                    {stats.topValues[0]?.value || '—'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Numeric Histogram */}
          {stats.isNumeric && stats.histogram && stats.histogram.length > 0 && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" /> Numeric Value Distribution (Histogram)
              </h3>
              <div className="space-y-2">
                {stats.histogram.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                    <span className="w-28 text-right text-zinc-400 truncate text-[11px]">
                      {b.label}
                    </span>
                    <div className="flex-1 bg-zinc-900 rounded-full h-3 overflow-hidden border border-zinc-800/60">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(2, (b.count / maxHistogramCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-zinc-300 text-right text-[11px]">
                      {b.count} <span className="text-zinc-500">({b.percent}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Frequent Values */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
            <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" /> Most Frequent Values
            </h3>
            {stats.topValues.length === 0 ? (
              <div className="text-xs text-zinc-500 italic">No non-null values</div>
            ) : (
              <div className="space-y-2">
                {stats.topValues.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                    <span className="w-36 text-zinc-200 truncate font-semibold" title={v.value}>
                      {v.value}
                    </span>
                    <div className="flex-1 bg-zinc-900 rounded-full h-3 overflow-hidden border border-zinc-800/60">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(2, (v.count / maxTopCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-zinc-300 text-right text-[11px]">
                      {v.count} <span className="text-zinc-500">({v.percent}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          >
            Close Profiler
          </button>
        </div>
      </div>
    </div>
  );
};
