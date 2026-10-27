import React, { useState, useMemo } from 'react';
import type { ResultSet, TableInfo } from 'sql-magic-core';
import { computeColumnStatistics, type ColumnStatistics } from 'sql-magic-core';
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Column Statistics & Profiler</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Column Selector */}
        <div className="p-4 bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-medium text-[#5f687a] dark:text-[#98a0af]">Column:</label>
            <div className="relative flex-1 max-w-xs">
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full bg-white dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-mono font-medium focus:outline-none cursor-pointer"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-xs text-[#8c96a8] font-mono">
            {stats.totalRows.toLocaleString()} rows analyzed
          </span>
        </div>

        {/* Stats Viewport */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Metrics Grid with Concentric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
              <div className="text-[11px] text-[#5f687a] dark:text-[#98a0af] font-medium">Distinct Values</div>
              <div className="text-lg font-bold text-[#1b202a] dark:text-white font-mono mt-0.5">
                {stats.distinctCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#8c96a8] mt-0.5 font-mono">
                {((stats.distinctCount / (stats.totalRows || 1)) * 100).toFixed(1)}% unique
              </div>
            </div>

            <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
              <div className="text-[11px] text-[#5f687a] dark:text-[#98a0af] font-medium">Missing / NULL</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {stats.nullCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 font-mono">
                {stats.nullPercent}% null
              </div>
            </div>

            {stats.isNumeric ? (
              <>
                <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
                  <div className="text-[11px] text-[#5f687a] dark:text-[#98a0af] font-medium">Average (Mean)</div>
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                    {stats.avg ?? '—'}
                  </div>
                  <div className="text-[10px] text-[#8c96a8] mt-0.5 font-mono">
                    Sum: {stats.sum?.toLocaleString()}
                  </div>
                </div>

                <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
                  <div className="text-[11px] text-[#5f687a] dark:text-[#98a0af] font-medium">Min / Max Range</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1.5 truncate">
                    {stats.min} → {stats.max}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
                  <div className="text-[11px] text-[#5f687a] dark:text-[#98a0af] font-medium">Classification</div>
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-1.5">
                    Text / Discrete
                  </div>
                </div>

                <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
                  <div className="text-[11px] text-[#5f687a] dark:text-[#98a0af] font-medium">Top Frequency</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1.5 truncate">
                    {stats.topValues[0]?.value || '—'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Numeric Histogram */}
          {stats.isNumeric && stats.histogram && stats.histogram.length > 0 && (
            <div className="p-4 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
              <h3 className="text-xs font-semibold text-[#1b202a] dark:text-white mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                <span>Value Distribution (Histogram)</span>
              </h3>
              <div className="space-y-2">
                {stats.histogram.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                    <span className="w-28 text-right text-[#5f687a] dark:text-[#98a0af] truncate text-[11px]">
                      {b.label}
                    </span>
                    <div className="flex-1 bg-white dark:bg-[#161a24] rounded-full h-3 overflow-hidden border border-[#e2e6ee] dark:border-[#262e40]">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(2, (b.count / maxHistogramCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-[#1b202a] dark:text-[#edf0f6] text-right text-[11px]">
                      {b.count} <span className="text-[#8c96a8]">({b.percent}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Frequent Values */}
          <div className="p-4 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
            <h3 className="text-xs font-semibold text-[#1b202a] dark:text-white mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              <span>Most Frequent Values</span>
            </h3>
            {stats.topValues.length === 0 ? (
              <div className="text-xs text-[#8c96a8] italic">No non-null values</div>
            ) : (
              <div className="space-y-2">
                {stats.topValues.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                    <span className="w-36 text-[#1b202a] dark:text-[#edf0f6] truncate font-medium" title={v.value}>
                      {v.value}
                    </span>
                    <div className="flex-1 bg-white dark:bg-[#161a24] rounded-full h-3 overflow-hidden border border-[#e2e6ee] dark:border-[#262e40]">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(2, (v.count / maxTopCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-[#1b202a] dark:text-[#edf0f6] text-right text-[11px]">
                      {v.count} <span className="text-[#8c96a8]">({v.percent}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex justify-end bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
