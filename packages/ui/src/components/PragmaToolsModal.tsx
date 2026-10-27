import React, { useState } from 'react';
import type { DbAdapter, ResultSet } from '@sql-magic/core';
import {
  Sparkles,
  X,
  Play,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle,
  Database,
} from 'lucide-react';

interface PragmaToolsModalProps {
  adapter: DbAdapter;
  onClose: () => void;
}

interface PragmaAction {
  name: string;
  command: string;
  description: string;
  badge: string;
}

const PRAGMA_COMMANDS: PragmaAction[] = [
  {
    name: 'Database Integrity Check',
    command: 'PRAGMA integrity_check;',
    description: 'Scans for out-of-order records, missing pages, malformed records, and corrupt indexes.',
    badge: 'Integrity',
  },
  {
    name: 'Foreign Key Constraint Check',
    command: 'PRAGMA foreign_key_check;',
    description: 'Finds any foreign key relationships that are broken or point to nonexistent keys.',
    badge: 'Constraints',
  },
  {
    name: 'Quick Check',
    command: 'PRAGMA quick_check;',
    description: 'A faster integrity test that skips index format checking.',
    badge: 'Health',
  },
  {
    name: 'VACUUM Database',
    command: 'VACUUM;',
    description: 'Rebuilds database file, defragmenting pages and shrinking disk footprint.',
    badge: 'Maintenance',
  },
  {
    name: 'ANALYZE Statistics',
    command: 'ANALYZE;',
    description: 'Gathers table and index statistics into sqlite_stat1 for the query optimizer.',
    badge: 'Optimizer',
  },
  {
    name: 'Compile Options',
    command: 'PRAGMA compile_options;',
    description: 'Inspects build flags and SQLite extensions compiled into this binary (e.g. FTS5, JSON1).',
    badge: 'Engine',
  },
];

export const PragmaToolsModal: React.FC<PragmaToolsModalProps> = ({
  adapter,
  onClose,
}) => {
  const [selectedAction, setSelectedAction] = useState<PragmaAction>(PRAGMA_COMMANDS[0]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<ResultSet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (action: PragmaAction) => {
    setSelectedAction(action);
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await adapter.query(action.command);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm text-white">SQLite PRAGMA Diagnostic Suite</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden divide-x divide-zinc-800">
          {/* Actions List */}
          <div className="w-72 overflow-y-auto p-2 space-y-1.5 bg-zinc-950/60">
            {PRAGMA_COMMANDS.map((act) => (
              <button
                key={act.command}
                onClick={() => handleRun(act)}
                className={`w-full text-left p-2.5 rounded-lg transition ${
                  selectedAction.command === act.command
                    ? 'bg-amber-950/40 border border-amber-700/60 text-white'
                    : 'text-zinc-300 hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{act.name}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                    {act.badge}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 line-clamp-2">{act.description}</div>
              </button>
            ))}
          </div>

          {/* Results Viewport */}
          <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedAction.name}</h3>
                <code className="text-xs text-amber-400 font-mono mt-1 block">
                  {selectedAction.command}
                </code>
              </div>

              {isRunning && (
                <div className="py-8 text-center text-xs text-zinc-400 animate-pulse font-mono">
                  Executing {selectedAction.command}...
                </div>
              )}

              {error && (
                <div className="p-3 rounded bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-mono">
                  {error}
                </div>
              )}

              {result && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-400">Execution Output:</span>
                  <div className="overflow-auto max-h-64 border border-zinc-800 rounded-lg">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400">
                        <tr>
                          {result.columns.map((c, i) => (
                            <th key={i} className="px-3 py-1.5 font-medium">
                              {c.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {result.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-zinc-900">
                            {result.columns.map((c, cIdx) => (
                              <td key={cIdx} className="px-3 py-1 text-zinc-200">
                                {String((row as any)[c.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => handleRun(selectedAction)}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Re-run Command</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
