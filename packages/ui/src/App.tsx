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
import { SqliteEngine, HttpAdapter, SAMPLE_STORE_SQL, generateCommitScript } from '@sql-magic/core';
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
  Sparkles,
  Bookmark,
  GitCompare,
  Search,
  Plus,
  Share2,
  Check,
  ChevronDown,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Server,
} from 'lucide-react';
import { SchemaBrowser } from './components/SchemaBrowser';
import { SqlEditor, type QueryHistoryItem } from './components/SqlEditor';
import { DataGrid } from './components/DataGrid';
import { FileLoader } from './components/FileLoader';
import { PendingChangesPanel } from './components/PendingChangesPanel';
import { TableDesignerModal } from './components/TableDesignerModal';
import { ImportModal } from './components/ImportModal';
import { ErDiagramModal } from './components/ErDiagramModal';
import { ColumnStatsModal } from './components/ColumnStatsModal';
import { QuickChartModal } from './components/QuickChartModal';
import { RowDetailModal } from './components/RowDetailModal';
import { ExplainVisualizer } from './components/ExplainVisualizer';
import { CommandPalette } from './components/CommandPalette';
import { AiAssistantModal } from './components/AiAssistantModal';
import { DiffModal } from './components/DiffModal';
import { SavedSnippetsModal } from './components/SavedSnippetsModal';
import { PragmaToolsModal } from './components/PragmaToolsModal';
import { AttachDatabaseModal } from './components/AttachDatabaseModal';
import { ConnectDatabaseModal } from './components/ConnectDatabaseModal';
import {
  saveSessionState,
  loadSessionState,
  encodeShareableQueryUrl,
  extractSharedQueryFromUrl,
} from './utils/storage';

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
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [historyList, setHistoryList] = useState<QueryHistoryItem[]>([]);
  const [schemasList, setSchemasList] = useState<string[]>([]);
  const [activeSchema, setActiveSchema] = useState<string>('public');
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState<boolean>(false);

  // Phase 5: Pending Changes & Undo/Redo & Modals State
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [undoStack, setUndoStack] = useState<ChangeItem[][]>([]);
  const [redoStack, setRedoStack] = useState<ChangeItem[][]>([]);
  const [showPendingPanel, setShowPendingPanel] = useState<boolean>(false);
  const [showTableDesigner, setShowTableDesigner] = useState<boolean>(false);
  const [designerInitialMode, setDesignerInitialMode] = useState<'table' | 'index' | 'alter' | 'drop'>('table');
  const [designerInitialTable, setDesignerInitialTable] = useState<string | undefined>(undefined);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Phase 6: Exploration and Power Features Modals State
  const [showErDiagram, setShowErDiagram] = useState<boolean>(false);
  const [showColumnStats, setShowColumnStats] = useState<boolean>(false);
  const [statsColumn, setStatsColumn] = useState<string | undefined>(undefined);
  const [showQuickChart, setShowQuickChart] = useState<boolean>(false);
  const [showRowDetail, setShowRowDetail] = useState<boolean>(false);
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null);
  const [detailRowIndex, setDetailRowIndex] = useState<number>(0);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [showSnippetsModal, setShowSnippetsModal] = useState<boolean>(false);
  const [showPragmaModal, setShowPragmaModal] = useState<boolean>(false);
  const [showAttachModal, setShowAttachModal] = useState<boolean>(false);
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [sharedCopied, setSharedCopied] = useState<boolean>(false);

  // Dynamic Editor & Data Grid height splitter
  const [editorHeight, setEditorHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sql-magic:editor-height');
      return saved ? Math.max(38, Math.min(800, Number(saved))) : 160;
    } catch {
      return 160;
    }
  });
  const [isDraggingResizer, setIsDraggingResizer] = useState<boolean>(false);

  // Apply dark mode class to <html> for Tailwind v4 and CSS variables
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  // Startup demo database & restore session preferences
  useEffect(() => {
    const session = loadSessionState();
    if (session.theme) setTheme(session.theme);
    initApp();

    const sharedQuery = extractSharedQueryFromUrl();
    if (sharedQuery) {
      setTimeout(() => executeSql(sharedQuery), 500);
    }
  }, []);

  const initApp = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // 1. Check if running connected to sql-magic server backend
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token') || undefined;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/health', { headers });
      if (res.ok) {
        const health = await res.json();
        if (health.status === 'ok') {
          const httpAdapter = new HttpAdapter({
            token,
            dialect: health.dialect,
            capabilities: health.capabilities,
          });

          const schemaData = await httpAdapter.getSchema();
          setAdapter(httpAdapter);
          setSchema(schemaData);

          let displayName = `${health.dialect}_database`;
          if (health.targetPath) {
            const parts = health.targetPath.replace(/\\/g, '/').split('/');
            displayName = parts[parts.length - 1] || health.targetPath;
          }
          setDbName(displayName);
          setChanges([]);
          setUndoStack([]);
          setRedoStack([]);

          if (schemaData.tables.length > 0) {
            const defaultTable = schemaData.tables.find((t) => t.name === 'customers') || schemaData.tables[0];
            setSelectedTable(defaultTable);
            const queryRes = await httpAdapter.query(
              `SELECT * FROM ${httpAdapter.quoteIdent(defaultTable.name)} LIMIT 100;`
            );
            setQueryResult(queryRes);
          }

          // Subscribe to Server-Sent Events (SSE) for file changes
          if (typeof EventSource !== 'undefined') {
            try {
              const sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events';
              const es = new EventSource(sseUrl);
              es.addEventListener('db-change', async () => {
                try {
                  const refreshed = await httpAdapter.getSchema();
                  setSchema(refreshed);
                } catch {
                  // Ignore transient reload errors
                }
              });
            } catch {
              // SSE not available
            }
          }
          return;
        }
      }
    } catch {
      // Server not reachable, fallback to browser WASM mode
    } finally {
      setIsLoading(false);
    }

    // 2. Browser WASM mode fallback
    await initSampleDatabase();
  };

  const initSampleDatabase = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const engine = new SqliteEngine();
      await engine.init();
      await engine.query(SAMPLE_STORE_SQL);

      const schemaData = await engine.getSchema();
      setAdapter(engine);
      setSchema(schemaData);
      setDbName('sample_store.sqlite');
      setChanges([]);
      setUndoStack([]);
      setRedoStack([]);

      if (schemaData.tables.length > 0) {
        const defaultTable = schemaData.tables.find((t) => t.name === 'customers') || schemaData.tables[0];
        setSelectedTable(defaultTable);
        const res = await engine.query(`SELECT * FROM ${engine.quoteIdent(defaultTable.name)} LIMIT 100;`);
        setQueryResult(res);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!adapter) return;
    setIsLoading(true);
    try {
      const refreshed = await adapter.getSchema(activeSchema !== 'public' ? activeSchema : undefined);
      setSchema(refreshed);
      if (selectedTable) {
        const found = refreshed.tables.find((t) => t.name === selectedTable.name);
        if (found) {
          await handleSelectTable(found);
        }
      }
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

      const schemaData = await engine.getSchema();
      setAdapter(engine);
      setSchema(schemaData);
      setDbName(file.name);
      setChanges([]);
      setUndoStack([]);
      setRedoStack([]);

      if (schemaData.tables.length > 0) {
        const firstTable = schemaData.tables[0];
        setSelectedTable(firstTable);
        const res = await engine.query(`SELECT * FROM ${engine.quoteIdent(firstTable.name)} LIMIT 100;`);
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

  const handleDynamicConnect = async (url: string, readOnly: boolean) => {
    if (!(adapter instanceof HttpAdapter)) {
      throw new Error('Connecting to a live server database requires starting sql-magic in server mode.');
    }
    const res = await adapter.connectDatabase(url, readOnly);
    setSchema(res.schema);

    let displayName = `${res.dialect}_database`;
    if (res.targetPath) {
      const parts = res.targetPath.replace(/\\/g, '/').split('/');
      displayName = parts[parts.length - 1] || res.targetPath;
    }
    setDbName(displayName);
    setChanges([]);
    setUndoStack([]);
    setRedoStack([]);

    if (res.schema.tables.length > 0) {
      const firstTbl = res.schema.tables[0];
      setSelectedTable(firstTbl);
      const queryRes = await adapter.query(`SELECT * FROM ${adapter.quoteIdent(firstTbl.name)} LIMIT 100;`);
      setQueryResult(queryRes);
    } else {
      setSelectedTable(null);
      setQueryResult(null);
    }
    return res;
  };

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingResizer(true);
    const startY = e.clientY;
    const startHeight = editorHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const minHeight = 38;
      const maxHeight = Math.max(minHeight, window.innerHeight - 220);
      const nextHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
      setEditorHeight(nextHeight);
      try {
        localStorage.setItem('sql-magic:editor-height', String(nextHeight));
      } catch {
        // Ignore
      }
    };

    const handleMouseUp = () => {
      setIsDraggingResizer(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleToggleEditorCollapse = () => {
    setEditorHeight((prev) => {
      const next = prev <= 42 ? 160 : 38;
      try {
        localStorage.setItem('sql-magic:editor-height', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
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

        // Add to history
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

  const handleShareQuery = () => {
    const sql = historyList[0]?.sql || `SELECT * FROM ${selectedTable?.name || 'customers'} LIMIT 50;`;
    const shareUrl = encodeShareableQueryUrl(sql);
    navigator.clipboard.writeText(shareUrl);
    setSharedCopied(true);
    setTimeout(() => setSharedCopied(false), 2000);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      saveSessionState({ theme: next });
      return next;
    });
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

  // Global Keyboard Shortcuts (Undo/Redo & Command Palette Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }

      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
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
      };

      pushChanges([...changes, change]);
    },
    [selectedTable, changes, pushChanges]
  );

  const handleAddRow = useCallback(() => {
    if (!selectedTable) return;
    const initialValues: Record<string, unknown> = {};
    for (const col of selectedTable.columns) {
      if (col.autoIncrement) continue;
      initialValues[col.name] = col.defaultValue ?? null;
    }

    const change: InsertRowChange = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      table: selectedTable.name,
      type: 'insert-row',
      timestamp: Date.now(),
      values: initialValues,
    };

    pushChanges([...changes, change]);
    setShowPendingPanel(true);
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
    <div className="flex flex-col h-screen bg-[#f8f9fb] dark:bg-[#0f1218] text-[#1b202a] dark:text-[#edf0f6] font-sans antialiased overflow-hidden select-none">
      {/* Robi's Best-Practice Header */}
      <header className="h-14 px-4 bg-white/90 dark:bg-[#141822]/95 backdrop-blur-md border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between shrink-0 z-30 transition-colors duration-150">
        {/* Left: Brand & Database Identity */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-150"
            title="Toggle Sidebar (Ctrl+B)"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3">
            {/* Concentric App Icon Container */}
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Database className="w-4 h-4" />
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-[#1b202a] dark:text-white">
                  sql-magic
                </span>
                <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  Studio
                </span>
                {isReadOnly && (
                  <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                    Read-Only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#5f687a] dark:text-[#98a0af] font-mono">
                <span className="truncate max-w-[200px]" title={dbName}>
                  {dbName}
                </span>
                <span>•</span>
                <span className="capitalize text-emerald-600 dark:text-emerald-400 font-medium">
                  {adapter?.dialect}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Command Palette Trigger with Micro-Interaction */}
        <button
          onClick={() => setShowCommandPalette(true)}
          className="hidden md:flex items-center justify-between w-72 px-3 py-1.5 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] text-xs text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:border-[#ccd2df] dark:hover:border-[#38435c] transition-all duration-150 active:scale-[0.99] group shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#8c96a8] group-hover:text-indigo-500 transition-colors" />
            <span>Search tables or run command...</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white dark:bg-[#121620] border border-[#d8dee8] dark:border-[#222938] text-[#8c96a8]">
            Ctrl+K
          </span>
        </button>

        {/* Right: Grouped Actions */}
        <div className="flex items-center gap-2">
          {/* Exploration Segment */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40]">
            <button
              onClick={() => setShowAiAssistant(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-all duration-150 active:scale-[0.98]"
              title="AI Text-to-SQL Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>AI</span>
            </button>

            <button
              onClick={() => setShowErDiagram(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-[#3f4756] dark:text-[#c4cad4] hover:bg-white dark:hover:bg-white/[0.08] transition-all duration-150 active:scale-[0.98]"
              title="Interactive ER Diagram"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>ER Diagram</span>
            </button>

            <button
              onClick={() => {
                setDesignerInitialMode('table');
                setDesignerInitialTable(selectedTable?.name);
                setShowTableDesigner(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-[#3f4756] dark:text-[#c4cad4] hover:bg-white dark:hover:bg-white/[0.08] transition-all duration-150 active:scale-[0.98]"
              title="Visual Schema Designer"
            >
              <Table className="w-3.5 h-3.5 text-emerald-500" />
              <span>Designer</span>
            </button>
          </div>

          {/* Tools Menu Dropdown / Buttons */}
          <div className="relative">
            <button
              onClick={() => setToolsDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition-all duration-150 active:scale-[0.98]"
            >
              <Wrench className="w-3.5 h-3.5 text-[#5f687a] dark:text-[#98a0af]" />
              <span>Tools</span>
              <ChevronDown className="w-3 h-3 text-[#8c96a8]" />
            </button>

            {toolsDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setToolsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] shadow-lg dark:shadow-none p-1.5 z-50 flex flex-col gap-0.5 font-sans">
                  <button
                    onClick={() => {
                      setShowImportModal(true);
                      setToolsDropdownOpen(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] text-left transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-500" />
                    <span>Import CSV / JSON</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowSnippetsModal(true);
                      setToolsDropdownOpen(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] text-left transition-colors"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Saved Snippets</span>
                  </button>

                  {adapter?.dialect === 'sqlite' && (
                    <button
                      onClick={() => {
                        setShowAttachModal(true);
                        setToolsDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] text-left transition-colors"
                    >
                      <Database className="w-3.5 h-3.5 text-sky-500" />
                      <span>Attach Secondary DB</span>
                    </button>
                  )}

                  {capabilities?.exportDatabase && (
                    <button
                      onClick={() => {
                        handleExportDatabase();
                        setToolsDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] text-left transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Download .db File</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Share Query Button */}
          <button
            onClick={handleShareQuery}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition-all duration-150 active:scale-[0.98]"
            title="Copy shareable link"
          >
            {sharedCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#5f687a] dark:text-[#98a0af]" />
                <span>Share</span>
              </>
            )}
          </button>

          {/* Connect Database Button */}
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#1b202a] dark:text-[#edf0f6] hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition-all duration-150 active:scale-[0.98]"
            title="Connect PostgreSQL, MySQL, or server database"
          >
            <Server className="w-3.5 h-3.5 text-indigo-500" />
            <span>Connect DB</span>
          </button>

          {/* File Picker */}
          <FileLoader onLoad={handleFileLoad} isLoading={isLoading} />

          {/* Theme Toggle Button */}
          <button
            onClick={handleToggleTheme}
            className="p-1.5 rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition-all duration-150 active:scale-[0.95]"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Schema Browser Sidebar */}
        {sidebarOpen && (
          <SchemaBrowser
            schema={schema}
            selectedTable={selectedTable}
            onSelectTable={handleSelectTable}
            onRefresh={handleRefresh}
            onPragmaAction={() => setShowPragmaModal(true)}
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

        {/* Center Canvas Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f8f9fb] dark:bg-[#0f1218]">
          {/* CodeMirror 6 SQL Editor with Resizable Height */}
          <SqlEditor
            schema={schema}
            onExecute={executeSql}
            isLoading={isLoading}
            historyList={historyList}
            theme={theme}
            height={editorHeight}
            onToggleCollapse={handleToggleEditorCollapse}
          />

          {/* Draggable Divider Resizer between Query Editor & Data Grid */}
          <div
            onMouseDown={handleStartResize}
            onDoubleClick={handleToggleEditorCollapse}
            className={`group relative h-2 -my-1 z-20 cursor-row-resize flex items-center justify-center select-none transition-colors ${
              isDraggingResizer ? 'bg-indigo-500/20' : 'hover:bg-indigo-500/10'
            }`}
            title="Drag to resize Query Editor & Data Grid (Double click to toggle collapse)"
          >
            <div
              className={`h-1 rounded-full transition-all duration-150 ${
                isDraggingResizer
                  ? 'w-16 bg-indigo-500'
                  : 'w-10 bg-[#cbd5e1] dark:bg-[#334155] group-hover:w-16 group-hover:bg-indigo-500'
              }`}
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between font-mono animate-in fade-in">
              <div className="flex items-center gap-2 truncate">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-0.5"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Segmented Viewport Navigation Bar */}
          <div className="h-11 px-4 bg-white/70 dark:bg-[#141822]/80 backdrop-blur-sm border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between shrink-0 select-none">
            {/* Concentric Pill Tab Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] gap-1">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
                  activeTab === 'grid'
                    ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                    : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
                }`}
              >
                Data Grid {queryResult ? `(${queryResult.rowCount})` : ''}
              </button>

              <button
                onClick={() => setActiveTab('schema')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
                  activeTab === 'schema'
                    ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                    : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
                }`}
              >
                Schema Inspector {selectedTable ? `(${selectedTable.name})` : ''}
              </button>

              {capabilities?.explain && (
                <button
                  onClick={() => {
                    runExplainPlan();
                    setActiveTab('explain');
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
                    activeTab === 'explain'
                      ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                      : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
                  }`}
                >
                  EXPLAIN Plan
                </button>
              )}

              {capabilities?.pragma && (
                <button
                  onClick={() => setShowPragmaModal(true)}
                  className="px-3 py-1 text-xs font-medium rounded-lg text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition-all duration-150"
                >
                  PRAGMA Tools
                </button>
              )}
            </div>

            {/* Execution Metrics */}
            {queryResult && (
              <div className="flex items-center gap-2 text-xs text-[#5f687a] dark:text-[#98a0af] font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-500" />
                  {queryResult.executionTimeMs} ms
                </span>
                <span>•</span>
                <span>{queryResult.rowCount.toLocaleString()} rows</span>
              </div>
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
                onOpenColumnStats={(col) => {
                  setStatsColumn(col);
                  setShowColumnStats(true);
                }}
                onOpenChart={() => setShowQuickChart(true)}
                onOpenDiff={() => setShowDiffModal(true)}
                onOpenRowDetail={(row, idx) => {
                  setDetailRow(row);
                  setDetailRowIndex(idx);
                  setShowRowDetail(true);
                }}
              />
            )}

            {activeTab === 'schema' && selectedTable && (
              <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-6 font-sans">
                {/* Table Header Card */}
                <div className="rounded-2xl p-4 bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                        <Table className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-[#1b202a] dark:text-white">
                          {selectedTable.name}
                        </h2>
                        <span className="text-xs text-[#5f687a] dark:text-[#98a0af]">
                          {selectedTable.columns.length} columns • {selectedTable.indexes?.length || 0} indexes
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Concentric Columns Grid Table */}
                  <div className="rounded-xl overflow-hidden border border-[#e2e6ee] dark:border-[#222938]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#f8f9fb] dark:bg-[#1a1f2c] border-b border-[#e2e6ee] dark:border-[#222938] font-medium text-[#5f687a] dark:text-[#98a0af]">
                        <tr>
                          <th className="px-4 py-2.5">Column</th>
                          <th className="px-4 py-2.5">Data Type</th>
                          <th className="px-4 py-2.5">Primary Key</th>
                          <th className="px-4 py-2.5">Nullable</th>
                          <th className="px-4 py-2.5">Default Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938] font-mono">
                        {selectedTable.columns.map((c) => (
                          <tr key={c.name} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5 font-semibold text-[#1b202a] dark:text-white flex items-center gap-2">
                              {c.primaryKey && <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              <span>{c.name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-indigo-600 dark:text-indigo-400 font-medium">
                              {c.type}
                            </td>
                            <td className="px-4 py-2.5">
                              {c.primaryKey ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                  PRIMARY KEY
                                </span>
                              ) : (
                                <span className="text-[#8c96a8] dark:text-[#525b6d]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {c.nullable ? (
                                <span className="text-emerald-600 dark:text-emerald-400">NULL</span>
                              ) : (
                                <span className="text-[#5f687a] dark:text-[#98a0af]">NOT NULL</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[#5f687a] dark:text-[#98a0af]">
                              {c.defaultValue || <span className="italic text-[#8c96a8]">none</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Foreign Keys Card */}
                {selectedTable.foreignKeys && selectedTable.foreignKeys.length > 0 && (
                  <div className="rounded-2xl p-4 bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938]">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#1b202a] dark:text-white">
                      <Key className="w-4 h-4 text-amber-500" /> Foreign Key Relations
                    </h3>
                    <div className="rounded-xl overflow-hidden border border-[#e2e6ee] dark:border-[#222938]">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead className="bg-[#f8f9fb] dark:bg-[#1a1f2c] border-b border-[#e2e6ee] dark:border-[#222938] text-[#5f687a] dark:text-[#98a0af]">
                          <tr>
                            <th className="px-4 py-2.5">Local Column</th>
                            <th className="px-4 py-2.5">Referenced Table & Column</th>
                            <th className="px-4 py-2.5">On Delete</th>
                            <th className="px-4 py-2.5">On Update</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938]">
                          {selectedTable.foreignKeys.map((fk, idx) => (
                            <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                              <td className="px-4 py-2.5 text-indigo-600 dark:text-indigo-400 font-medium">{fk.column}</td>
                              <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400 font-medium">
                                {fk.referencedTable} ({fk.referencedColumn})
                              </td>
                              <td className="px-4 py-2.5 text-[#5f687a] dark:text-[#98a0af]">{fk.onDelete || 'NO ACTION'}</td>
                              <td className="px-4 py-2.5 text-[#5f687a] dark:text-[#98a0af]">{fk.onUpdate || 'NO ACTION'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Indexes Card */}
                {selectedTable.indexes && selectedTable.indexes.length > 0 && (
                  <div className="rounded-2xl p-4 bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938]">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#1b202a] dark:text-white">
                      <Zap className="w-4 h-4 text-indigo-500" /> Indexes
                    </h3>
                    <div className="rounded-xl overflow-hidden border border-[#e2e6ee] dark:border-[#222938]">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead className="bg-[#f8f9fb] dark:bg-[#1a1f2c] border-b border-[#e2e6ee] dark:border-[#222938] text-[#5f687a] dark:text-[#98a0af]">
                          <tr>
                            <th className="px-4 py-2.5">Index Name</th>
                            <th className="px-4 py-2.5">Indexed Columns</th>
                            <th className="px-4 py-2.5">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938]">
                          {selectedTable.indexes.map((idx) => (
                            <tr key={idx.name} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                              <td className="px-4 py-2.5 font-semibold text-[#1b202a] dark:text-white">{idx.name}</td>
                              <td className="px-4 py-2.5 text-indigo-600 dark:text-indigo-400 font-medium">
                                {idx.columns.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                {idx.unique ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                    UNIQUE INDEX
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                    INDEX
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Original DDL Card */}
                {selectedTable.sql && (
                  <div className="rounded-2xl p-4 bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-[#1b202a] dark:text-white">
                        <FileCode className="w-4 h-4 text-[#8c96a8]" /> CREATE TABLE DDL
                      </h3>
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedTable.sql || '')}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        Copy DDL
                      </button>
                    </div>
                    <pre className="p-3.5 rounded-xl bg-[#f8f9fb] dark:bg-[#0e1117] border border-[#e2e6ee] dark:border-[#222938] text-xs font-mono text-[#3f4756] dark:text-[#c4cad4] overflow-x-auto leading-relaxed">
                      {selectedTable.sql}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* EXPLAIN Query Plan Graphical Flow Visualizer */}
            {activeTab === 'explain' && explainPlan && adapter && (
              <ExplainVisualizer
                plan={explainPlan}
                dialect={adapter.dialect}
                querySql={`SELECT * FROM ${selectedTable?.name || 'customers'};`}
                onExecuteCreateIndex={async (sql) => {
                  await executeSql(sql);
                  const fresh = await adapter.getSchema(activeSchema);
                  setSchema(fresh);
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modals with Robi's Concentric Radius & Low-Saturation Palette */}
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

      {showErDiagram && (
        <ErDiagramModal
          schema={schema}
          selectedTable={selectedTable}
          theme={theme}
          onSelectTable={handleSelectTable}
          onClose={() => setShowErDiagram(false)}
        />
      )}

      {showColumnStats && queryResult && (
        <ColumnStatsModal
          resultSet={queryResult}
          tableInfo={selectedTable}
          initialColumn={statsColumn}
          onClose={() => setShowColumnStats(false)}
        />
      )}

      {showQuickChart && queryResult && (
        <QuickChartModal
          resultSet={queryResult}
          onClose={() => setShowQuickChart(false)}
        />
      )}

      {showRowDetail && detailRow && (
        <RowDetailModal
          row={detailRow}
          rowIndex={detailRowIndex}
          totalRows={queryResult?.rowCount || 0}
          tableName={selectedTable?.name || 'result'}
          onPrevRow={() => {
            if (queryResult && detailRowIndex > 0) {
              setDetailRowIndex((i) => i - 1);
              setDetailRow(queryResult.rows[detailRowIndex - 1]);
            }
          }}
          onNextRow={() => {
            if (queryResult && detailRowIndex < queryResult.rows.length - 1) {
              setDetailRowIndex((i) => i + 1);
              setDetailRow(queryResult.rows[detailRowIndex + 1]);
            }
          }}
          onClose={() => setShowRowDetail(false)}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          schema={schema}
          onSelectTable={handleSelectTable}
          onOpenErDiagram={() => setShowErDiagram(true)}
          onOpenDesigner={() => setShowTableDesigner(true)}
          onOpenImport={() => setShowImportModal(true)}
          onExportDb={handleExportDatabase}
          onOpenExplain={runExplainPlan}
          onOpenPragma={() => setShowPragmaModal(true)}
          onOpenAiAssistant={() => setShowAiAssistant(true)}
          onToggleTheme={handleToggleTheme}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {showAiAssistant && adapter && (
        <AiAssistantModal
          schema={schema}
          dialect={adapter.dialect}
          selectedTable={selectedTable?.name}
          onApplySql={(sql) => executeSql(sql)}
          onClose={() => setShowAiAssistant(false)}
        />
      )}

      {showDiffModal && queryResult && (
        <DiffModal
          currentResultSet={queryResult}
          onClose={() => setShowDiffModal(false)}
        />
      )}

      {showSnippetsModal && (
        <SavedSnippetsModal
          onInsertSql={(sql) => executeSql(sql)}
          onClose={() => setShowSnippetsModal(false)}
        />
      )}

      {showPragmaModal && adapter && (
        <PragmaToolsModal
          adapter={adapter}
          onClose={() => setShowPragmaModal(false)}
        />
      )}

      {showAttachModal && adapter && (
        <AttachDatabaseModal
          adapter={adapter}
          onRefreshSchema={async () => {
            const fresh = await adapter.getSchema();
            setSchema(fresh);
          }}
          onClose={() => setShowAttachModal(false)}
        />
      )}

      {showConnectModal && (
        <ConnectDatabaseModal
          isServerMode={adapter instanceof HttpAdapter}
          onConnect={handleDynamicConnect}
          onClose={() => setShowConnectModal(false)}
        />
      )}
    </div>
  );
}
