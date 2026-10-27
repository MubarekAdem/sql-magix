import React, { useState } from 'react';
import {
  Database,
  X,
  Server,
  Shield,
  Loader2,
  AlertTriangle,
  Check,
  Terminal,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { DatabaseSchema, DbCapabilities, Dialect } from 'sql-magic-core';

interface ConnectDatabaseModalProps {
  isServerMode: boolean;
  onConnect: (
    url: string,
    readOnly: boolean
  ) => Promise<{
    dialect: Dialect;
    capabilities: DbCapabilities;
    targetPath: string;
    schema: DatabaseSchema;
  }>;
  onClose: () => void;
}

const TEMPLATES = [
  {
    name: 'PostgreSQL',
    dialect: 'postgres',
    placeholder: 'postgres://postgres:password@localhost:5432/dbname',
    example: 'postgres://postgres:password@localhost:5432/postgres',
    desc: 'Local or cloud PostgreSQL instance (Supabase, Neon, RDS, Docker)',
  },
  {
    name: 'MySQL / MariaDB',
    dialect: 'mysql',
    placeholder: 'mysql://root:password@localhost:3306/dbname',
    example: 'mysql://root:password@127.0.0.1:3306/mysql',
    desc: 'Local or cloud MySQL / MariaDB server (PlanetScale, RDS, Docker)',
  },
  {
    name: 'SQLite File',
    dialect: 'sqlite',
    placeholder: './app.db',
    example: './app.db',
    desc: 'Server-side SQLite file path on your local filesystem',
  },
];

export const ConnectDatabaseModal: React.FC<ConnectDatabaseModalProps> = ({
  isServerMode,
  onConnect,
  onClose,
}) => {
  const [selectedDialect, setSelectedDialect] = useState<string>('postgres');
  const [connectionUrl, setConnectionUrl] = useState<string>(
    'postgres://postgres:password@localhost:5432/postgres'
  );
  const [isReadOnly, setIsReadOnly] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const handleSelectTemplate = (tpl: (typeof TEMPLATES)[0]) => {
    setSelectedDialect(tpl.dialect);
    setConnectionUrl(tpl.example);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionUrl.trim()) return;

    if (!isServerMode) {
      // In browser-only mode, prompt the user with the CLI command
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);

    try {
      await onConnect(connectionUrl.trim(), isReadOnly);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  const cliCommand = isReadOnly
    ? `pnpm start "${connectionUrl}"`
    : `pnpm start "${connectionUrl}" --allow-write`;

  const handleCopyCli = async () => {
    try {
      await navigator.clipboard.writeText(cliCommand);
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden transition-all duration-150">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between shrink-0 bg-white dark:bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">
                Connect Database
              </span>
              <span className="ml-2 text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                Postgres • MySQL • SQLite
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Dialect Tabs */}
          <div>
            <label className="block text-xs font-semibold text-[#1b202a] dark:text-[#edf0f6] mb-2">
              Select Engine / Dialect
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((tpl) => {
                const isSelected = selectedDialect === tpl.dialect;
                return (
                  <button
                    type="button"
                    key={tpl.dialect}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                        : 'border-[#e2e6ee] dark:border-[#262e40] bg-[#f8f9fb] dark:bg-[#11141c] hover:bg-white dark:hover:bg-[#161a24]'
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold mb-0.5 ${
                        isSelected
                          ? 'text-indigo-600 dark:text-indigo-300'
                          : 'text-[#1b202a] dark:text-white'
                      }`}
                    >
                      {tpl.name}
                    </span>
                    <span className="text-[10px] text-[#8c96a8] line-clamp-1 font-mono">
                      {tpl.dialect}://
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection URL Input */}
          <div>
            <label className="block text-xs font-semibold text-[#1b202a] dark:text-[#edf0f6] mb-1.5">
              Connection URL or File Path
            </label>
            <input
              type="text"
              value={connectionUrl}
              onChange={(e) => setConnectionUrl(e.target.value)}
              placeholder="postgres://user:password@localhost:5432/dbname"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-[#fafbfe] dark:bg-[#0c0e14] text-[#1b202a] dark:text-white font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
              required
            />
            <span className="text-[11px] text-[#8c96a8] mt-1 block">
              Credentials are kept server-side and passwords are automatically masked in logs.
            </span>
          </div>

          {/* Read-Only Safety Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-[#f8f9fb] dark:bg-[#11141c]">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <span className="text-xs font-medium text-[#1b202a] dark:text-white block">
                  Read-Only Mode
                </span>
                <span className="text-[11px] text-[#8c96a8]">
                  Enforces transaction read-only safety at the engine level
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isReadOnly}
                onChange={(e) => setIsReadOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Browser Mode Notice (if user is running Vite without server backend) */}
          {!isServerMode && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Backend Studio Server Required for TCP Protocols</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#5f687a] dark:text-[#98a0af]">
                Web browsers cannot speak raw PostgreSQL or MySQL wire protocols directly over TCP.
                Run this command in your terminal to start the server studio:
              </p>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-black/40 font-mono text-[11px] text-indigo-600 dark:text-indigo-300 overflow-x-auto">
                <span className="truncate">{cliCommand}</span>
                <button
                  type="button"
                  onClick={handleCopyCli}
                  className="flex items-center gap-1 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white shrink-0 ml-2"
                >
                  {copiedCli ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 font-mono">
              {errorMessage}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e2e6ee] dark:border-[#222938]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
            >
              Cancel
            </button>
            {isServerMode ? (
              <button
                type="submit"
                disabled={isConnecting}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-xs transition disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Server className="w-3.5 h-3.5" />
                    <span>Connect Database</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyCli}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-xs transition"
              >
                {copiedCli ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Command Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Server Command</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
