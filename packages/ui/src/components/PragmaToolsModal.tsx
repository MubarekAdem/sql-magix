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
  Loader2,
  Clock,
  AlertTriangle,
  Info,
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
  icon: React.ComponentType<{ className?: string }>;
}

const PRAGMA_COMMANDS: PragmaAction[] = [
  {
    name: 'Database Integrity Check',
    command: 'PRAGMA integrity_check;',
    description: 'Scans for out-of-order records, missing pages, malformed records, and corrupt indexes across the entire database.',
    badge: 'Integrity',
    icon: ShieldCheck,
  },
  {
    name: 'Foreign Key Constraint Check',
    command: 'PRAGMA foreign_key_check;',
    description: 'Finds any foreign key relationships that are broken, point to nonexistent parent rows, or violate constraints.',
    badge: 'Constraints',
    icon: Activity,
  },
  {
    name: 'Quick Health Check',
    command: 'PRAGMA quick_check;',
    description: 'A faster structural integrity test that skips comprehensive index verification while validating database pages.',
    badge: 'Health',
    icon: Zap,
  },
  {
    name: 'VACUUM Database',
    command: 'VACUUM;',
    description: 'Rebuilds the entire database file, defragmenting free pages and shrinking disk footprint back to minimal size.',
    badge: 'Maintenance',
    icon: Database,
  },
  {
    name: 'ANALYZE Statistics',
    command: 'ANALYZE;',
    description: 'Gathers table and index distribution statistics into sqlite_stat1 to help the query planner choose optimal query paths.',
    badge: 'Optimizer',
    icon: Sparkles,
  },
  {
    name: 'Compile Options Inspector',
    command: 'PRAGMA compile_options;',
    description: 'Inspects build flags and SQLite extensions compiled into this engine binary (e.g. FTS5, JSON1, RTREE).',
    badge: 'Engine',
    icon: Info,
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

  const Icon = selectedAction.icon;
  const isOkResult =
    result &&
    result.rows.length === 1 &&
    Object.values(result.rows[0])[0] === 'ok';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col h-[82vh] transition-all duration-150 overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between shrink-0 bg-white dark:bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">PRAGMA Diagnostics</span>
              <span className="ml-2 text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                SQLite Engine
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition active:scale-[0.98]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Column Split Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Command Selector */}
          <div className="w-72 shrink-0 border-r border-[#e2e6ee] dark:border-[#222938] overflow-y-auto p-3 flex flex-col gap-1.5 bg-[#f8f9fb] dark:bg-[#11141c]">
            <span className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8c96a8]">
              Diagnostic Commands
            </span>
            {PRAGMA_COMMANDS.map((cmd) => {
              const CmdIcon = cmd.icon;
              const isSelected = selectedAction.name === cmd.name;
              return (
                <button
                  key={cmd.name}
                  onClick={() => {
                    setSelectedAction(cmd);
                    setResult(null);
                    setError(null);
                  }}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all duration-150 border ${
                    isSelected
                      ? 'bg-white dark:bg-[#1a1f2c] border-amber-500/60 shadow-xs ring-1 ring-amber-500/20'
                      : 'border-transparent hover:bg-white/60 dark:hover:bg-[#161a24] text-[#5f687a] dark:text-[#98a0af]'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-black/5 dark:bg-white/[0.06] text-[#8c96a8]'
                    }`}
                  >
                    <CmdIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`text-xs font-medium truncate ${
                          isSelected
                            ? 'text-[#1b202a] dark:text-white font-semibold'
                            : 'text-[#3f4756] dark:text-[#c4cad4]'
                        }`}
                      >
                        {cmd.name}
                      </span>
                    </div>
                    <code className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono block truncate">
                      {cmd.command}
                    </code>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Active Diagnostic Workspace & Results */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#13161f]">
            {/* Action Bar */}
            <div className="p-4 border-b border-[#e2e6ee] dark:border-[#222938] bg-[#fafbfe] dark:bg-[#151922] flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-amber-500 shrink-0" />
                  <h3 className="text-sm font-semibold text-[#1b202a] dark:text-white truncate">
                    {selectedAction.name}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                    {selectedAction.badge}
                  </span>
                </div>
                <p className="text-xs text-[#5f687a] dark:text-[#98a0af] leading-relaxed line-clamp-2">
                  {selectedAction.description}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#edf0f6] dark:bg-[#1b202c] font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                  <span>SQL:</span>
                  <span className="font-semibold">{selectedAction.command}</span>
                </div>
              </div>

              <button
                onClick={() => handleRun(selectedAction)}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white shadow-sm transition disabled:opacity-50 shrink-0"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Diagnostic</span>
                  </>
                )}
              </button>
            </div>

            {/* Results Grid Area */}
            <div className="flex-1 overflow-auto p-4">
              {isRunning && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-[#8c96a8]">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="text-xs font-medium">Running {selectedAction.command}...</span>
                </div>
              )}

              {error && !isRunning && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 font-mono space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Diagnostic Execution Failed</span>
                  </div>
                  <p>{error}</p>
                </div>
              )}

              {result && !isRunning && (
                <div className="space-y-3">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#f8f9fb] dark:bg-[#171b26] border border-[#e2e6ee] dark:border-[#222938]">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-[#1b202a] dark:text-white">
                        {isOkResult ? 'Integrity Verified: Healthy' : `Returned ${result.rowCount} row(s)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#8c96a8]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{result.executionTimeMs} ms</span>
                    </div>
                  </div>

                  {/* Healthy Notice */}
                  {isOkResult && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>All SQLite data pages, pointers, and B-Tree indexes passed structural verification without corruption.</span>
                    </div>
                  )}

                  {/* Results Table */}
                  <div className="rounded-xl border border-[#e2e6ee] dark:border-[#222938] overflow-hidden shadow-xs">
                    <div className="max-h-[380px] overflow-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#f1f3f7] dark:bg-[#1a1f2c] border-b border-[#e2e6ee] dark:border-[#222938] text-[#5f687a] dark:text-[#98a0af] sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 w-12 text-[#8c96a8] font-normal">#</th>
                            {result.columns.map((c) => (
                              <th key={c.name} className="px-3 py-2 font-semibold">
                                {c.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938] bg-white dark:bg-[#101319]">
                          {result.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={result.columns.length + 1}
                                className="px-4 py-8 text-center text-xs text-[#8c96a8]"
                              >
                                {selectedAction.name === 'Foreign Key Constraint Check'
                                  ? 'No constraint violations found. All foreign key references are valid.'
                                  : 'Statement completed with 0 rows returned.'}
                              </td>
                            </tr>
                          ) : (
                            result.rows.map((r, i) => (
                              <tr
                                key={i}
                                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                              >
                                <td className="px-3 py-2 text-[#8c96a8] text-[11px] select-none">
                                  {i + 1}
                                </td>
                                {result.columns.map((c) => {
                                  const val = r[c.name];
                                  return (
                                    <td
                                      key={c.name}
                                      className="px-3 py-2 text-[#1b202a] dark:text-[#edf0f6] whitespace-nowrap"
                                    >
                                      {val === null ? (
                                        <span className="text-[#8c96a8] italic">NULL</span>
                                      ) : (
                                        String(val)
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {!result && !error && !isRunning && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-[#8c96a8] p-6">
                  <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/[0.05] border border-[#e2e6ee] dark:border-[#262e40] flex items-center justify-center text-[#8c96a8]">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#1b202a] dark:text-white mb-1">
                      Ready to inspect {selectedAction.name}
                    </h4>
                    <p className="text-[11px] text-[#5f687a] dark:text-[#98a0af] max-w-sm">
                      Click the &ldquo;Run Diagnostic&rdquo; button above to execute this command and view real-time engine statistics.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between bg-[#f8f9fb] dark:bg-[#141822] text-xs shrink-0">
          <span className="text-[#8c96a8] font-mono text-[11px]">
            Active: {selectedAction.command}
          </span>
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
