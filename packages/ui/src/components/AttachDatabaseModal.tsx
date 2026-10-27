import React, { useState } from 'react';
import type { DbAdapter } from '@sql-magic/core';
import {
  Database,
  X,
  Plus,
  AlertCircle,
  FileCode,
  CheckCircle,
} from 'lucide-react';

interface AttachDatabaseModalProps {
  adapter: DbAdapter;
  onRefreshSchema: () => Promise<void>;
  onClose: () => void;
}

export const AttachDatabaseModal: React.FC<AttachDatabaseModalProps> = ({
  adapter,
  onRefreshSchema,
  onClose,
}) => {
  const [dbPath, setDbPath] = useState<string>('');
  const [schemaAlias, setSchemaAlias] = useState<string>('secondary_db');
  const [isAttaching, setIsAttaching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttach = async () => {
    if (!dbPath.trim() || !schemaAlias.trim()) return;
    setIsAttaching(true);
    setError(null);
    try {
      const sql = `ATTACH DATABASE '${dbPath.replace(/'/g, "''")}' AS ${schemaAlias.replace(/[^a-zA-Z0-9_]/g, '')};`;
      await adapter.query(sql);
      await onRefreshSchema();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-md w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm text-white">Attach Secondary Database</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Database Path or URI
            </label>
            <input
              type="text"
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              placeholder="./analytics.db or :memory:"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Schema Alias (Namespace)
            </label>
            <input
              type="text"
              value={schemaAlias}
              onChange={(e) => setSchemaAlias(e.target.value)}
              placeholder="e.g. archive, analytics"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Enables cross-database queries: <code className="font-mono text-zinc-400">SELECT * FROM {schemaAlias}.table_name</code>
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end gap-2 bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAttach}
            disabled={!dbPath.trim() || !schemaAlias.trim() || isAttaching}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAttaching ? 'Attaching...' : 'Attach Database'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
