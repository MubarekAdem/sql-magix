import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnMeta, ForeignKeyInfo, ResultSet, ChangeItem } from '@sql-magic/core';
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
  theme = 'dark',
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

  // Map of pending deletions (row ids or pk values)
  const pendingDeletions = useMemo(() => {
    const deletedPkSet = new Set<string>();
    for (const chg of pendingChanges) {
      if (chg.type === 'delete-row') {
        const pkKey = Object.entries(chg.pkValues)
          .map(([k, v]) => `${k}:${v}`)
          .sort()
          .join('|');
        if (pkKey) deletedPkSet.add(pkKey);
      }
    }
    return deletedPkSet;
  }, [pendingChanges]);

  // Map of pending cell modifications
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

  // Helper to extract row PK key
  const getRowPkKey = useCallback(
    (row: Record<string, unknown>) => {
      if (primaryKeys.length > 0) {
        return primaryKeys
          .map((pk) => `${pk}:${row[pk]}`)
          .sort()
          .join('|');
      }
      return Object.entries(row)
        .slice(0, 3)
        .map(([k, v]) => `${k}:${v}`)
        .join('|');
    },
    [primaryKeys]
  );

  // Sorting state
  const [sort, setSort] = useState<ColumnSort>({ column: '', direction: null });

  // Column order & visibility & widths state
  const initialCols = useMemo(() => resultSet.columns.map((c) => c.name), [resultSet.columns]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(initialCols);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Reset or align columns when resultSet changes
  useEffect(() => {
    setVisibleColumns(resultSet.columns.map((c) => c.name));
  }, [resultSet]);

  // Handle column sort toggle
  const toggleSort = (colName: string) => {
    if (sort.column !== colName) {
      setSort({ column: colName, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      setSort({ column: colName, direction: 'desc' });
    } else {
      setSort({ column: '', direction: null });
    }
  };

  // Filter & sort rows
  const processedRows = useMemo(() => {
    let rows = [...resultSet.rows];

    // Global Search
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        )
      );
    }

    // Per-column filters
    for (const [col, filterVal] of Object.entries(columnFilters)) {
      if (filterVal && filterVal.trim()) {
        const q = filterVal.toLowerCase().trim();
        rows = rows.filter((row) => {
          const val = (row as any)[col];
          if (q === 'null') return val === null || val === undefined;
          if (q === '!null' || q === 'not null') return val !== null && val !== undefined;
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      }
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
    estimateSize: () => 32, // 32px standard row height
    overscan: 20,
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

    // Type coercion matching original type
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
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-mono text-xs select-none">
      {/* Grid Toolbar */}
      <div className="flex items-center justify-between p-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        {/* Left: Global Search & Filter Toggle & Edit Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter visible rows..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-7 pr-3 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 w-48"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch('')}
                className="absolute right-2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs transition ${
              showFilters
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          {/* Add Row Button */}
          {onAddRow && !isReadOnly && (
            <button
              onClick={onAddRow}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-emerald-300 hover:border-emerald-800/60 transition"
              title="Add a new row to table"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Row</span>
            </button>
          )}

          {/* Undo / Redo controls */}
          {(onUndo || onRedo) && (
            <div className="flex items-center border border-zinc-800 rounded bg-zinc-950">
              {onUndo && (
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="p-1 px-1.5 text-zinc-400 hover:text-white disabled:opacity-30 border-r border-zinc-800 transition"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onRedo && (
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="p-1 px-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition"
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-700/80 hover:bg-amber-900/60 transition font-sans"
              title="Review pending modifications"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-semibold text-xs">
                {pendingChangesCount} Pending {pendingChangesCount === 1 ? 'Edit' : 'Edits'}
              </span>
            </button>
          )}
        </div>

        {/* Right: Column Picker & Exporter & Row Counts */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400 font-sans">
            Showing <strong className="text-zinc-200">{processedRows.length}</strong> of{' '}
            <strong className="text-zinc-200">{resultSet.rowCount}</strong> rows
          </span>

          {/* Column Visibility Menu */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker((prev) => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 transition"
              title="Show / Hide Columns"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Cols ({visibleColumns.length}/{resultSet.columns.length})</span>
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 top-8 w-56 max-h-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-2 z-30 overflow-y-auto font-sans">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800 text-[11px]">
                  <span className="font-semibold text-zinc-300">Visible Columns</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVisibleColumns(resultSet.columns.map((c) => c.name))}
                      className="text-indigo-400 hover:underline"
                    >
                      All
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => setVisibleColumns([resultSet.columns[0]?.name || ''])}
                      className="text-zinc-500 hover:underline"
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
                        className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-zinc-800 cursor-pointer text-xs"
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
                          className="rounded border-zinc-700 text-indigo-600 focus:ring-0"
                        />
                        <span className="truncate">{col.name}</span>
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
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-sans font-medium transition"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-8 w-44 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-30 font-sans">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" /> CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-400" /> JSON
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" /> Excel (.xls)
                </button>
                <button
                  onClick={() => handleExport('sql')}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" /> SQL INSERT
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" /> Markdown Table
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Virtual Table Scrollport */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto bg-zinc-950 relative border-t border-zinc-800"
      >
        <table className="w-full border-collapse text-left font-mono text-xs">
          {/* Sticky Header */}
          <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10 shadow-sm">
            <tr>
              {/* Row index header */}
              <th className="w-14 px-2 py-2 text-zinc-500 font-normal border-r border-zinc-800 text-center select-none bg-zinc-900">
                #
              </th>
              {activeColumns.map((col) => {
                const width = columnWidths[col.name] || 150;
                const isSorted = sort.column === col.name;
                return (
                  <th
                    key={col.name}
                    style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                    className="relative px-3 py-2 font-semibold text-zinc-200 border-r border-zinc-800 group bg-zinc-900"
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSort(col.name)}
                    >
                      <span className="truncate pr-1" title={col.name}>
                        {col.name}
                      </span>
                      <div className="flex items-center text-zinc-500 group-hover:text-zinc-300">
                        {isSorted && sort.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                        ) : isSorted && sort.direction === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </div>
                    </div>

                    {/* Draggable Column Resizer Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(col.name, e)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/80 transition select-none"
                    />
                  </th>
                );
              })}
            </tr>

            {/* Optional Per-Column Filter Row */}
            {showFilters && (
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="px-2 py-1 text-zinc-600 border-r border-zinc-800 text-center font-normal">
                  <Filter className="w-3 h-3 mx-auto" />
                </th>
                {activeColumns.map((col) => (
                  <th key={col.name} className="p-1 border-r border-zinc-800 font-normal">
                    <input
                      type="text"
                      placeholder={`Filter ${col.name}...`}
                      value={columnFilters[col.name] || ''}
                      onChange={(e) =>
                        setColumnFilters((prev) => ({ ...prev, [col.name]: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-300 focus:outline-none focus:border-indigo-500"
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
                  className="py-12 text-center text-zinc-500 font-sans text-xs"
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
                      className={`border-b border-zinc-900 transition group ${
                        isDeleted
                          ? 'bg-rose-950/20 line-through opacity-60 text-rose-300'
                          : 'hover:bg-zinc-900/60'
                      }`}
                    >
                      {/* Row Index & Delete Icon */}
                      <td className="px-1 py-1.5 text-zinc-600 text-center border-r border-zinc-800 select-none bg-zinc-950/40 relative">
                        <div className="flex items-center justify-center">
                          <span className="group-hover:hidden">{rowIndex + 1}</span>
                          {onDeleteRow && !isReadOnly && !isDeleted && (
                            <button
                              onClick={() => onDeleteRow(row)}
                              className="hidden group-hover:flex items-center justify-center p-0.5 text-zinc-500 hover:text-rose-400 rounded transition"
                              title="Stage row for deletion"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isDeleted && <span className="text-[10px] text-rose-400">DEL</span>}
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
                            className={`px-3 py-1.5 border-r border-zinc-800/80 truncate cursor-pointer transition group/cell ${
                              isModified
                                ? 'bg-amber-950/30 text-amber-200 border-amber-600/50'
                                : 'text-zinc-200 hover:bg-indigo-950/30'
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
                                className="w-full bg-zinc-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                              />
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="truncate">
                                  {isNull ? (
                                    <span className="text-zinc-600 italic">null</span>
                                  ) : typeof displayVal === 'object' ? (
                                    <span className="text-amber-400/90">{JSON.stringify(displayVal)}</span>
                                  ) : (
                                    String(displayVal)
                                  )}
                                </span>

                                <div className="flex items-center gap-1">
                                  {isModified && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Cell modified" />
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
                                      className="ml-1 p-0.5 rounded text-amber-400/70 hover:text-amber-300 hover:bg-amber-950/50 transition opacity-0 group-hover/cell:opacity-100"
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

      {/* Cell Detail & Inspection Drawer */}
      {selectedCell && (
        <div className="p-3 bg-zinc-900 border-t border-zinc-800 shrink-0 flex items-start justify-between font-sans">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-indigo-400 font-mono">
                {selectedCell.col}
              </span>
              <span className="text-[10px] text-zinc-500">
                (Row #{selectedCell.row + 1})
              </span>
              {!isReadOnly && onCellEdit && (
                <span className="text-[10px] text-zinc-500 italic">
                  • Double-click cell to edit inline
                </span>
              )}
            </div>
            <pre className="p-2 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 max-h-24 overflow-auto whitespace-pre-wrap select-text">
              {selectedCell.val === null || selectedCell.val === undefined
                ? 'NULL'
                : typeof selectedCell.val === 'object'
                ? JSON.stringify(selectedCell.val, null, 2)
                : String(selectedCell.val)}
            </pre>
          </div>
          <div className="flex items-center gap-2 pt-1">
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
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-800/60 transition"
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
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60 transition"
                title={`Jump to ${fkLookup.get(selectedCell.col)!.referencedTable}`}
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Jump to {fkLookup.get(selectedCell.col)!.referencedTable}</span>
              </button>
            )}
            <button
              onClick={() => copyCell(selectedCell.val)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
            >
              {copyFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{copyFeedback}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={() => setSelectedCell(null)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
