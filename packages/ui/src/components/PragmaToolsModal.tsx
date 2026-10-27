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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">PRAGMA Diagnostics</span>
              <span className="ml-2 text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[#eef1f6] dark:bg-[#1f2433] text-[#5f687a] dark:text-[#98a0af]">
                SQLite Only
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: Actions List & Execution Result */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 gap-2.5">
            {PRAGMA_COMMANDS.map((cmd) => (
              <div
                key={cmd.name}
                className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl flex items-center justify-between gap-3 group hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-150"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-xs text-[#1b202a] dark:text-[#edf0f6]">{cmd.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#eef1f6] dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af]">
                      {cmd.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#5f687a] dark:text-[#98a0af] leading-relaxed">
                    {cmd.description}
                  </p>
                  <code className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">
                    {cmd.command}
                  </code>
                </div>

                <button
                  onClick={() => handleRun(cmd)}
                  disabled={isRunning}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#1b202a] dark:text-[#edf0f6] hover:bg-[#f1f3f7] dark:hover:bg-[#202534] transition active:scale-[0.98] shrink-0"
                >
                  Run
                </button>
              </div>
            ))}
          </div>

          {/* Results Block */}
          {result && (
            <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl space-y-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Result: {selectedAction.name} ({result.rowCount} rows)</span>
              </span>
              <div className="rounded-lg border border-[#e2e6ee] dark:border-[#222938] overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-white dark:bg-[#161a24] border-b border-[#e2e6ee] dark:border-[#222938] text-[#5f687a] dark:text-[#98a0af]">
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c.name} className="px-3 py-2 font-medium">{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938] bg-white dark:bg-[#0c0e14]">
                    {result.rows.map((r, i) => (
                      <tr key={i}>
                        {result.columns.map((c) => (
                          <td key={c.name} className="px-3 py-1.5 text-[#1b202a] dark:text-[#edf0f6]">{String(r[c.name])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 font-mono">
              {error}
            </div>
          )}
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
