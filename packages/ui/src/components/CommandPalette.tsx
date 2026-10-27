import React, { useState, useEffect, useRef } from 'react';
import type { DatabaseSchema, TableInfo } from '@sql-magic/core';
import {
  Search,
  Table,
  Eye,
  Layers,
  Upload,
  Download,
  Activity,
  Sparkles,
  Sun,
  Moon,
  X,
  FileCode,
  ArrowRight,
} from 'lucide-react';

interface CommandPaletteProps {
  schema: DatabaseSchema | null;
  onSelectTable: (table: TableInfo) => void;
  onOpenErDiagram: () => void;
  onOpenDesigner: () => void;
  onOpenImport: () => void;
  onExportDb?: () => void;
  onOpenExplain?: () => void;
  onOpenPragma?: () => void;
  onOpenAiAssistant?: () => void;
  onToggleTheme: () => void;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  category: 'Table' | 'View' | 'Action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  schema,
  onSelectTable,
  onOpenErDiagram,
  onOpenDesigner,
  onOpenImport,
  onExportDb,
  onOpenExplain,
  onOpenPragma,
  onOpenAiAssistant,
  onToggleTheme,
  onClose,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build command list
  const commands: CommandItem[] = [
    // Actions
    {
      id: 'act_er',
      category: 'Action',
      title: 'Open ER Diagram',
      subtitle: 'Interactive Entity-Relationship visualizer',
      icon: <Layers className="w-4 h-4 text-indigo-500" />,
      action: () => {
        onOpenErDiagram();
        onClose();
      },
    },
    {
      id: 'act_ai',
      category: 'Action',
      title: 'AI Text-to-SQL Assistant',
      subtitle: 'Generate SQL queries using schema context',
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      action: () => {
        onOpenAiAssistant?.();
        onClose();
      },
    },
    {
      id: 'act_designer',
      category: 'Action',
      title: 'Visual Schema Designer',
      subtitle: 'Create tables, indexes, and run DDL migrations',
      icon: <Table className="w-4 h-4 text-emerald-500" />,
      action: () => {
        onOpenDesigner();
        onClose();
      },
    },
    {
      id: 'act_import',
      category: 'Action',
      title: 'Import CSV or JSON',
      subtitle: 'Parse files and insert data into tables',
      icon: <Upload className="w-4 h-4 text-teal-500" />,
      action: () => {
        onOpenImport();
        onClose();
      },
    },
    {
      id: 'act_explain',
      category: 'Action',
      title: 'Explain Query Plan',
      subtitle: 'Visualize cost tree and index scans',
      icon: <Activity className="w-4 h-4 text-indigo-500" />,
      action: () => {
        onOpenExplain?.();
        onClose();
      },
    },
    {
      id: 'act_theme',
      category: 'Action',
      title: 'Toggle Color Theme',
      subtitle: 'Switch between light and dark modes',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      action: () => {
        onToggleTheme();
        onClose();
      },
    },
  ];

  if (onOpenPragma) {
    commands.push({
      id: 'act_pragma',
      category: 'Action',
      title: 'PRAGMA Diagnostics',
      subtitle: 'Integrity checks, vacuum, and database tuning',
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      action: () => {
        onOpenPragma();
        onClose();
      },
    });
  }

  if (onExportDb) {
    commands.push({
      id: 'act_export',
      category: 'Action',
      title: 'Download Database Binary',
      subtitle: 'Export entire .db SQLite file locally',
      icon: <Download className="w-4 h-4 text-emerald-500" />,
      action: () => {
        onExportDb();
        onClose();
      },
    });
  }

  // Append Tables
  (schema?.tables || []).forEach((t) => {
    commands.push({
      id: `tbl_${t.name}`,
      category: 'Table',
      title: t.name,
      subtitle: `${t.columns.length} columns • ${t.columns.map((c) => c.name).slice(0, 4).join(', ')}...`,
      icon: <Table className="w-4 h-4 text-indigo-500" />,
      action: () => {
        onSelectTable(t);
        onClose();
      },
    });
  });

  // Append Views
  (schema?.views || []).forEach((v) => {
    commands.push({
      id: `view_${v.name}`,
      category: 'View',
      title: v.name,
      subtitle: 'SQL View definition',
      icon: <Eye className="w-4 h-4 text-cyan-500" />,
      action: () => {
        onSelectTable(v);
        onClose();
      },
    });
  });

  // Filter commands
  const filtered = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle?.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 p-4 font-sans select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#262e40] rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden font-sans transition-all duration-150"
      >
        {/* Search Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#e2e6ee] dark:border-[#222938] bg-[#f8f9fb] dark:bg-[#101319]">
          <Search className="w-4 h-4 text-[#8c96a8] mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or table name (Ctrl+K)..."
            className="w-full bg-transparent text-sm text-[#1b202a] dark:text-[#edf0f6] placeholder-[#8c96a8] focus:outline-none font-sans"
          />
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] text-[#8c96a8]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8c96a8]">No matching commands or tables</div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs'
                      : 'text-[#3f4756] dark:text-[#c4cad4] hover:bg-black/5 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{cmd.icon}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{cmd.title}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-[#eef1f6] dark:bg-[#1f2433] text-[#5f687a] dark:text-[#98a0af]">
                          {cmd.category}
                        </span>
                      </div>
                      {cmd.subtitle && (
                        <div className="text-[11px] text-[#8c96a8] truncate">{cmd.subtitle}</div>
                      )}
                    </div>
                  </div>

                  {isSelected && <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
