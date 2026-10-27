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
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
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
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      action: () => {
        onOpenAiAssistant?.();
        onClose();
      },
    },
    {
      id: 'act_designer',
      category: 'Action',
      title: 'Schema Designer',
      subtitle: 'Create tables, indexes, alter, or drop objects',
      icon: <Table className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onOpenDesigner();
        onClose();
      },
    },
    {
      id: 'act_import',
      category: 'Action',
      title: 'Import CSV / JSON',
      subtitle: 'Upload and infer types into a new table',
      icon: <Upload className="w-4 h-4 text-teal-400" />,
      action: () => {
        onOpenImport();
        onClose();
      },
    },
    {
      id: 'act_explain',
      category: 'Action',
      title: 'EXPLAIN Query Plan',
      subtitle: 'View optimizer hierarchy and index advisor',
      icon: <Activity className="w-4 h-4 text-violet-400" />,
      action: () => {
        onOpenExplain?.();
        onClose();
      },
    },
    {
      id: 'act_pragma',
      category: 'Action',
      title: 'PRAGMA Integrity & Vacuum Tools',
      subtitle: 'Run database health checks and optimization',
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      action: () => {
        onOpenPragma?.();
        onClose();
      },
    },
    {
      id: 'act_theme',
      category: 'Action',
      title: 'Toggle Theme',
      subtitle: 'Switch between dark and light modes',
      icon: <Sun className="w-4 h-4 text-yellow-400" />,
      action: () => {
        onToggleTheme();
        onClose();
      },
    },
  ];

  // Append Tables
  (schema?.tables || []).forEach((t) => {
    commands.push({
      id: `tbl_${t.name}`,
      category: 'Table',
      title: t.name,
      subtitle: `${t.columns.length} columns • ${t.columns.map((c) => c.name).slice(0, 4).join(', ')}...`,
      icon: <Table className="w-4 h-4 text-indigo-400" />,
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
      icon: <Eye className="w-4 h-4 text-cyan-400" />,
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-24 p-4 font-sans select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden"
      >
        {/* Search Bar */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-800 bg-zinc-950">
          <Search className="w-4 h-4 text-zinc-400 mr-3" />
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
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">No matching commands or tables</div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${
                    isSelected ? 'bg-indigo-600/20 text-white' : 'text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{cmd.icon}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{cmd.title}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {cmd.category}
                        </span>
                      </div>
                      {cmd.subtitle && (
                        <div className="text-[11px] text-zinc-500 truncate">{cmd.subtitle}</div>
                      )}
                    </div>
                  </div>

                  {isSelected && <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
