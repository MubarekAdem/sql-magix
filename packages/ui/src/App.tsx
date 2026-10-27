import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DbAdapter,
  DatabaseSchema,
  TableInfo,
  ResultSet,
  Plan,
  ChangeItem,
  UpdateCellChange,
  InsertRowChange,
  DeleteRowChange,
} from '@sql-magic/core';
import { SqliteEngine, generateCommitScript } from '@sql-magic/core';
import {
  Database,
  Table,
  Zap,
  Activity,
  FolderTree,
  ShieldAlert,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Info,
  Key,
  FileCode,
  Upload,
  PlusCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { SchemaBrowser } from './components/SchemaBrowser';
import { SqlEditor, type QueryHistoryItem } from './components/SqlEditor';
import { DataGrid } from './components/DataGrid';
import { FileLoader } from './components/FileLoader';
import { PendingChangesPanel } from './components/PendingChangesPanel';
import { TableDesignerModal } from './components/TableDesignerModal';
import { ImportModal } from './components/ImportModal';

export default function App() {
  const [adapter, setAdapter] = useState<DbAdapter | null>(null);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'schema' | 'explain' | 'pragma'>('grid');
  const [queryResult, setQueryResult] = useState<ResultSet | null>(null);
  const [explainPlan, setExplainPlan] = useState<Plan | null>(null);
  const [pragmaResult, setPragmaResult] = useState<ResultSet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dbName, setDbName] = useState<string>('sample_store.sqlite');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [historyList, setHistoryList] = useState<QueryHistoryItem[]>([]);
  const [schemasList, setSchemasList] = useState<string[]>([]);
  const [activeSchema, setActiveSchema] = useState<string>('public');

  // Phase 5: Pending Changes & Undo/Redo & Modals State
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [undoStack, setUndoStack] = useState<ChangeItem[][]>([]);
  const [redoStack, setRedoStack] = useState<ChangeItem[][]>([]);
  const [showPendingPanel, setShowPendingPanel] = useState<boolean>(false);
  const [showTableDesigner, setShowTableDesigner] = useState<boolean>(false);
  const [designerInitialMode, setDesignerInitialMode] = useState<'table' | 'index' | 'alter' | 'drop'>('table');
  const [designerInitialTable, setDesignerInitialTable] = useState<string | undefined>(undefined);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Startup demo database
  useEffect(() => {
    initSampleDatabase();
  }, []);

  const initSampleDatabase = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const engine = new SqliteEngine();
      await engine.init();

      // Create an expansive realistic database for demonstration
      await engine.query(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT
        );

        CREATE TABLE customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          country TEXT DEFAULT 'US',
          balance REAL DEFAULT 0.0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category_id INTEGER,
          sku TEXT UNIQUE,
          price REAL NOT NULL,
          stock_qty INTEGER DEFAULT 0,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );

        CREATE INDEX idx_products_cat ON products(category_id);
        CREATE INDEX idx_products_sku ON products(sku);

        CREATE TABLE orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          total_amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_orders_customer ON orders(customer_id);

        CREATE VIEW v_customer_orders AS
          SELECT c.id, c.name, c.email, COUNT(o.id) as total_orders, IFNULL(SUM(o.total_amount), 0) as total_spent
          FROM customers c
          LEFT JOIN orders o ON c.id = o.customer_id
          GROUP BY c.id;

        -- Populate initial mock data
        INSERT INTO categories (name, description) VALUES
          ('Electronics', 'Gadgets, components, and devices'),
          ('Books', 'Technical and non-technical books'),
          ('Office Supplies', 'Desk accessories and stationary');

        INSERT INTO customers (name, email, country, balance) VALUES
          ('Alice Walker', 'alice@walker.org', 'US', 250.00),
          ('Bob Vance', 'bob@vancerefrigeration.com', 'US', 410.50),
          ('Carlos Mendez', 'carlos@mendez.es', 'ES', 89.20),
          ('Devi Patel', 'devi@patel.in', 'IN', 1200.00),
          ('Elena Rostova', 'elena@rostova.ru', 'DE', 0.00);

        INSERT INTO products (name, category_id, sku, price, stock_qty) VALUES
          ('Mechanical Keyboard (Cherry MX)', 1, 'KB-MECH-01', 129.99, 45),
          ('4K UltraHD Monitor 27"', 1, 'MON-4K-27', 349.50, 18),
          ('Designing Data-Intensive Applications', 2, 'BOOK-DDIA-01', 49.99, 120),
          ('Ergonomic Mouse', 1, 'MSE-ERGO-02', 59.99, 60),
          ('Heavy-Duty Desk Mat', 3, 'MAT-DESK-XL', 24.95, 200);

        INSERT INTO orders (customer_id, total_amount, status) VALUES
          (1, 179.98, 'completed'),
          (1, 49.99, 'completed'),
          (2, 349.50, 'processing'),
          (3, 129.99, 'shipped'),
          (4, 409.49, 'completed');
      `);

      const introspected = await engine.getSchema();
      setAdapter(engine);
      setSchema(introspected);
      setDbName('sample_store.sqlite');

      const initialTable = introspected.tables.find((t) => t.name === 'customers') || introspected.tables[0];
      setSelectedTable(initialTable);

      const initialRes = await engine.query('SELECT * FROM customers LIMIT 50;');
      setQueryResult(initialRes);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileLoad = async (file: File) => {
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
      setChanges([]);
      setUndoStack([]);
      setRedoStack([]);

      if (introspected.tables.length > 0) {
        const first = introspected.tables[0];
        setSelectedTable(first);
        const res = await engine.query(`SELECT * FROM ${engine.quoteIdent(first.name)} LIMIT 100;`);
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

  const executeSql = useCallback(
    async (sql: string) => {
      if (!adapter) return;
      setIsLoading(true);
      setErrorMessage(null);

      const start = Date.now();
      try {
        const res = await adapter.query(sql);
        setQueryResult(res);
        setActiveTab('grid');

        // Record query history
        setHistoryList((prev) => [
          {
            id: `h_${Date.now()}`,
            sql,
            timestamp: Date.now(),
            durationMs: res.executionTimeMs,
            rowCount: res.rowCount,
          },
          ...prev.slice(0, 49),
        ]);

        // Refresh schema if DDL query
        if (/^(CREATE|ALTER|DROP)\b/i.test(sql.trim())) {
          const fresh = await adapter.getSchema();
          setSchema(fresh);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        setHistoryList((prev) => [
          {
            id: `h_${Date.now()}`,
            sql,
            timestamp: Date.now(),
            durationMs: Date.now() - start,
            rowCount: 0,
            error: msg,
          },
          ...prev.slice(0, 49),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [adapter]
  );

  const handleSelectTable = async (table: TableInfo) => {
    if (!adapter) return;
    setSelectedTable(table);
    const query = `SELECT * FROM ${adapter.quoteIdent(table.name)} LIMIT 100;`;
    await executeSql(query);
  };

  const handleSelectSchema = async (newSchema: string) => {
    if (!adapter) return;
    setActiveSchema(newSchema);
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const fresh = await adapter.getSchema(newSchema);
      setSchema(fresh);
      if (fresh.tables.length > 0) {
        handleSelectTable(fresh.tables[0]);
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

  const handleNavigateForeignKey = async (refTable: string, refCol: string, val: unknown) => {
    if (!adapter) return;
    const targetTable = schema?.tables.find(
      (t) => t.name.toLowerCase() === refTable.toLowerCase()
    );
    if (targetTable) {
      setSelectedTable(targetTable);
    }

    const formattedVal =
      val === null || val === undefined
        ? 'NULL'
        : typeof val === 'number'
        ? String(val)
        : `'${String(val).replace(/'/g, "''")}'`;

    const query = `SELECT * FROM ${adapter.quoteIdent(refTable)} WHERE ${adapter.quoteIdent(refCol)} = ${formattedVal} LIMIT 50;`;
    await executeSql(query);
  };

  const runExplainPlan = async () => {
    if (!adapter || !adapter.capabilities.explain) return;
    if (!queryResult) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const plan = await adapter.explain(`SELECT * FROM ${selectedTable?.name || 'customers'};`);
      setExplainPlan(plan);
      setActiveTab('explain');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const runPragma = async (cmd: string) => {
    if (!adapter || !adapter.capabilities.pragma) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await adapter.query(cmd);
      setPragmaResult(res);
      setActiveTab('pragma');
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

  // Phase 5 Changeset Handlers & Undo / Redo
  const pushChanges = useCallback(
    (newChanges: ChangeItem[]) => {
      setUndoStack((prev) => [...prev, changes]);
      setRedoStack([]);
      setChanges(newChanges);
    },
    [changes]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, changes]);
    setUndoStack((u) => u.slice(0, -1));
    setChanges(prev);
  }, [undoStack, changes]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, changes]);
    setRedoStack((r) => r.slice(0, -1));
    setChanges(next);
  }, [redoStack, changes]);

  // Global Undo / Redo Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleCellEdit = useCallback(
    (row: Record<string, unknown>, colName: string, oldValue: unknown, newValue: unknown) => {
      if (!selectedTable) return;

      const pkCols = selectedTable.columns.filter((c) => c.primaryKey);
      const pkValues: Record<string, unknown> = {};
      for (const pk of pkCols) {
        pkValues[pk.name] = row[pk.name];
      }

      const change: UpdateCellChange = {
        id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        table: selectedTable.name,
        type: 'update-cell',
        timestamp: Date.now(),
        pkValues,
        column: colName,
        oldValue,
        newValue,
        row,
      };

      pushChanges([...changes, change]);
    },
    [selectedTable, changes, pushChanges]
  );

  const handleAddRow = useCallback(() => {
    if (!selectedTable) return;
    const newValues: Record<string, unknown> = {};
    for (const c of selectedTable.columns) {
      if (c.autoIncrement) continue;
      newValues[c.name] = c.defaultValue || (c.nullable ? null : '');
    }

    const change: InsertRowChange = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      table: selectedTable.name,
      type: 'insert-row',
      timestamp: Date.now(),
      values: newValues,
    };

    pushChanges([...changes, change]);
  }, [selectedTable, changes, pushChanges]);

  const handleDeleteRow = useCallback(
    (row: Record<string, unknown>) => {
      if (!selectedTable) return;
      const pkCols = selectedTable.columns.filter((c) => c.primaryKey);
      const pkValues: Record<string, unknown> = {};
      for (const pk of pkCols) {
        pkValues[pk.name] = row[pk.name];
      }

      const change: DeleteRowChange = {
        id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        table: selectedTable.name,
        type: 'delete-row',
        timestamp: Date.now(),
        pkValues,
        row,
      };

      pushChanges([...changes, change]);
    },
    [selectedTable, changes, pushChanges]
  );

  const handleRevertChange = useCallback(
    (id: string) => {
      pushChanges(changes.filter((c) => c.id !== id));
    },
    [changes, pushChanges]
  );

  const handleDiscardAllChanges = useCallback(() => {
    pushChanges([]);
  }, [pushChanges]);

  const handleCommitChanges = useCallback(async () => {
    if (!adapter || changes.length === 0) return;

    if (adapter.capabilities.readOnly) {
      setErrorMessage(
        'Database connection is read-only. Committing changes requires launching with --allow-write.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const script = generateCommitScript(changes, adapter.dialect);
      await adapter.query(script);
      setChanges([]);
      setUndoStack([]);
      setRedoStack([]);
      setShowPendingPanel(false);

      // Refresh current table view
      if (selectedTable) {
        const res = await adapter.query(
          `SELECT * FROM ${adapter.quoteIdent(selectedTable.name)} LIMIT 100;`
        );
        setQueryResult(res);
      }
      const freshSchema = await adapter.getSchema(activeSchema);
      setSchema(freshSchema);
    } catch (err: unknown) {
      setErrorMessage(`Commit failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [adapter, changes, selectedTable, activeSchema]);

  const handleExecuteDdl = useCallback(
    async (sql: string) => {
      if (!adapter) return;
      if (adapter.capabilities.readOnly) {
        throw new Error('Database is read-only. DDL requires --allow-write.');
      }
      await executeSql(sql);
      const fresh = await adapter.getSchema(activeSchema);
      setSchema(fresh);
    },
    [adapter, executeSql, activeSchema]
  );

  const handleExecuteImport = useCallback(
    async (createTableSql: string, insertSqls: string[]) => {
      if (!adapter) return;
      if (adapter.capabilities.readOnly) {
        throw new Error('Database is read-only. Import requires --allow-write.');
      }
      setIsLoading(true);
      setErrorMessage(null);
      try {
        await adapter.query(createTableSql);
        for (const ins of insertSqls) {
          await adapter.query(ins);
        }
        const fresh = await adapter.getSchema(activeSchema);
        setSchema(fresh);
        if (fresh.tables.length > 0) {
          const newest = fresh.tables[fresh.tables.length - 1];
          setSelectedTable(newest);
          const res = await adapter.query(
            `SELECT * FROM ${adapter.quoteIdent(newest.name)} LIMIT 100;`
          );
          setQueryResult(res);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [adapter, activeSchema]
  );

  const capabilities = adapter?.capabilities;
  const isReadOnly = capabilities?.readOnly ?? false;

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      } font-sans`}
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Toggle Sidebar"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">sql-magic</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Studio
                </span>
                {isReadOnly && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                    Read-Only
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                <span className="truncate max-w-[200px]" title={dbName}>
                  {dbName}
                </span>
                <span>•</span>
                <span className="text-emerald-400 capitalize">{adapter?.dialect}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Capability Badges & Controls */}
        <div className="flex items-center gap-2">
          {/* Schema Designer Button */}
          <button
            onClick={() => {
              setDesignerInitialMode('table');
              setDesignerInitialTable(selectedTable?.name);
              setShowTableDesigner(true);
            }}
            className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition"
            title="Open Visual Schema Designer"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Designer</span>
          </button>

          {/* Import CSV / JSON Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition"
            title="Import CSV or JSON data"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import</span>
          </button>

          {capabilities?.explain && (
            <button
              onClick={runExplainPlan}
              className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 flex items-center gap-1.5 transition"
              title="Inspect execution plan"
            >
              <Activity className="w-3.5 h-3.5 text-violet-400" />
              <span>EXPLAIN</span>
            </button>
          )}

          {capabilities?.exportDatabase && (
            <button
              onClick={handleExportDatabase}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
              title="Download entire SQLite database binary"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Export .db</span>
            </button>
          )}

          <FileLoader onLoad={handleFileLoad} isLoading={isLoading} />

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Schema Browser Sidebar */}
        {sidebarOpen && (
          <SchemaBrowser
            schema={schema}
            selectedTable={selectedTable}
            onSelectTable={handleSelectTable}
            onRefresh={initSampleDatabase}
            onPragmaAction={runPragma}
            capabilities={capabilities}
            schemasList={schemasList}
            activeSchema={activeSchema}
            onSelectSchema={handleSelectSchema}
            onOpenDesigner={(mode, tbl) => {
              setDesignerInitialMode(mode || 'table');
              setDesignerInitialTable(tbl);
              setShowTableDesigner(true);
            }}
            onOpenImport={() => setShowImportModal(true)}
          />
        )}

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* CodeMirror 6 SQL Editor */}
          <SqlEditor
            schema={schema}
            onExecute={executeSql}
            isLoading={isLoading}
            historyList={historyList}
            theme={theme}
          />

          {/* Error Banner */}
          {errorMessage && (
            <div className="px-4 py-2 bg-rose-950/60 border-b border-rose-800 text-xs text-rose-300 flex items-center gap-2 font-mono">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          {/* Navigation Viewport Tabs */}
          <div className="flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
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
                {queryResult.executionTimeMs}ms • {queryResult.rowCount} rows
              </span>
            )}
          </div>

          {/* Main Views Container */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'grid' && queryResult && (
              <DataGrid
                resultSet={queryResult}
                tableName={selectedTable?.name || 'result'}
                foreignKeys={selectedTable?.foreignKeys}
                primaryKeys={selectedTable?.columns.filter((c) => c.primaryKey).map((c) => c.name)}
                onNavigateForeignKey={handleNavigateForeignKey}
                theme={theme}
                isReadOnly={isReadOnly}
                onCellEdit={handleCellEdit}
                onAddRow={handleAddRow}
                onDeleteRow={handleDeleteRow}
                pendingChangesCount={changes.length}
                onOpenPendingChanges={() => setShowPendingPanel(true)}
                pendingChanges={changes}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            )}

            {activeTab === 'schema' && selectedTable && (
              <div className="h-full overflow-y-auto p-6 max-w-4xl space-y-6">
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
                      <FileCode className="w-4 h-4 text-zinc-400" /> Original DDL Statement
                    </h3>
                    <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                      {selectedTable.sql}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'explain' && explainPlan && (
              <div className="h-full overflow-y-auto p-6 max-w-4xl space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Execution Plan Hierarchy</h3>
                </div>
                {explainPlan.text && (
                  <pre className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {explainPlan.text}
                  </pre>
                )}
              </div>
            )}

            {activeTab === 'pragma' && pragmaResult && (
              <div className="h-full overflow-y-auto p-6 max-w-4xl space-y-4">
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

      {/* Phase 5 Modals */}
      {showPendingPanel && adapter && (
        <PendingChangesPanel
          changes={changes}
          dialect={adapter.dialect}
          onCommit={handleCommitChanges}
          onRevertChange={handleRevertChange}
          onDiscardAll={handleDiscardAllChanges}
          onClose={() => setShowPendingPanel(false)}
          isReadOnly={isReadOnly}
        />
      )}

      {showTableDesigner && adapter && (
        <TableDesignerModal
          schema={schema}
          dialect={adapter.dialect}
          onExecuteDdl={handleExecuteDdl}
          onClose={() => setShowTableDesigner(false)}
          isReadOnly={isReadOnly}
          initialMode={designerInitialMode}
          initialTable={designerInitialTable}
        />
      )}

      {showImportModal && adapter && (
        <ImportModal
          schema={schema}
          dialect={adapter.dialect}
          onExecuteImport={handleExecuteImport}
          onClose={() => setShowImportModal(false)}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
