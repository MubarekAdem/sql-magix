import React, { useState } from 'react';
import type { ResultSet } from '@sql-magic/core';
import { diffResultSets, type ResultSetDiff } from '@sql-magic/core';
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
  // If no previous result set provided, generate mock previous baseline (simulating before/after)
  const baselineRows = previousResultSet?.rows || currentResultSet.rows.slice(0, Math.max(1, currentResultSet.rows.length - 1));

  const diff: ResultSetDiff = diffResultSets(
    baselineRows,
    currentResultSet.rows,
    [currentResultSet.columns[0]?.name || 'id']
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm text-white">Query Results Diff</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff Metrics */}
        <div className="grid grid-cols-4 p-3 bg-zinc-950 border-b border-zinc-800 text-center font-mono text-xs">
          <div>
            <span className="text-zinc-500 block text-[10px] uppercase font-sans">Identical</span>
            <span className="font-bold text-zinc-300">{diff.identicalCount}</span>
          </div>
          <div>
            <span className="text-emerald-500 block text-[10px] uppercase font-sans">Added</span>
            <span className="font-bold text-emerald-400">+{diff.addedRows.length}</span>
          </div>
          <div>
            <span className="text-rose-500 block text-[10px] uppercase font-sans">Removed</span>
            <span className="font-bold text-rose-400">-{diff.removedRows.length}</span>
          </div>
          <div>
            <span className="text-amber-500 block text-[10px] uppercase font-sans">Modified</span>
            <span className="font-bold text-amber-400">~{diff.modifiedRows.length}</span>
          </div>
        </div>

        {/* Diff List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
          {diff.addedRows.map((row, idx) => (
            <div
              key={`add_${idx}`}
              className="p-2.5 rounded bg-emerald-950/20 border border-emerald-800/50 text-emerald-300 space-y-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-emerald-400">
                <Plus className="w-3.5 h-3.5" /> Added Row
              </div>
              <pre className="text-[11px] overflow-x-auto">{JSON.stringify(row)}</pre>
            </div>
          ))}

          {diff.modifiedRows.map((mod, idx) => (
            <div
              key={`mod_${idx}`}
              className="p-2.5 rounded bg-amber-950/20 border border-amber-800/50 text-amber-300 space-y-2"
            >
              <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-amber-400">
                <Edit2 className="w-3.5 h-3.5" /> Modified Record ({mod.key})
              </div>
              <div className="space-y-1 pl-2 border-l border-amber-800/60">
                {mod.changes.map((chg) => (
                  <div key={chg.column} className="flex items-center gap-2 text-[11px]">
                    <span className="text-zinc-400">{chg.column}:</span>
                    <span className="line-through text-rose-400">{String(chg.oldValue)}</span>
                    <span>➜</span>
                    <span className="text-emerald-400 font-bold">{String(chg.newValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {diff.removedRows.map((row, idx) => (
            <div
              key={`rem_${idx}`}
              className="p-2.5 rounded bg-rose-950/20 border border-rose-800/50 text-rose-300 space-y-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-rose-400">
                <Minus className="w-3.5 h-3.5" /> Removed Row
              </div>
              <pre className="text-[11px] overflow-x-auto">{JSON.stringify(row)}</pre>
            </div>
          ))}

          {diff.addedRows.length === 0 &&
            diff.modifiedRows.length === 0 &&
            diff.removedRows.length === 0 && (
              <div className="py-12 text-center text-zinc-500 font-sans text-xs flex flex-col items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-500/60" />
                <span>Result sets are identical. Zero differences found.</span>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          >
            Close Diff
          </button>
        </div>
      </div>
    </div>
  );
};
