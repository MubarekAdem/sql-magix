import React, { useState } from 'react';
import type { DbAdapter } from 'sql-magic-core';
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-md w-full flex flex-col transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Attach Database</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
              Database Path or URI
            </label>
            <input
              type="text"
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              placeholder="./analytics.db or :memory:"
              className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
              Schema Alias (Namespace)
            </label>
            <input
              type="text"
              value={schemaAlias}
              onChange={(e) => setSchemaAlias(e.target.value)}
              placeholder="e.g. archive, analytics"
              className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
            <p className="text-[11px] text-[#8c96a8] mt-1.5">
              Enables cross-database queries: <code className="font-mono text-indigo-600 dark:text-indigo-400">SELECT * FROM {schemaAlias}.table_name</code>
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 font-mono">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex justify-end gap-2.5 bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={handleAttach}
            disabled={!dbPath.trim() || !schemaAlias.trim() || isAttaching}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-40 transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAttaching ? 'Attaching...' : 'Attach Database'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
