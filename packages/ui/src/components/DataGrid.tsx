import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnMeta, ForeignKeyInfo, ResultSet, ChangeItem } from 'sql-magic-core';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Columns,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  Maximize2,
  X,
  FileSpreadsheet,
  FileText,
  FileCode,
  FileJson,
  ExternalLink,
  Key,
  Plus,
  Trash2,
  Edit2,
  Undo2,
  Redo2,
  Clock,
  Sparkles,
  BarChart2,
  GitCompare,
  FileSearch,
} from 'lucide-react';
import {
  exportToCsv,
  exportToJson,
  exportToExcelXml,
  exportToSqlInsert,
  exportToMarkdown,
  downloadFile,
} from '../utils/export';

interface DataGridProps {
  resultSet: ResultSet;
  tableName?: string;
  foreignKeys?: ForeignKeyInfo[];
  primaryKeys?: string[];
  onNavigateForeignKey?: (refTable: string, refCol: string, val: unknown) => void;
  theme?: 'dark' | 'light';
  isReadOnly?: boolean;
  onCellEdit?: (row: Record<string, unknown>, colName: string, oldValue: unknown, newValue: unknown) => void;
  onAddRow?: () => void;
  onDeleteRow?: (row: Record<string, unknown>) => void;
  pendingChangesCount?: number;
  onOpenPendingChanges?: () => void;
  pendingChanges?: ChangeItem[];
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenColumnStats?: (column: string) => void;
  onOpenChart?: () => void;
  onOpenRowDetail?: (row: Record<string, unknown>, index: number) => void;
  onOpenDiff?: () => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface ColumnSort {
  column: string;
  direction: SortDirection;
}

export const DataGrid: React.FC<DataGridProps> = ({
  resultSet,
  tableName = 'result',
  foreignKeys = [],
  primaryKeys = [],
  onNavigateForeignKey,
  theme = 'light',
  isReadOnly = false,
  onCellEdit,
  onAddRow,
  onDeleteRow,
  pendingChangesCount = 0,
  onOpenPendingChanges,
  pendingChanges = [],
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onOpenColumnStats,
  onOpenChart,
  onOpenRowDetail,
  onOpenDiff,
}) => {
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showColumnPicker, setShowColumnPicker] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string; val: unknown } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colName: string;
    originalVal: unknown;
    editVal: string;
    row: Record<string, unknown>;
  } | null>(null);

  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Fast FK lookup
  const fkLookup = useMemo(() => {
    const map = new Map<string, ForeignKeyInfo>();
    for (const fk of foreignKeys) {
      map.set(fk.column, fk);
    }
    return map;
  }, [foreignKeys]);

  // Map of pending deletions
  const pendingDeletions = useMemo(() => {
    const deletedPkSet = new Set<string>();
    for (const chg of pendingChanges) {
      if (chg.type === 'delete-row') {
        const pkKey = Object.entries(chg.pkValues)
          .map(([k, v]) => `${k}:${v}`)
          .sort()
          .join('|');
        deletedPkSet.add(pkKey);
      }
    }
    return deletedPkSet;
  }, [pendingChanges]);

  // Map of pending updates per cell
  const pendingModifiedCells = useMemo(() => {
    const modMap = new Map<string, unknown>();
    for (const chg of pendingChanges) {
      if (chg.type === 'update-cell') {
        const pkKey = Object.entries(chg.pkValues)
          .map(([k, v]) => `${k}:${v}`)
          .sort()
          .join('|');
        modMap.set(`${pkKey}#${chg.column}`, chg.newValue);
      }
    }
    return modMap;
  }, [pendingChanges]);

  const getRowPkKey = useCallback(
    (row: Record<string, unknown>) => {
      const keys = primaryKeys.length > 0 ? primaryKeys : Object.keys(row);
      return keys
        .map((k) => `${k}:${row[k]}`)
        .sort()
        .join('|');
    },
    [primaryKeys]
  );

  // Visible columns management
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    resultSet.columns.map((c) => c.name)
  );

  useEffect(() => {
    setVisibleColumns(resultSet.columns.map((c) => c.name));
  }, [resultSet.columns]);

  // Column width state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Sorting state
  const [sort, setSort] = useState<ColumnSort>({ column: '', direction: null });

  const toggleSort = (colName: string) => {
    setSort((prev) => {
      if (prev.column !== colName) return { column: colName, direction: 'asc' };
      if (prev.direction === 'asc') return { column: colName, direction: 'desc' };
      return { column: '', direction: null };
    });
  };

  // Filtered & Sorted rows calculation
  const processedRows = useMemo(() => {
    let rows = [...resultSet.rows];

    // Global Search Filter
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        )
      );
    }

    // Per-column filter
    const activeFilterEntries = Object.entries(columnFilters).filter(([, v]) => v.trim() !== '');
    if (activeFilterEntries.length > 0) {
      rows = rows.filter((row) =>
        activeFilterEntries.every(([col, filterVal]) => {
          const cellVal = (row as any)[col];
          if (cellVal === null || cellVal === undefined) {
            return filterVal.toLowerCase() === 'null';
          }
          return String(cellVal).toLowerCase().includes(filterVal.toLowerCase());
        })
      );
    }

    // Sorting
    if (sort.column && sort.direction) {
      const col = sort.column;
      const factor = sort.direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const valA = (a as any)[col];
        const valB = (b as any)[col];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * factor;
        }
        return String(valA).localeCompare(String(valB)) * factor;
      });
    }

    return rows;
  }, [resultSet.rows, globalSearch, columnFilters, sort]);

  // Virtualizer parent container
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: processedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 25,
  });

  // Column Resizing logic
  const handleResizeStart = (colName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colName] || 150;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(70, startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [colName]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Export handlers
  const handleExport = (format: 'csv' | 'json' | 'excel' | 'sql' | 'markdown') => {
    const subset: ResultSet = {
      ...resultSet,
      rows: processedRows,
      columns: resultSet.columns.filter((c) => visibleColumns.includes(c.name)),
      rowCount: processedRows.length,
    };

    const baseName = `${tableName || 'export'}_${Date.now()}`;

    switch (format) {
      case 'csv': {
        const content = exportToCsv(subset);
        downloadFile(content, `${baseName}.csv`, 'text/csv;charset=utf-8;');
        break;
      }
      case 'json': {
        const content = exportToJson(subset);
        downloadFile(content, `${baseName}.json`, 'application/json;charset=utf-8;');
        break;
      }
      case 'excel': {
        const content = exportToExcelXml(subset, tableName);
        downloadFile(content, `${baseName}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
        break;
      }
      case 'sql': {
        const content = exportToSqlInsert(subset, tableName);
        downloadFile(content, `${baseName}.sql`, 'text/plain;charset=utf-8;');
        break;
      }
      case 'markdown': {
        const content = exportToMarkdown(subset);
        downloadFile(content, `${baseName}.md`, 'text/markdown;charset=utf-8;');
        break;
      }
    }
    setShowExportMenu(false);
  };

  const copyCell = (val: unknown) => {
    const text =
      val === null || val === undefined
        ? ''
        : typeof val === 'object'
        ? JSON.stringify(val)
        : String(val);
    navigator.clipboard.writeText(text);
    setCopyFeedback('Copied!');
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  // Commit inline edit
  const handleSaveEdit = () => {
    if (!editingCell || !onCellEdit) {
      setEditingCell(null);
      return;
    }

    const { colName, originalVal, editVal, row } = editingCell;
    let converted: unknown = editVal;

    if (editVal.trim().toLowerCase() === 'null') {
      converted = null;
    } else if (typeof originalVal === 'number') {
      const num = Number(editVal);
      if (!isNaN(num)) converted = num;
    } else if (typeof originalVal === 'boolean') {
      if (editVal.toLowerCase() === 'true') converted = true;
      else if (editVal.toLowerCase() === 'false') converted = false;
    }

    if (converted !== originalVal) {
      onCellEdit(row, colName, originalVal, converted);
    }
    setEditingCell(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const activeColumns = useMemo(
    () => resultSet.columns.filter((c) => visibleColumns.includes(c.name)),
    [resultSet.columns, visibleColumns]
  );

  return (
    <div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-[#0f1218] text-[#1b202a] dark:text-[#edf0f6] font-mono text-xs select-none transition-colors duration-150">
      {/* Grid Toolbar with 4px Grid Spacing */}
      <div className="h-12 px-3 bg-white/80 dark:bg-[#141822]/90 backdrop-blur-sm border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between shrink-0 font-sans">
        {/* Left: Global Search & Filter Toggle & Edit Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#8c96a8]" />
            <input
              type="text"
              placeholder="Filter visible rows..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-8 pr-7 py-1 bg-[#f8f9fb] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg text-xs text-[#1b202a] dark:text-[#edf0f6] placeholder-[#8c96a8] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-48 transition-all"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch('')}
                className="absolute right-2 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
              showFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                : 'bg-white dark:bg-[#1a1f2c] border-[#e2e6ee] dark:border-[#262e40] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#202534]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          {/* Add Row Button */}
          {onAddRow && !isReadOnly && (
            <button
              onClick={onAddRow}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] text-[#3f4756] dark:text-[#c4cad4] hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800/60 font-medium transition-all duration-150 active:scale-[0.98]"
              title="Add a new row to table"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>Add Row</span>
            </button>
          )}

          {/* Undo / Redo controls */}
          {(onUndo || onRedo) && (
            <div className="flex items-center border border-[#e2e6ee] dark:border-[#262e40] rounded-lg bg-white dark:bg-[#1a1f2c] overflow-hidden">
              {onUndo && (
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="p-1 px-2 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white disabled:opacity-30 border-r border-[#e2e6ee] dark:border-[#262e40] transition active:scale-[0.95]"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onRedo && (
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="p-1 px-2 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white disabled:opacity-30 transition active:scale-[0.95]"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Pending Changes Pill */}
          {pendingChangesCount > 0 && onOpenPendingChanges && (
            <button
              onClick={onOpenPendingChanges}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-all duration-150 active:scale-[0.98]"
              title="Review pending modifications"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span className="font-semibold text-xs">
                {pendingChangesCount} Pending {pendingChangesCount === 1 ? 'Edit' : 'Edits'}
              </span>
            </button>
          )}
        </div>

        {/* Right: Tools & Column Picker & Exporter & Row Counts */}
        <div className="flex items-center gap-2">
          {/* Quick Chart */}
          {onOpenChart && (
            <button
              onClick={onOpenChart}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] text-[#3f4756] dark:text-[#c4cad4] hover:bg-[#f1f3f7] dark:hover:bg-[#202534] hover:text-[#1b202a] dark:hover:text-white transition-all duration-150 active:scale-[0.98]"
              title="Visualize query results"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Chart</span>
            </button>
          )}

          {/* Diff */}
          {onOpenDiff && (
            <button
              onClick={onOpenDiff}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] text-[#3f4756] dark:text-[#c4cad4] hover:bg-[#f1f3f7] dark:hover:bg-[#202534] hover:text-[#1b202a] dark:hover:text-white transition-all duration-150 active:scale-[0.98]"
              title="Compare query results diff"
            >
              <GitCompare className="w-3.5 h-3.5 text-amber-500" />
              <span>Diff</span>
            </button>
          )}

          <span className="text-[11px] text-[#8c96a8] font-mono px-1">
            {processedRows.length} / {resultSet.rowCount}
          </span>

          {/* Column Visibility Menu */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#202534] transition-all duration-150 active:scale-[0.98]"
              title="Show / Hide Columns"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Cols ({visibleColumns.length}/{resultSet.columns.length})</span>
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 top-9 w-56 max-h-72 bg-white dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-xl shadow-xl dark:shadow-none p-2.5 z-30 overflow-y-auto font-sans">
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-[#e2e6ee] dark:border-[#222938] text-[11px]">
                  <span className="font-semibold text-[#1b202a] dark:text-[#edf0f6]">Columns</span>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setVisibleColumns(resultSet.columns.map((c) => c.name))}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      All
                    </button>
                    <span className="text-[#8c96a8]">•</span>
                    <button
                      onClick={() => setVisibleColumns([resultSet.columns[0]?.name || ''])}
                      className="text-[#8c96a8] hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {resultSet.columns.map((col) => {
                    const isVisible = visibleColumns.includes(col.name);
                    return (
                      <label
                        key={col.name}
                        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/[0.04] cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          disabled={isVisible && visibleColumns.length === 1}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibleColumns((prev) => [...prev, col.name]);
                            } else {
                              setVisibleColumns((prev) => prev.filter((c) => c !== col.name));
                            }
                          }}
                          className="rounded border-[#ccd2df] dark:border-[#38435c] text-indigo-600 focus:ring-0"
                        />
                        <span className="truncate text-[#3f4756] dark:text-[#c4cad4] font-mono">{col.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-medium text-xs shadow-2xs transition-all duration-150"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-9 w-44 bg-white dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-xl shadow-xl dark:shadow-none p-1.5 z-30 font-sans">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-500" /> CSV (.csv)
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg flex items-center gap-2"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-500" /> JSON (.json)
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-500" /> Excel (.xls)
                </button>
                <button
                  onClick={() => handleExport('sql')}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg flex items-center gap-2"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-500" /> SQL INSERT
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-500" /> Markdown Table
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Virtual Table Scrollport */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto bg-white dark:bg-[#0f1218] relative"
      >
        <table className="w-full border-collapse text-left font-mono text-xs">
          {/* Sticky Header */}
          <thead className="sticky top-0 bg-[#f8f9fb] dark:bg-[#131722] border-b border-[#e2e6ee] dark:border-[#222938] z-10 shadow-2xs">
            <tr>
              {/* Row index header */}
              <th className="w-12 px-2 py-2 text-[#8c96a8] font-normal border-r border-[#e2e6ee] dark:border-[#222938] text-center select-none bg-[#f8f9fb] dark:bg-[#131722]">
                #
              </th>
              {activeColumns.map((col) => {
                const width = columnWidths[col.name] || 150;
                const isSorted = sort.column === col.name;
                return (
                  <th
                    key={col.name}
                    style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                    className="relative px-3 py-2 font-semibold text-[#5f687a] dark:text-[#98a0af] border-r border-[#e2e6ee] dark:border-[#222938] group bg-[#f8f9fb] dark:bg-[#131722]"
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSort(col.name)}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate pr-1 text-[#1b202a] dark:text-[#edf0f6]" title={col.name}>
                          {col.name}
                        </span>
                        {onOpenColumnStats && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenColumnStats(col.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#8c96a8] hover:text-indigo-500 hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
                            title={`View statistics for ${col.name}`}
                          >
                            <BarChart2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center text-[#8c96a8] group-hover:text-[#1b202a] dark:group-hover:text-white">
                        {isSorted && sort.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-500" />
                        ) : isSorted && sort.direction === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition" />
                        )}
                      </div>
                    </div>

                    {/* Draggable Column Resizer Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(col.name, e)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition select-none"
                    />
                  </th>
                );
              })}
            </tr>

            {/* Optional Per-Column Filter Row */}
            {showFilters && (
              <tr className="bg-[#f1f3f7] dark:bg-[#161a24] border-b border-[#e2e6ee] dark:border-[#222938]">
                <th className="px-2 py-1 text-[#8c96a8] border-r border-[#e2e6ee] dark:border-[#222938] text-center font-normal">
                  <Filter className="w-3 h-3 mx-auto" />
                </th>
                {activeColumns.map((col) => (
                  <th key={col.name} className="p-1 border-r border-[#e2e6ee] dark:border-[#222938] font-normal">
                    <input
                      type="text"
                      placeholder={`Filter ${col.name}...`}
                      value={columnFilters[col.name] || ''}
                      onChange={(e) =>
                        setColumnFilters((prev) => ({ ...prev, [col.name]: e.target.value }))
                      }
                      className="w-full bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] rounded px-2 py-0.5 text-[11px] text-[#1b202a] dark:text-[#edf0f6] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>

          {/* Virtual Rows */}
          <tbody>
            {rowVirtualizer.getVirtualItems().length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length + 1}
                  className="py-16 text-center text-[#8c96a8] font-sans text-xs"
                >
                  No matching records found
                </td>
              </tr>
            ) : (
              <>
                {rowVirtualizer.getVirtualItems()[0]?.start > 0 && (
                  <tr>
                    <td
                      style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}
                      colSpan={activeColumns.length + 1}
                    />
                  </tr>
                )}

                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = processedRows[virtualRow.index];
                  const rowIndex = virtualRow.index;
                  const rowPkKey = getRowPkKey(row);
                  const isDeleted = pendingDeletions.has(rowPkKey);

                  return (
                    <tr
                      key={rowIndex}
                      className={`border-b border-[#edf0f6] dark:border-[#1a1f2b] transition-colors duration-100 group ${
                        isDeleted
                          ? 'bg-rose-50/70 dark:bg-rose-950/20 line-through opacity-60 text-rose-700 dark:text-rose-300'
                          : 'hover:bg-indigo-50/30 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      {/* Row Index & Delete Icon */}
                      <td className="px-1 py-1.5 text-[#8c96a8] text-center border-r border-[#edf0f6] dark:border-[#1a1f2b] select-none bg-[#f8f9fb]/40 dark:bg-[#11141e]/50 relative">
                        <div className="flex items-center justify-center">
                          <span className="group-hover:hidden">{rowIndex + 1}</span>
                          {onDeleteRow && !isReadOnly && !isDeleted && (
                            <button
                              onClick={() => onDeleteRow(row)}
                              className="hidden group-hover:flex items-center justify-center p-0.5 text-[#8c96a8] hover:text-rose-500 rounded transition"
                              title="Stage row for deletion"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isDeleted && <span className="text-[10px] text-rose-500 font-bold">DEL</span>}
                        </div>
                      </td>

                      {/* Columns */}
                      {activeColumns.map((col) => {
                        const originalVal = (row as any)[col.name];
                        const cellKey = `${rowPkKey}#${col.name}`;
                        const isModified = pendingModifiedCells.has(cellKey);
                        const displayVal = isModified ? pendingModifiedCells.get(cellKey) : originalVal;
                        const isNull = displayVal === null || displayVal === undefined;
                        const width = columnWidths[col.name] || 150;

                        const isBeingEdited =
                          editingCell?.rowIndex === rowIndex && editingCell?.colName === col.name;

                        return (
                          <td
                            key={col.name}
                            onClick={() => setSelectedCell({ row: rowIndex, col: col.name, val: displayVal })}
                            onDoubleClick={() => {
                              if (!isReadOnly && onCellEdit && !isDeleted) {
                                setEditingCell({
                                  rowIndex,
                                  colName: col.name,
                                  originalVal: displayVal,
                                  editVal: isNull ? '' : String(displayVal),
                                  row,
                                });
                              }
                            }}
                            style={{
                              width: `${width}px`,
                              minWidth: `${width}px`,
                              maxWidth: `${width}px`,
                            }}
                            className={`px-3 py-1.5 border-r border-[#edf0f6] dark:border-[#1a1f2b] truncate cursor-pointer transition-colors duration-100 group/cell ${
                              isModified
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 font-medium'
                                : 'text-[#1b202a] dark:text-[#edf0f6] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'
                            }`}
                            title={String(displayVal)}
                          >
                            {isBeingEdited ? (
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editingCell.editVal}
                                onChange={(e) =>
                                  setEditingCell((prev) =>
                                    prev ? { ...prev, editVal: e.target.value } : null
                                  )
                                }
                                onBlur={handleSaveEdit}
                                onKeyDown={handleEditKeyDown}
                                className="w-full bg-white dark:bg-[#161a24] border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-[#1b202a] dark:text-white focus:outline-none"
                              />
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="truncate">
                                  {isNull ? (
                                    <span className="text-[#8c96a8] italic">null</span>
                                  ) : typeof displayVal === 'object' ? (
                                    <span className="text-amber-600 dark:text-amber-400">{JSON.stringify(displayVal)}</span>
                                  ) : (
                                    String(displayVal)
                                  )}
                                </span>

                                <div className="flex items-center gap-1">
                                  {isModified && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Cell modified" />
                                  )}

                                  {!isNull && fkLookup.has(col.name) && onNavigateForeignKey && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const fk = fkLookup.get(col.name)!;
                                        onNavigateForeignKey(
                                          fk.referencedTable,
                                          fk.referencedColumn,
                                          displayVal
                                        );
                                      }}
                                      className="ml-1 p-0.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition opacity-0 group-hover/cell:opacity-100"
                                      title={`Follow FK ➜ ${
                                        fkLookup.get(col.name)!.referencedTable
                                      }(${fkLookup.get(col.name)!.referencedColumn})`}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {rowVirtualizer.getTotalSize() -
                  (rowVirtualizer.getVirtualItems()[
                    rowVirtualizer.getVirtualItems().length - 1
                  ]?.end || 0) >
                  0 && (
                  <tr>
                    <td
                      style={{
                        height: `${
                          rowVirtualizer.getTotalSize() -
                          (rowVirtualizer.getVirtualItems()[
                            rowVirtualizer.getVirtualItems().length - 1
                          ]?.end || 0)
                        }px`,
                      }}
                      colSpan={activeColumns.length + 1}
                    />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Cell Detail & Inspection Drawer with Concentric Border Radius */}
      {selectedCell && (
        <div className="p-3 bg-white dark:bg-[#141822] border-t border-[#e2e6ee] dark:border-[#222938] shrink-0 flex items-start justify-between font-sans transition-all duration-150 shadow-lg dark:shadow-none">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                {selectedCell.col}
              </span>
              <span className="text-[10px] text-[#8c96a8]">
                (Row #{selectedCell.row + 1})
              </span>
              {!isReadOnly && onCellEdit && (
                <span className="text-[10px] text-[#8c96a8] italic">
                  • Double-click cell to edit inline
                </span>
              )}
            </div>
            <pre className="p-2.5 bg-[#f8f9fb] dark:bg-[#0e1117] border border-[#e2e6ee] dark:border-[#222938] rounded-xl text-xs font-mono text-[#3f4756] dark:text-[#c4cad4] max-h-24 overflow-auto whitespace-pre-wrap select-text leading-relaxed">
              {selectedCell.val === null || selectedCell.val === undefined
                ? 'NULL'
                : typeof selectedCell.val === 'object'
                ? JSON.stringify(selectedCell.val, null, 2)
                : String(selectedCell.val)}
            </pre>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {/* Record Detail & BLOB Modal button */}
            {onOpenRowDetail && (
              <button
                onClick={() => {
                  const r = processedRows[selectedCell.row];
                  if (r) onOpenRowDetail(r, selectedCell.row);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#1a1f2c] hover:bg-[#f1f3f7] dark:hover:bg-[#202534] text-[#3f4756] dark:text-[#c4cad4] border border-[#e2e6ee] dark:border-[#262e40] transition active:scale-[0.98]"
                title="Open full record detail & BLOB inspector"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Detail</span>
              </button>
            )}

            {/* Quick Edit button */}
            {!isReadOnly && onCellEdit && (
              <button
                onClick={() => {
                  const r = processedRows[selectedCell.row];
                  if (r) {
                    setEditingCell({
                      rowIndex: selectedCell.row,
                      colName: selectedCell.col,
                      originalVal: selectedCell.val,
                      editVal: selectedCell.val === null || selectedCell.val === undefined ? '' : String(selectedCell.val),
                      row: r,
                    });
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 transition active:scale-[0.98]"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {selectedCell.val !== null && selectedCell.val !== undefined && fkLookup.has(selectedCell.col) && onNavigateForeignKey && (
              <button
                onClick={() => {
                  const fk = fkLookup.get(selectedCell.col)!;
                  onNavigateForeignKey(fk.referencedTable, fk.referencedColumn, selectedCell.val);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition active:scale-[0.98]"
                title={`Jump to ${fkLookup.get(selectedCell.col)!.referencedTable}`}
              >
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Jump to {fkLookup.get(selectedCell.col)!.referencedTable}</span>
              </button>
            )}

            <button
              onClick={() => copyCell(selectedCell.val)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#1a1f2c] hover:bg-[#f1f3f7] dark:hover:bg-[#202534] text-[#3f4756] dark:text-[#c4cad4] border border-[#e2e6ee] dark:border-[#262e40] transition active:scale-[0.98]"
            >
              {copyFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{copyFeedback}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#8c96a8]" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={() => setSelectedCell(null)}
              className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
