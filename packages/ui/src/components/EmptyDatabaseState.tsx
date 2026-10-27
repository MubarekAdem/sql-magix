import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Database,
  PlusCircle,
  Upload,
  Sparkles,
  Terminal,
  ArrowRight,
  FileCode2,
} from 'lucide-react';

interface EmptyDatabaseStateProps {
  onOpenFilePicker: () => void;
  onOpenConnect: () => void;
  onOpenDesigner: () => void;
  onOpenImport: () => void;
  onLoadSampleData?: () => void;
  onInsertStarterQuery?: () => void;
  onFileDrop: (file: File) => void;
}

export const EmptyDatabaseState: React.FC<EmptyDatabaseStateProps> = ({
  onOpenFilePicker,
  onOpenConnect,
  onOpenDesigner,
  onOpenImport,
  onLoadSampleData,
  onInsertStarterQuery,
  onFileDrop,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files[0]);
    }
  };

  const actionCards = [
    {
      title: 'Open Local File',
      subtitle: 'Browse or drop a .db, .sqlite, or .sqlite3 file from your disk',
      icon: FolderOpen,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-200/50 dark:border-amber-800/40',
      action: () => hiddenInputRef.current?.click(),
      badge: 'Local WASM',
    },
    {
      title: 'Connect Database',
      subtitle: 'Connect to live PostgreSQL, MySQL, or remote SQLite URL',
      icon: Database,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-500/10 border-indigo-200/50 dark:border-indigo-800/40',
      action: onOpenConnect,
      badge: 'Remote & Server',
    },
    {
      title: 'Design New Table',
      subtitle: 'Visually create tables, define columns, types, and constraints',
      icon: PlusCircle,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-800/40',
      action: onOpenDesigner,
      badge: 'Visual Schema',
    },
    {
      title: 'Import CSV / JSON',
      subtitle: 'Upload spreadsheet or JSON files to auto-create populated tables',
      icon: Upload,
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-500/10 border-sky-200/50 dark:border-sky-800/40',
      action: onOpenImport,
      badge: 'Data Import',
    },
  ];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`h-full w-full overflow-y-auto flex flex-col items-center justify-center p-6 sm:p-10 transition-colors duration-200 relative ${
        isDragging
          ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
          : 'bg-[#f8f9fb] dark:bg-[#0f1218]'
      }`}
    >
      <input
        ref={hiddenInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,.db3,.sqlitedb,.csv,.json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Drag Overlay Notice */}
      {isDragging && (
        <div className="absolute inset-4 z-50 rounded-2xl border-2 border-dashed border-indigo-500 bg-white/90 dark:bg-[#141822]/90 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 animate-bounce" />
          </div>
          <h3 className="text-base font-semibold text-[#1b202a] dark:text-[#edf0f6]">
            Drop your file to load
          </h3>
          <p className="text-xs text-[#5f687a] dark:text-[#98a0af] mt-1 font-mono">
            Supports SQLite (.db, .sqlite), CSV, and JSON
          </p>
        </div>
      )}

      <div className="max-w-2xl w-full flex flex-col items-center text-center space-y-8 animate-in fade-in duration-300">
        {/* Brand Emblem & Welcome Message */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>sql-magic workspace ready</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1b202a] dark:text-[#edf0f6]">
            No database loaded yet
          </h2>
          <p className="text-xs sm:text-sm text-[#5f687a] dark:text-[#98a0af] max-w-lg mx-auto leading-relaxed">
            Choose how you want to get started, or write and execute SQL queries directly in the editor above.
          </p>
        </div>

        {/* 4 Primary Action Cards following Robi's Design Principles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={card.action}
                className="group relative flex items-start text-left p-4 rounded-2xl bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] hover:border-indigo-400 dark:hover:border-indigo-500/70 hover:shadow-md dark:hover:shadow-indigo-950/20 active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${card.iconBg} ${card.iconColor} mr-3.5 transition-transform duration-150 group-hover:scale-105`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#1b202a] dark:text-[#edf0f6] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {card.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-black/[0.04] dark:bg-white/[0.05] text-[#8c96a8] dark:text-[#636d80]">
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5f687a] dark:text-[#98a0af] mt-1 line-clamp-2 leading-relaxed">
                    {card.subtitle}
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-[#cbd5e1] dark:text-[#334155] group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0 absolute right-4 top-4" />
              </button>
            );
          })}
        </div>

        {/* Starter Query & Demo Dataset Options */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-white/70 dark:bg-[#141822]/70 border border-[#e2e6ee] dark:border-[#222938] text-xs">
          <div className="flex items-center gap-2.5 text-[#5f687a] dark:text-[#98a0af]">
            <Terminal className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-left">
              Want to start typing SQL? Paste a starter table template:
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onInsertStarterQuery && (
              <button
                onClick={onInsertStarterQuery}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f1f3f7] dark:bg-[#1c2230] text-[#1b202a] dark:text-[#edf0f6] hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition active:scale-[0.98]"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                Paste Starter DDL
              </button>
            )}

            {onLoadSampleData && (
              <button
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8c96a8] dark:text-[#636d80] hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition"
              >
                Load demo store
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
