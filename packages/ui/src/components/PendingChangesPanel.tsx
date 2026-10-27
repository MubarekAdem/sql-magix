import React, { useState } from 'react';
import type { ChangeItem, Dialect } from '@sql-magic/core';
import { generateCommitScript, generateSqlForChange } from '@sql-magic/core';
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
    setTimeout(() => setCopied(null as any), 1500);
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white">Review Pending Changes</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800 font-mono">
              {changes.length} {changes.length === 1 ? 'change' : 'changes'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Warning Notice if on read-only server */}
        {isReadOnly && (
          <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Server connection is in <strong>Read-Only</strong> mode. Committing requires launching
              with <code className="bg-rose-900/40 px-1 py-0.5 rounded font-mono">--allow-write</code>.
            </span>
          </div>
        )}

        {/* Tabs: Visual Diff vs SQL Script */}
        <div className="flex items-center justify-between px-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('diff')}
              className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                activeTab === 'diff'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Changeset Diff
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                activeTab === 'sql'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Generated SQL Script
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'sql' && (
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white py-1 px-2 rounded hover:bg-zinc-800 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy SQL'}</span>
              </button>
            )}
            <button
              onClick={onDiscardAll}
              className="text-[11px] text-rose-400 hover:text-rose-300 py-1 px-2 rounded hover:bg-rose-950/40 transition"
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
                  className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg flex items-center justify-between group hover:border-zinc-700 transition"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {c.type === 'update-cell' && (
                      <div className="p-1.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60 mt-0.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {c.type === 'insert-row' && (
                      <div className="p-1.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 mt-0.5">
                        <PlusCircle className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {c.type === 'delete-row' && (
                      <div className="p-1.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/60 mt-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-200">{c.table}</span>
                        <span className="text-[10px] uppercase font-bold text-zinc-500">
                          {c.type.replace('-', ' ')}
                        </span>
                      </div>

                      {c.type === 'update-cell' && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-400">{c.column}:</span>
                          <span className="line-through text-rose-400/80">
                            {String(c.oldValue ?? 'NULL')}
                          </span>
                          <span className="text-zinc-500">➜</span>
                          <span className="text-emerald-400 font-semibold">
                            {String(c.newValue ?? 'NULL')}
                          </span>
                        </div>
                      )}

                      {c.type === 'insert-row' && (
                        <div className="text-[11px] text-emerald-400/90 truncate max-w-md">
                          {JSON.stringify(c.values)}
                        </div>
                      )}

                      {c.type === 'delete-row' && (
                        <div className="text-[11px] text-rose-400/80 truncate max-w-md">
                          Row matching PK: {JSON.stringify(c.pkValues)}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onRevertChange(c.id)}
                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition"
                    title="Revert Change"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sql' && (
            <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
              {sqlScript}
            </pre>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <span className="text-xs text-zinc-400">
            {changes.length} operations will be executed in a single atomic transaction.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
            >
              Continue Editing
            </button>
            <button
              onClick={handleExecuteCommit}
              disabled={isCommitting || isReadOnly || changes.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition shadow-sm"
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
