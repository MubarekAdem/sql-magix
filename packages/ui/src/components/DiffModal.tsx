import React, { useState } from 'react';
import type { ResultSet } from 'sql-magic-core';
import { diffResultSets, type ResultSetDiff } from 'sql-magic-core';
import {
  GitCompare,
  X,
  Plus,
  Minus,
  Edit2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface DiffModalProps {
  currentResultSet: ResultSet;
  previousResultSet?: ResultSet | null;
  onClose: () => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  currentResultSet,
  previousResultSet,
  onClose,
}) => {
  const baselineRows = previousResultSet?.rows || currentResultSet.rows.slice(0, Math.max(1, currentResultSet.rows.length - 1));

  const diff: ResultSetDiff = diffResultSets(
    baselineRows,
    currentResultSet.rows,
    [currentResultSet.columns[0]?.name || 'id']
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <GitCompare className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Query Results Diff</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff Metrics */}
        <div className="grid grid-cols-4 p-4 bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938] text-center font-mono text-xs">
          <div>
            <span className="text-[#8c96a8] block text-[10px] uppercase font-sans font-medium">Identical</span>
            <span className="font-bold text-base text-[#1b202a] dark:text-[#edf0f6]">{diff.identicalCount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-sans font-medium">Added</span>
            <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">+{diff.addedRows.length}</span>
          </div>
          <div>
            <span className="text-rose-600 dark:text-rose-400 block text-[10px] uppercase font-sans font-medium">Removed</span>
            <span className="font-bold text-base text-rose-600 dark:text-rose-400">-{diff.removedRows.length}</span>
          </div>
          <div>
            <span className="text-amber-600 dark:text-amber-400 block text-[10px] uppercase font-sans font-medium">Modified</span>
            <span className="font-bold text-base text-amber-600 dark:text-amber-400">~{diff.modifiedRows.length}</span>
          </div>
        </div>

        {/* Diff List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 font-mono text-xs">
          {diff.addedRows.map((row, idx) => (
            <div
              key={`add_${idx}`}
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 space-y-1.5"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-sans">
                <Plus className="w-3.5 h-3.5" />
                <span>Added Record</span>
              </div>
              <pre className="text-xs overflow-x-auto text-[#1b202a] dark:text-[#edf0f6]">{JSON.stringify(row, null, 2)}</pre>
            </div>
          ))}

          {diff.modifiedRows.map((mod, idx) => (
            <div
              key={`mod_${idx}`}
              className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300 space-y-2"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-sans">
                <Edit2 className="w-3.5 h-3.5" />
                <span>Modified Record ({mod.key})</span>
              </div>
              <div className="space-y-1 pl-3 border-l-2 border-amber-300 dark:border-amber-800/60 font-mono">
                {mod.changes.map((chg) => (
                  <div key={chg.column} className="flex items-center gap-2 text-xs">
                    <span className="text-[#5f687a] dark:text-[#98a0af]">{chg.column}:</span>
                    <span className="line-through text-rose-500">{String(chg.oldValue)}</span>
                    <span className="text-[#8c96a8]">➜</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{String(chg.newValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {diff.removedRows.map((row, idx) => (
            <div
              key={`rem_${idx}`}
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 space-y-1.5"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 font-sans">
                <Minus className="w-3.5 h-3.5" />
                <span>Removed Record</span>
              </div>
              <pre className="text-xs overflow-x-auto text-[#5f687a] dark:text-[#98a0af]">{JSON.stringify(row, null, 2)}</pre>
            </div>
          ))}

          {diff.addedRows.length === 0 && diff.modifiedRows.length === 0 && diff.removedRows.length === 0 && (
            <div className="py-12 text-center text-[#8c96a8] font-sans text-xs">
              Result sets are 100% identical. No differences found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex justify-end bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
          >
            Close Diff
          </button>
        </div>
      </div>
    </div>
  );
};
