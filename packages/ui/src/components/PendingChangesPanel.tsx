import React, { useState } from 'react';
import type { ChangeItem, Dialect } from 'sql-magic-core';
import { generateCommitScript, generateSqlForChange } from 'sql-magic-core';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  FileCode,
  Trash2,
  PlusCircle,
  Edit2,
  X,
  Play,
  Copy,
  Check,
} from 'lucide-react';

interface PendingChangesPanelProps {
  changes: ChangeItem[];
  dialect: Dialect;
  onCommit: () => Promise<void>;
  onRevertChange: (id: string) => void;
  onDiscardAll: () => void;
  onClose: () => void;
  isReadOnly?: boolean;
}

export const PendingChangesPanel: React.FC<PendingChangesPanelProps> = ({
  changes,
  dialect,
  onCommit,
  onRevertChange,
  onDiscardAll,
  onClose,
  isReadOnly,
}) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'sql'>('diff');
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const sqlScript = generateCommitScript(changes, dialect);

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExecuteCommit = async () => {
    setIsCommitting(true);
    try {
      await onCommit();
      onClose();
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] font-sans transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Review Pending Changes</span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-mono">
              {changes.length} {changes.length === 1 ? 'change' : 'changes'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Warning Notice if on read-only server */}
        {isReadOnly && (
          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>
              Database connection is in <strong>Read-Only</strong> mode. Committing changes requires launching with <code className="bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded font-mono">--allow-write</code>.
            </span>
          </div>
        )}

        {/* Tabs: Visual Diff vs SQL Script with Concentric Pill Style */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center p-1 rounded-xl bg-[#eef1f6] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] gap-1">
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
                activeTab === 'diff'
                  ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
            >
              Changeset Diff
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
                activeTab === 'sql'
                  ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
            >
              SQL Script
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'sql' && (
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1.5 text-xs text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white py-1 px-2.5 rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] transition active:scale-[0.98]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy SQL'}</span>
              </button>
            )}
            <button
              onClick={onDiscardAll}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 py-1 px-2.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-[0.98]"
            >
              Discard All
            </button>
          </div>
        </div>

        {/* Viewport Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'diff' && (
            <div className="space-y-2 font-mono text-xs">
              {changes.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl flex items-center justify-between group hover:border-[#ccd2df] dark:hover:border-[#38435c] transition-all duration-150"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {c.type === 'update-cell' && (
                      <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 mt-0.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {c.type === 'insert-row' && (
                      <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 mt-0.5">
                        <PlusCircle className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {c.type === 'delete-row' && (
                      <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 mt-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[#1b202a] dark:text-[#edf0f6]">{c.table}</span>
                        <span className="text-[10px] uppercase font-bold text-[#8c96a8]">
                          {c.type.replace('-', ' ')}
                        </span>
                      </div>

                      {c.type === 'update-cell' && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#5f687a] dark:text-[#98a0af]">{c.column}:</span>
                          <span className="line-through text-rose-500/80">
                            {String(c.oldValue ?? 'NULL')}
                          </span>
                          <span className="text-[#8c96a8]">➜</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {String(c.newValue ?? 'NULL')}
                          </span>
                        </div>
                      )}

                      {c.type === 'insert-row' && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate max-w-md">
                          {JSON.stringify(c.values)}
                        </div>
                      )}

                      {c.type === 'delete-row' && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 truncate max-w-md">
                          Row matching PK: {JSON.stringify(c.pkValues)}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onRevertChange(c.id)}
                    className="p-1.5 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg transition"
                    title="Revert Change"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sql' && (
            <pre className="p-4 bg-[#f8f9fb] dark:bg-[#0e1117] border border-[#e2e6ee] dark:border-[#222938] rounded-xl text-xs font-mono text-[#3f4756] dark:text-[#c4cad4] overflow-x-auto leading-relaxed">
              {sqlScript}
            </pre>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
          <span className="text-xs text-[#5f687a] dark:text-[#98a0af]">
            {changes.length} operations will execute in an atomic transaction.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
            >
              Continue Editing
            </button>
            <button
              onClick={handleExecuteCommit}
              disabled={isCommitting || isReadOnly || changes.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-50 transition shadow-2xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{isCommitting ? 'Committing...' : 'Commit Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
