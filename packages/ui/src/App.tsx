import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DbAdapter,
  DatabaseSchema,
  TableInfo,
  ResultSet,
  Plan,
} from '@sql-magic/core';
import { SqliteEngine } from '@sql-magic/core';
import {
  Database,
  Table,
  Eye,
  Zap,
  Play,
  FileCode,
  Download,
  Upload,
  ShieldAlert,
  Info,
  Activity,
  Key,
  FolderTree,
  FileQuestion,
  RefreshCw,
  Search,
} from 'lucide-react';

export default function App() {
  const [adapter, setAdapter] = useState<DbAdapter | null>(null);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'schema' | 'explain' | 'pragma'>('grid');
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM users LIMIT 50;');
  const [queryResult, setQueryResult] = useState<ResultSet | null>(null);
  const [explainPlan, setExplainPlan] = useState<Plan | null>(null);
  const [pragmaResult, setPragmaResult] = useState<ResultSet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dbName, setDbName] = useState<string>('in-memory.db');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize SQLite engine with sample database on startup
  useEffect(() => {
    initSampleDatabase();
  }, []);

  const initSampleDatabase = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const engine = new SqliteEngine();
      await engine.init();

      // Populate demo schema
      await engine.query(`
        CREATE TABLE departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          budget REAL DEFAULT 0.0
        );

        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          department_id INTEGER,
          role TEXT DEFAULT 'engineer',
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
        );

        CREATE INDEX idx_users_department ON users(department_id);
        CREATE INDEX idx_users_role ON users(role);

        CREATE TABLE orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE VIEW v_department_summary AS
          SELECT d.id, d.name, COUNT(u.id) AS total_users, AVG(d.budget) AS budget
          FROM departments d
          LEFT JOIN users u ON u.department_id = d.id
          GROUP BY d.id;

        INSERT INTO departments (name, budget) VALUES
          ('Engineering', 150000.0),
          ('Product', 95000.0),
          ('Design', 60000.0);

        INSERT INTO users (name, email, department_id, role) VALUES
          ('Alice Johnson', 'alice@company.com', 1, 'lead_architect'),
          ('Bob Smith', 'bob@company.com', 1, 'senior_engineer'),
          ('Charlie Davis', 'charlie@company.com', 2, 'product_manager'),
          ('Diana Prince', 'diana@company.com', 3, 'ui_designer'),
          ('Ethan Hunt', 'ethan@company.com', 1, 'qa_engineer');

        INSERT INTO orders (user_id, amount) VALUES
          (1, 240.50),
          (1, 89.99),
          (2, 450.00),
          (3, 120.00);
      `);

      const introspected = await engine.getSchema();
      setAdapter(engine);
      setSchema(introspected);
      setDbName('demo_company.sqlite');
      if (introspected.tables.length > 0) {
        setSelectedTable(introspected.tables.find((t) => t.name === 'users') || introspected.tables[0]);
      }

      // Initial query run
      const initialRes = await engine.query('SELECT * FROM users LIMIT 50;');
      setQueryResult(initialRes);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const engine = new SqliteEngine({ buffer });
      await engine.init();

      const introspected = await engine.getSchema();
      setAdapter(engine);
      setSchema(introspected);
      setDbName(file.name);

      if (introspected.tables.length > 0) {
        const firstTable = introspected.tables[0];
        setSelectedTable(firstTable);
        const query = `SELECT * FROM ${engine.quoteIdent(firstTable.name)} LIMIT 50;`;
        setSqlQuery(query);
        const res = await engine.query(query);
        setQueryResult(res);
      } else {
        setSelectedTable(null);
        setQueryResult(null);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const executeQuery = useCallback(async () => {
    if (!adapter) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await adapter.query(sqlQuery);
      setQueryResult(res);
      setActiveTab('grid');

      // Refresh schema if DDL was run
      if (/^(CREATE|ALTER|DROP)\b/i.test(sqlQuery.trim())) {
        const newSchema = await adapter.getSchema();
        setSchema(newSchema);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [adapter, sqlQuery]);

  const runExplainPlan = async () => {
    if (!adapter || !adapter.capabilities.explain) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const plan = await adapter.explain(sqlQuery);
      setExplainPlan(plan);
      setActiveTab('explain');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const runPragma = async (pragmaCmd: string) => {
    if (!adapter || !adapter.capabilities.pragma) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await adapter.query(pragmaCmd);
      setPragmaResult(res);
      setActiveTab('pragma');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTable = async (table: TableInfo) => {
    if (!adapter) return;
    setSelectedTable(table);
    const query = `SELECT * FROM ${adapter.quoteIdent(table.name)} LIMIT 50;`;
    setSqlQuery(query);
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await adapter.query(query);
      setQueryResult(res);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportDatabase = () => {
    if (!adapter || !adapter.capabilities.exportDatabase) return;
    if (adapter instanceof SqliteEngine) {
      const binary = adapter.exportBinary();
      const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dbName || 'database.sqlite';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const capabilities = adapter?.capabilities;

  return (
    <div
      className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">sql-magic</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Phase 1 MVP
              </span>
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-2">
              <span className="truncate max-w-[200px]" title={dbName}>
                {dbName}
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-medium capitalize">
                {adapter?.dialect || 'disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Capability Badges */}
        <div className="flex items-center gap-1.5 text-xs">
          {capabilities?.schemas ? (
            <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/60 flex items-center gap-1">
              <FolderTree className="w-3 h-3" /> Schemas
            </span>
          ) : (
            <span
              className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800 flex items-center gap-1"
              title="Schemas not supported in SQLite"
            >
              No Schemas
            </span>
          )}

          {capabilities?.explain && (
            <span className="px-2 py-0.5 rounded bg-violet-950/60 text-violet-400 border border-violet-800/60 flex items-center gap-1">
              <Activity className="w-3 h-3" /> EXPLAIN
            </span>
          )}

          {capabilities?.pragma && (
            <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60 flex items-center gap-1">
              <Zap className="w-3 h-3" /> PRAGMA
            </span>
          )}

          {capabilities?.readOnly && (
            <span className="px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/60 flex items-center gap-1 font-semibold">
              <ShieldAlert className="w-3 h-3" /> Read-Only
            </span>
          )}

          {capabilities?.exportDatabase && (
            <button
              onClick={handleExportDatabase}
              className="ml-2 flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
              title="Download SQLite database binary"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" /> Export .db
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Open File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Schema Browser */}
        <aside className="w-64 bg-zinc-900/60 border-r border-zinc-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Database Objects
            </span>
            <button
              onClick={initSampleDatabase}
              title="Reset to Sample Database"
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* Tables List */}
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-indigo-400" />
                Tables ({schema?.tables.length ?? 0})
              </div>
              <div className="mt-1 space-y-0.5">
                {schema?.tables.map((tbl) => (
                  <button
                    key={tbl.name}
                    onClick={() => handleSelectTable(tbl)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition ${
                      selectedTable?.name === tbl.name
                        ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                        : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{tbl.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {tbl.rowCount !== undefined ? tbl.rowCount : tbl.columns.length + ' cols'}
                    </span>
                  </button>
                ))}
                {schema?.tables.length === 0 && (
                  <div className="px-2 py-2 text-xs text-zinc-500 italic">No tables found</div>
                )}
              </div>
            </div>

            {/* Views List */}
            {schema?.views && schema.views.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  Views ({schema.views.length})
                </div>
                <div className="mt-1 space-y-0.5">
                  {schema.views.map((view) => (
                    <button
                      key={view.name}
                      onClick={() => handleSelectTable(view)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition ${
                        selectedTable?.name === view.name
                          ? 'bg-cyan-600/20 text-cyan-300 font-medium'
                          : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{view.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">view</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Triggers List */}
            {schema?.triggers && schema.triggers.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Triggers ({schema.triggers.length})
                </div>
                <div className="mt-1 space-y-0.5">
                  {schema.triggers.map((trg) => (
                    <div
                      key={trg.name}
                      className="px-2 py-1.5 rounded text-xs text-zinc-400 flex items-center justify-between"
                    >
                      <span className="truncate">{trg.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{trg.table}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRAGMA Quick Actions (Gated by capabilities.pragma) */}
            {capabilities?.pragma && (
              <div className="pt-2 border-t border-zinc-800/80">
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  PRAGMA Inspector
                </div>
                <div className="mt-1 space-y-1">
                  <button
                    onClick={() => runPragma('PRAGMA integrity_check;')}
                    className="w-full text-left px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Integrity Check
                  </button>
                  <button
                    onClick={() => runPragma('PRAGMA foreign_key_check;')}
                    className="w-full text-left px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Foreign Key Check
                  </button>
                  <button
                    onClick={() => runPragma('PRAGMA database_list;')}
                    className="w-full text-left px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Database List
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Central Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Query Editor Box */}
          <div className="bg-zinc-900/80 border-b border-zinc-800 p-3 shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" /> SQL Query Editor
              </span>
              <div className="flex items-center gap-2">
                {capabilities?.explain && (
                  <button
                    onClick={runExplainPlan}
                    disabled={isLoading || !sqlQuery.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50 transition"
                  >
                    <Activity className="w-3 h-3 text-violet-400" /> EXPLAIN Plan
                  </button>
                )}
                <button
                  onClick={executeQuery}
                  disabled={isLoading || !sqlQuery.trim()}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition shadow-sm"
                >
                  <Play className="w-3 h-3 fill-white" /> Run (Ctrl+Enter)
                </button>
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  executeQuery();
                }
              }}
              rows={3}
              placeholder="Enter SQL statement (e.g. SELECT * FROM users;)"
              className="w-full bg-zinc-950 font-mono text-xs text-zinc-200 p-2.5 rounded border border-zinc-800 focus:outline-none focus:border-indigo-500/50 resize-y"
            />

            {errorMessage && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2 rounded flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="font-mono">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('grid')}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                  activeTab === 'grid'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Data Grid {queryResult ? `(${queryResult.rowCount} rows)` : ''}
              </button>

              <button
                onClick={() => setActiveTab('schema')}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                  activeTab === 'schema'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Schema Inspector {selectedTable ? `(${selectedTable.name})` : ''}
              </button>

              {capabilities?.explain && (
                <button
                  onClick={() => setActiveTab('explain')}
                  className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                    activeTab === 'explain'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  EXPLAIN Plan
                </button>
              )}

              {capabilities?.pragma && (
                <button
                  onClick={() => setActiveTab('pragma')}
                  className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                    activeTab === 'pragma'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  PRAGMA Output
                </button>
              )}
            </div>

            {queryResult && (
              <span className="text-[11px] text-zinc-500 font-mono">
                Executed in {queryResult.executionTimeMs}ms • {queryResult.rowCount} rows
              </span>
            )}
          </div>

          {/* Tab Viewport */}
          <div className="flex-1 overflow-auto bg-zinc-950 p-4">
            {activeTab === 'grid' && (
              <div className="h-full flex flex-col">
                {queryResult && queryResult.columns.length > 0 ? (
                  <div className="overflow-auto border border-zinc-800 rounded-lg">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-800">
                          {queryResult.columns.map((col, idx) => (
                            <th
                              key={idx}
                              className="px-3 py-2 text-zinc-300 font-semibold border-r border-zinc-800"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {queryResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-zinc-900/40">
                            {queryResult.columns.map((col, cIdx) => {
                              const val = (row as any)[col.name];
                              return (
                                <td
                                  key={cIdx}
                                  className="px-3 py-1.5 text-zinc-200 border-r border-zinc-800/60 whitespace-nowrap"
                                >
                                  {val === null || val === undefined ? (
                                    <span className="text-zinc-600 italic">null</span>
                                  ) : typeof val === 'object' ? (
                                    JSON.stringify(val)
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-12">
                    <FileQuestion className="w-10 h-10 mb-2 text-zinc-600" />
                    <p className="text-sm">No query results to display</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Execute a SELECT statement or choose a table from the sidebar
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'schema' && selectedTable && (
              <div className="space-y-6 max-w-4xl">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Table className="w-4 h-4 text-indigo-400" />
                    Columns for {selectedTable.name}
                  </h3>
                  <div className="overflow-hidden border border-zinc-800 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-zinc-900 border-b border-zinc-800 font-medium text-zinc-300">
                        <tr>
                          <th className="px-3 py-2">Column</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Primary Key</th>
                          <th className="px-3 py-2">Nullable</th>
                          <th className="px-3 py-2">Default</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 font-mono">
                        {selectedTable.columns.map((c) => (
                          <tr key={c.name} className="hover:bg-zinc-900/30">
                            <td className="px-3 py-2 font-semibold text-zinc-100 flex items-center gap-1.5">
                              {c.primaryKey && <Key className="w-3 h-3 text-amber-400" />}
                              {c.name}
                            </td>
                            <td className="px-3 py-2 text-indigo-400">{c.type}</td>
                            <td className="px-3 py-2">
                              {c.primaryKey ? (
                                <span className="text-amber-400 font-bold">YES</span>
                              ) : (
                                <span className="text-zinc-600">NO</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {c.nullable ? (
                                <span className="text-emerald-400">NULL</span>
                              ) : (
                                <span className="text-rose-400">NOT NULL</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-400">
                              {c.defaultValue || <span className="text-zinc-600 italic">none</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedTable.foreignKeys && selectedTable.foreignKeys.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" /> Foreign Keys
                    </h3>
                    <div className="overflow-hidden border border-zinc-800 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-300">
                          <tr>
                            <th className="px-3 py-2">Column</th>
                            <th className="px-3 py-2">References</th>
                            <th className="px-3 py-2">On Delete</th>
                            <th className="px-3 py-2">On Update</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {selectedTable.foreignKeys.map((fk, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/30">
                              <td className="px-3 py-2 text-indigo-300">{fk.column}</td>
                              <td className="px-3 py-2 text-amber-300">
                                {fk.referencedTable}({fk.referencedColumn})
                              </td>
                              <td className="px-3 py-2 text-zinc-400">{fk.onDelete || 'NO ACTION'}</td>
                              <td className="px-3 py-2 text-zinc-400">{fk.onUpdate || 'NO ACTION'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedTable.indexes && selectedTable.indexes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-400" /> Indexes
                    </h3>
                    <div className="overflow-hidden border border-zinc-800 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-300">
                          <tr>
                            <th className="px-3 py-2">Index Name</th>
                            <th className="px-3 py-2">Columns</th>
                            <th className="px-3 py-2">Unique</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {selectedTable.indexes.map((idx) => (
                            <tr key={idx.name} className="hover:bg-zinc-900/30">
                              <td className="px-3 py-2 text-zinc-200">{idx.name}</td>
                              <td className="px-3 py-2 text-indigo-300">
                                {idx.columns.join(', ')}
                              </td>
                              <td className="px-3 py-2">
                                {idx.unique ? (
                                  <span className="text-emerald-400 font-bold">UNIQUE</span>
                                ) : (
                                  <span className="text-zinc-600">INDEX</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedTable.sql && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-zinc-400" /> DDL Statement
                    </h3>
                    <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto">
                      {selectedTable.sql}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'explain' && explainPlan && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Execution Plan Hierarchy</h3>
                </div>
                {explainPlan.text && (
                  <pre className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {explainPlan.text}
                  </pre>
                )}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Raw Plan Nodes
                  </h4>
                  <pre className="p-3 bg-zinc-900/50 border border-zinc-800 rounded text-xs font-mono text-zinc-400 overflow-x-auto">
                    {JSON.stringify(explainPlan.nodes, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'pragma' && pragmaResult && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">PRAGMA Output</h3>
                </div>
                <div className="overflow-auto border border-zinc-800 rounded-lg">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800">
                        {pragmaResult.columns.map((col, idx) => (
                          <th key={idx} className="px-3 py-2 text-zinc-300 font-semibold">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {pragmaResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-zinc-900/40">
                          {pragmaResult.columns.map((col, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 text-zinc-200">
                              {String((row as any)[col.name])}
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
        </main>
      </div>
    </div>
  );
}
