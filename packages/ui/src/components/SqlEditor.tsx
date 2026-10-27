import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql, SQLite } from '@codemirror/lang-sql';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import type { DatabaseSchema } from '@sql-magic/core';
import { Play, Plus, X, History, Clock, Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  durationMs: number;
  rowCount: number;
  error?: string;
}

export interface SqlEditorTab {
  id: string;
  title: string;
  query: string;
}

interface SqlEditorProps {
  schema: DatabaseSchema | null;
  onExecute: (query: string) => void;
  isLoading: boolean;
  historyList: QueryHistoryItem[];
  theme?: 'dark' | 'light';
  height?: number;
  externalQuery?: string | null;
  onToggleCollapse?: () => void;
}

// Light theme syntax highlighting styles matching Robi's Design System
const sqlLightHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: '#4f46e5', fontWeight: '600' }, // SELECT, FROM, WHERE, JOIN - indigo
  { tag: [t.name, t.deleted, t.character, t.macroName], color: '#0f172a' }, // Identifiers - dark slate
  { tag: [t.propertyName, t.variableName], color: '#0284c7' }, // Columns - ocean blue
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: '#0369a1', fontWeight: '500' }, // Functions
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#7c3aed' }, // Constants
  { tag: [t.definition(t.name), t.separator], color: '#334155' },
  { tag: [t.typeName, t.className, t.annotation, t.modifier, t.self, t.namespace], color: '#7c3aed', fontWeight: '500' }, // Types
  { tag: [t.number, t.integer, t.float], color: '#d97706', fontWeight: '500' }, // Numbers - warm amber
  { tag: [t.bool, t.null, t.atom], color: '#dc2626', fontWeight: '600' }, // Booleans, NULL - ruby red
  { tag: [t.operator], color: '#475569' }, // Operators =, <, >
  { tag: [t.url, t.escape, t.regexp, t.link], color: '#059669' },
  { tag: [t.string, t.special(t.string)], color: '#16a34a' }, // Strings - rich green
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' }, // Comments - muted slate
  { tag: [t.punctuation, t.bracket], color: '#64748b' }, // Brackets and punctuation
]);

// Light theme base editor layout
const sqlLightTheme = EditorView.theme({
  '&': {
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  '.cm-content': {
    caretColor: '#4f46e5',
    padding: '8px 0',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#4f46e5',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#e0e7ff !important',
  },
  '.cm-gutters': {
    backgroundColor: '#f8f9fb',
    color: '#94a3b8',
    borderRight: '1px solid #e2e6ee',
  },
  '.cm-activeLine': {
    backgroundColor: '#f8fafc',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f1f5f9',
    color: '#1e293b',
  },
});

export const SqlEditor: React.FC<SqlEditorProps> = ({
  schema,
  onExecute,
  isLoading,
  historyList,
  theme = 'light',
  height = 160,
  externalQuery,
  onToggleCollapse,
}) => {
  const [tabs, setTabs] = useState<SqlEditorTab[]>([
    {
      id: 'tab-1',
      title: 'Query 1',
      query: schema?.tables?.[0]
        ? `SELECT * FROM "${schema.tables[0].name}" LIMIT 50;`
        : 'SELECT * FROM customers LIMIT 50;',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isCollapsed = height <= 42;

  // Sync externalQuery when table selected or auto-fix triggered
  useEffect(() => {
    if (!externalQuery) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, query: externalQuery } : t))
    );
    if (editorViewRef.current) {
      const currentDoc = editorViewRef.current.state.doc.toString();
      if (currentDoc !== externalQuery) {
        editorViewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentDoc.length,
            insert: externalQuery,
          },
        });
      }
    }
  }, [externalQuery, activeTabId]);

  // Schema-aware SQL autocomplete provider with PostgreSQL/MySQL smart identifier quoting
  const schemaCompletionSource = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const options: any[] = [];

    // Add tables and views with smart quotes for mixed-case / uppercase identifiers
    if (schema) {
      for (const tbl of schema.tables) {
        const needsQuotes = /[A-Z]|\s|[^a-z0-9_]/.test(tbl.name);
        options.push({
          label: tbl.name,
          apply: needsQuotes ? `"${tbl.name}"` : tbl.name,
          type: 'class',
          detail: `table (${tbl.columns.length} cols)`,
          boost: 2,
        });
        for (const col of tbl.columns) {
          const colNeedsQuotes = /[A-Z]|\s|[^a-z0-9_]/.test(col.name);
          options.push({
            label: col.name,
            apply: colNeedsQuotes ? `"${col.name}"` : col.name,
            type: 'property',
            detail: `${col.type} [${tbl.name}]`,
            boost: 1,
          });
        }
      }

      for (const view of schema.views) {
        const vNeedsQuotes = /[A-Z]|\s|[^a-z0-9_]/.test(view.name);
        options.push({
          label: view.name,
          apply: vNeedsQuotes ? `"${view.name}"` : view.name,
          type: 'interface',
          detail: 'view',
          boost: 1.5,
        });
      }
    }

    // Standard SQL keywords
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES', 'UPDATE',
      'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'PRAGMA',
      'EXPLAIN QUERY PLAN', 'COUNT', 'AVG', 'SUM', 'MIN', 'MAX', 'DISTINCT',
      'AND', 'OR', 'NOT', 'NULL', 'IS NULL', 'IS NOT NULL', 'LIKE', 'IN', 'BETWEEN',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'HAVING'
    ];

    for (const kw of keywords) {
      options.push({
        label: kw,
        type: 'keyword',
        boost: 0.5,
      });
    }

    return {
      from: word.from,
      options,
    };
  };

  // Mount CodeMirror 6
  useEffect(() => {
    if (!editorContainerRef.current) return;

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
    }

    const runShortcutKeymap = keymap.of([
      {
        key: 'Mod-Enter',
        run: () => {
          handleRunCurrent();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: activeTab.query,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        runShortcutKeymap,
        sql({ dialect: SQLite }),
        autocompletion({
          override: [schemaCompletionSource],
        }),
        theme === 'dark'
          ? [oneDark]
          : [sqlLightTheme, syntaxHighlighting(sqlLightHighlightStyle)],
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newQuery = update.state.doc.toString();
            setTabs((prev) =>
              prev.map((t) => (t.id === activeTabId ? { ...t, query: newQuery } : t))
            );
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            backgroundColor: theme === 'dark' ? '#121622' : '#ffffff',
          },
          '.cm-scroller': {
            overflow: 'auto',
            height: '100%',
          },
          '.cm-content': {
            caretColor: '#6366f1',
            padding: '8px 0',
          },
          '.cm-gutters': {
            backgroundColor: theme === 'dark' ? '#10131d' : '#f8f9fb',
            color: theme === 'dark' ? '#525b6d' : '#8c96a8',
            borderRight: theme === 'dark' ? '1px solid #1c2232' : '1px solid #e2e6ee',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [activeTabId, theme, schema]);

  const handleAddTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: SqlEditorTab = {
      id: newId,
      title: `Query ${tabs.length + 1}`,
      query: 'SELECT * FROM ',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  const handleRunCurrent = () => {
    if (editorViewRef.current) {
      const currentSql = editorViewRef.current.state.doc.toString();
      onExecute(currentSql);
    } else {
      onExecute(activeTab.query);
    }
  };

  const loadHistoryItem = (item: QueryHistoryItem) => {
    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        changes: {
          from: 0,
          to: editorViewRef.current.state.doc.length,
          insert: item.sql,
        },
      });
    }
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, query: item.sql } : t))
    );
    setShowHistory(false);
  };

  const copyHistoryQuery = (item: QueryHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.sql);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Remaining height for editor body
  const bodyHeight = Math.max(0, height - 38);

  return (
    <div
      style={{ height: `${height}px` }}
      className="flex flex-col bg-white dark:bg-[#121622] border-b border-[#e2e6ee] dark:border-[#222938] shrink-0 font-sans transition-colors duration-150 overflow-hidden"
    >
      {/* Tab bar header */}
      <div className="h-[38px] flex items-center justify-between px-3 bg-[#f8f9fb] dark:bg-[#0f1218] border-b border-[#e2e6ee] dark:border-[#222938] shrink-0 select-none">
        {/* Concentric Tabs Strip */}
        <div className="flex items-center gap-1 overflow-x-auto h-full pt-1">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-lg cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-white dark:bg-[#121622] text-indigo-600 dark:text-indigo-400 font-medium border-t-2 border-indigo-500 shadow-2xs'
                    : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                }`}
              >
                <span>{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity p-0.5 rounded"
                    title="Close Tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={handleAddTab}
            className="p-1 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
            title="New Query Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* History Drawer Toggle */}
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 border ${
              showHistory
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                : 'bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] border-[#e2e6ee] dark:border-[#262e40] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#202534]'
            }`}
            title="Query History"
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({historyList.length})</span>
          </button>

          {/* Run Query Button */}
          <button
            onClick={handleRunCurrent}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-50 transition-all duration-150 shadow-2xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run</span>
            <span className="text-[10px] text-indigo-200 opacity-80 font-mono">⌘↵</span>
          </button>

          {/* Quick Collapse / Expand Toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
              title={isCollapsed ? 'Expand Query Box' : 'Collapse Query Box'}
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* CodeMirror Viewport Container */}
      {!isCollapsed && (
        <div className="relative flex-1 min-h-0 overflow-hidden" style={{ height: `${bodyHeight}px` }}>
          <div ref={editorContainerRef} className="h-full w-full overflow-hidden" />

          {/* Query History Drawer */}
          {showHistory && (
            <div className="absolute top-0 right-0 w-[400px] max-h-72 bg-white dark:bg-[#141824] border-l border-b border-[#e2e6ee] dark:border-[#222938] shadow-xl dark:shadow-none z-20 flex flex-col font-sans">
              <div className="flex items-center justify-between p-3 bg-[#f8f9fb] dark:bg-[#10131d] border-b border-[#e2e6ee] dark:border-[#222938]">
                <span className="text-xs font-semibold tracking-wide text-[#5f687a] dark:text-[#98a0af] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Query History</span>
                </span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white p-1 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-[#e2e6ee] dark:divide-[#222938]">
                {historyList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#8c96a8] italic">
                    No previous queries recorded yet
                  </div>
                ) : (
                  historyList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadHistoryItem(item)}
                      className="p-3 hover:bg-[#f8f9fb] dark:hover:bg-white/[0.04] cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#8c96a8] mb-1">
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span>{item.durationMs}ms</span>
                          <span>•</span>
                          <span>{item.rowCount} rows</span>
                          <button
                            onClick={(e) => copyHistoryQuery(item, e)}
                            className="text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white transition"
                            title="Copy SQL"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <pre className="text-xs font-mono text-[#3f4756] dark:text-[#c4cad4] truncate max-w-full">
                        {item.sql}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
