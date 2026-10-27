import React, { useState, useMemo } from 'react';
import type { DatabaseSchema, TableInfo } from '@sql-magic/core';
import {
  Table,
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
} from 'lucide-react';

interface SchemaBrowserProps {
  schema: DatabaseSchema | null;
  selectedTable: TableInfo | null;
  onSelectTable: (table: TableInfo) => void;
  onRefresh: () => void;
  onInspectDdl?: (table: TableInfo) => void;
  onPragmaAction?: (cmd: string) => void;
  capabilities?: { pragma: boolean; schemas: boolean };
}

export const SchemaBrowser: React.FC<SchemaBrowserProps> = ({
  schema,
  selectedTable,
  onSelectTable,
  onRefresh,
  onInspectDdl,
  onPragmaAction,
  capabilities,
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
    <aside className="w-64 bg-zinc-900/70 border-r border-zinc-800 flex flex-col shrink-0 select-none">
      {/* Header & Refresh */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <FolderTree className="w-3.5 h-3.5 text-indigo-400" /> Schema Explorer
        </span>
        <button
          onClick={onRefresh}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          title="Reload Schema"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-zinc-800">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tables & cols..."
            className="w-full pl-7 pr-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>
      </div>

      {/* Schema Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 font-sans">
        {/* Tables */}
        <div>
          <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Table className="w-3.5 h-3.5 text-indigo-400" /> Tables
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {filteredTables.length}
            </span>
          </div>

          <div className="mt-1 space-y-0.5">
            {filteredTables.map((tbl) => {
              const isSelected = selectedTable?.name === tbl.name;
              const isExpanded = expandedTables.has(tbl.name);

              return (
                <div key={tbl.name} className="flex flex-col">
                  <div
                    onClick={() => onSelectTable(tbl)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        onClick={(e) => toggleExpand(tbl.name, e)}
                        className="text-zinc-500 hover:text-zinc-300 p-0.5"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                      <span className="truncate font-mono">{tbl.name}</span>
                    </div>

                    <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-1">
                      {tbl.rowCount !== undefined ? `${tbl.rowCount}r` : `${tbl.columns.length}c`}
                    </span>
                  </div>

                  {/* Expanded Columns List */}
                  {isExpanded && (
                    <div className="pl-6 pr-2 py-1 space-y-0.5 border-l border-zinc-800/60 ml-3.5 my-0.5">
                      {tbl.columns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            {col.primaryKey && (
                              <Key className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            )}
                            <span className="truncate font-mono">{col.name}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
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
              <div className="px-2 py-2 text-xs text-zinc-500 italic">No tables found</div>
            )}
          </div>
        </div>

        {/* Views */}
        {filteredViews.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" /> Views
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {filteredViews.length}
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              {filteredViews.map((view) => (
                <div
                  key={view.name}
                  onClick={() => onSelectTable(view)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition ${
                    selectedTable?.name === view.name
                      ? 'bg-cyan-600/20 text-cyan-300 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-white'
                  }`}
                >
                  <span className="truncate font-mono">{view.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">view</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Triggers */}
        {filteredTriggers.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Triggers
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {filteredTriggers.length}
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              {filteredTriggers.map((trg) => (
                <div
                  key={trg.name}
                  className="px-2 py-1.5 rounded text-xs text-zinc-400 flex items-center justify-between"
                >
                  <span className="truncate font-mono">{trg.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{trg.table}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRAGMA Quick Actions (if supported by dialect) */}
        {capabilities?.pragma && onPragmaAction && (
          <div className="pt-2 border-t border-zinc-800/80">
            <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> PRAGMA Tools
            </div>
            <div className="mt-1 space-y-1">
              <button
                onClick={() => onPragmaAction('PRAGMA integrity_check;')}
                className="w-full text-left px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                Integrity Check
              </button>
              <button
                onClick={() => onPragmaAction('PRAGMA foreign_key_check;')}
                className="w-full text-left px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                Foreign Key Check
              </button>
              <button
                onClick={() => onPragmaAction('PRAGMA database_list;')}
                className="w-full text-left px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                Database List
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
