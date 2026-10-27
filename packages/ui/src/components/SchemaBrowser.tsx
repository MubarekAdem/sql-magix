import React, { useState, useMemo } from 'react';
import type { DatabaseSchema, TableInfo } from '@sql-magic/core';
import {
  Table,
  Database,
  Eye,
  Zap,
  Search,
  Key,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FolderTree,
  FileCode,
  Sparkles,
  Plus,
  Upload,
  Trash2,
  X,
} from 'lucide-react';

interface SchemaBrowserProps {
  schema: DatabaseSchema | null;
  selectedTable: TableInfo | null;
  onSelectTable: (table: TableInfo) => void;
  onRefresh: () => void;
  onInspectDdl?: (table: TableInfo) => void;
  onPragmaAction?: (cmd: string) => void;
  capabilities?: { pragma: boolean; schemas: boolean };
  schemasList?: string[];
  activeSchema?: string;
  onSelectSchema?: (schema: string) => void;
  onOpenDesigner?: (mode?: 'table' | 'index' | 'alter' | 'drop', initialTable?: string) => void;
  onOpenImport?: () => void;
}

export const SchemaBrowser: React.FC<SchemaBrowserProps> = ({
  schema,
  selectedTable,
  onSelectTable,
  onRefresh,
  onInspectDdl,
  onPragmaAction,
  capabilities,
  schemasList = [],
  activeSchema = 'public',
  onSelectSchema,
  onOpenDesigner,
  onOpenImport,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleExpand = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Filtered tables, views, triggers
  const { filteredTables, filteredViews, filteredTriggers } = useMemo(() => {
    if (!schema) {
      return { filteredTables: [], filteredViews: [], filteredTriggers: [] };
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return {
        filteredTables: schema.tables,
        filteredViews: schema.views,
        filteredTriggers: schema.triggers,
      };
    }

    const tables = schema.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
    );

    const views = schema.views.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.columns.some((c) => c.name.toLowerCase().includes(q))
    );

    const triggers = schema.triggers.filter(
      (trg) =>
        trg.name.toLowerCase().includes(q) ||
        trg.table.toLowerCase().includes(q)
    );

    return { filteredTables: tables, filteredViews: views, filteredTriggers: triggers };
  }, [schema, searchQuery]);

  return (
    <aside className="w-[270px] bg-white/70 dark:bg-[#121620]/80 backdrop-blur-md border-r border-[#e2e6ee] dark:border-[#222938] flex flex-col shrink-0 select-none transition-colors duration-150">
      {/* Header & Refresh */}
      <div className="h-12 px-3 border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-[#5f687a] dark:text-[#98a0af] flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-indigo-500" />
          <span>Explorer</span>
        </span>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] active:scale-[0.96] transition-all duration-150"
          title="Reload Schema"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Schema / Database Selector (Postgres schemas, MySQL databases) */}
      {capabilities?.schemas && schemasList.length > 0 && (
        <div className="p-3 border-b border-[#e2e6ee] dark:border-[#222938] bg-[#f8f9fb] dark:bg-[#161a24]">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-[#8c96a8] dark:text-[#636d80] mb-1.5">
            Schema / Database
          </label>
          <select
            value={activeSchema}
            onChange={(e) => onSelectSchema && onSelectSchema(e.target.value)}
            className="w-full bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-2.5 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer shadow-2xs"
          >
            {schemasList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search Input following 4px system */}
      <div className="p-3 border-b border-[#e2e6ee] dark:border-[#222938]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#8c96a8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search schema..."
            className="w-full pl-8 pr-7 py-1.5 bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg text-xs text-[#1b202a] dark:text-[#edf0f6] placeholder-[#8c96a8] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Schema Tree Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 font-sans">
        {/* Tables Section */}
        <div>
          <div className="px-1 py-1 text-[11px] font-semibold text-[#5f687a] dark:text-[#98a0af] tracking-wide flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <Table className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tables</span>
            </span>
            <div className="flex items-center gap-1">
              {onOpenDesigner && (
                <button
                  onClick={() => onOpenDesigner('table')}
                  className="p-1 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
                  title="Create new table"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              {onOpenImport && (
                <button
                  onClick={onOpenImport}
                  className="p-1 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
                  title="Import CSV / JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[10px] text-[#8c96a8] dark:text-[#636d80] font-mono px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06]">
                {filteredTables.length}
              </span>
            </div>
          </div>

          <div className="space-y-0.5">
            {filteredTables.map((tbl) => {
              const isSelected = selectedTable?.name === tbl.name;
              const isExpanded = expandedTables.has(tbl.name);

              return (
                <div key={tbl.name} className="flex flex-col group">
                  <div
                    onClick={() => onSelectTable(tbl)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800/50 shadow-2xs'
                        : 'text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] hover:text-[#1b202a] dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => toggleExpand(tbl.name, e)}
                        className="text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white p-0.5 rounded transition"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="truncate font-mono">{tbl.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onOpenDesigner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDesigner('drop', tbl.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-[#8c96a8] hover:text-rose-500 rounded transition"
                          title={`Drop ${tbl.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <span className="text-[10px] text-[#8c96a8] dark:text-[#636d80] font-mono shrink-0">
                        {tbl.rowCount !== undefined ? `${tbl.rowCount}r` : `${tbl.columns.length}c`}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Columns List with Concentric Indentation */}
                  {isExpanded && (
                    <div className="pl-5 pr-2 py-1 space-y-0.5 border-l border-[#e2e6ee] dark:border-[#222938] ml-4 my-1">
                      {tbl.columns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between py-0.5 text-[11px] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {col.primaryKey && (
                              <Key className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                            )}
                            <span className="truncate font-mono">{col.name}</span>
                          </div>
                          <span className="text-[10px] text-[#8c96a8] dark:text-[#636d80] font-mono shrink-0">
                            {col.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTables.length === 0 && (
              <div className="px-3 py-6 text-center space-y-2.5">
                <div className="w-9 h-9 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center text-indigo-500">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#1b202a] dark:text-[#edf0f6]">No tables found</p>
                  <p className="text-[11px] text-[#8c96a8] dark:text-[#636d80] mt-0.5">
                    Create a table to begin
                  </p>
                </div>
                {onOpenDesigner && (
                  <button
                    onClick={() => onOpenDesigner('table')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition active:scale-[0.98]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Table
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Views Section */}
        {filteredViews.length > 0 && (
          <div>
            <div className="px-1 py-1 text-[11px] font-semibold text-[#5f687a] dark:text-[#98a0af] tracking-wide flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-500" />
                <span>Views</span>
              </span>
              <span className="text-[10px] text-[#8c96a8] dark:text-[#636d80] font-mono px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06]">
                {filteredViews.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {filteredViews.map((view) => (
                <div
                  key={view.name}
                  onClick={() => onSelectTable(view)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 ${
                    selectedTable?.name === view.name
                      ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-semibold border border-cyan-200/80 dark:border-cyan-800/50 shadow-2xs'
                      : 'text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.06] hover:text-[#1b202a] dark:hover:text-white'
                  }`}
                >
                  <span className="truncate font-mono">{view.name}</span>
                  <span className="text-[10px] text-[#8c96a8] dark:text-[#636d80] font-mono">view</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Triggers Section */}
        {filteredTriggers.length > 0 && (
          <div>
            <div className="px-1 py-1 text-[11px] font-semibold text-[#5f687a] dark:text-[#98a0af] tracking-wide flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Triggers</span>
              </span>
              <span className="text-[10px] text-[#8c96a8] dark:text-[#636d80] font-mono px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06]">
                {filteredTriggers.length}
              </span>
            </div>
            <div className="space-y-1">
              {filteredTriggers.map((trg) => (
                <div
                  key={trg.name}
                  className="px-2.5 py-1.5 rounded-lg bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#222938] text-xs flex flex-col font-mono"
                >
                  <span className="text-[#1b202a] dark:text-[#edf0f6] font-medium truncate">{trg.name}</span>
                  <span className="text-[10px] text-[#8c96a8] dark:text-[#636d80]">
                    on {trg.table} ({trg.timing} {trg.event})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SQLite PRAGMA Tools */}
        {capabilities?.pragma && onPragmaAction && (
          <div className="pt-3 border-t border-[#e2e6ee] dark:border-[#222938]">
            <div className="px-1 py-1 text-[11px] font-semibold text-[#5f687a] dark:text-[#98a0af] tracking-wide flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>PRAGMA Diagnostics</span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-sans">
              <button
                onClick={() => onPragmaAction('PRAGMA integrity_check;')}
                className="px-2.5 py-1.5 rounded-lg bg-[#f8f9fb] dark:bg-[#161a24] hover:bg-black/5 dark:hover:bg-[#202534] border border-[#e2e6ee] dark:border-[#262e40] text-[11px] text-[#3f4756] dark:text-[#c4cad4] text-left transition active:scale-[0.98]"
              >
                Integrity Check
              </button>
              <button
                onClick={() => onPragmaAction('PRAGMA foreign_key_check;')}
                className="px-2.5 py-1.5 rounded-lg bg-[#f8f9fb] dark:bg-[#161a24] hover:bg-black/5 dark:hover:bg-[#202534] border border-[#e2e6ee] dark:border-[#262e40] text-[11px] text-[#3f4756] dark:text-[#c4cad4] text-left transition active:scale-[0.98]"
              >
                FK Check
              </button>
              <button
                onClick={() => onPragmaAction('PRAGMA quick_check;')}
                className="px-2.5 py-1.5 rounded-lg bg-[#f8f9fb] dark:bg-[#161a24] hover:bg-black/5 dark:hover:bg-[#202534] border border-[#e2e6ee] dark:border-[#262e40] text-[11px] text-[#3f4756] dark:text-[#c4cad4] text-left transition active:scale-[0.98]"
              >
                Quick Check
              </button>
              <button
                onClick={() => onPragmaAction('VACUUM;')}
                className="px-2.5 py-1.5 rounded-lg bg-[#f8f9fb] dark:bg-[#161a24] hover:bg-black/5 dark:hover:bg-[#202534] border border-[#e2e6ee] dark:border-[#262e40] text-[11px] text-[#3f4756] dark:text-[#c4cad4] text-left transition active:scale-[0.98]"
              >
                VACUUM
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
