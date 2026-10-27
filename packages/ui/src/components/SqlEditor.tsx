import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql, SQLite } from '@codemirror/lang-sql';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import type { DatabaseSchema } from '@sql-magic/core';
import { Play, Plus, X, History, Sparkles, Clock, Check, Copy } from 'lucide-react';

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
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  schema,
  onExecute,
  isLoading,
  historyList,
  theme = 'dark',
}) => {
  const [tabs, setTabs] = useState<SqlEditorTab[]>([
    { id: 'tab-1', title: 'Query 1', query: 'SELECT * FROM users LIMIT 50;' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Schema-aware SQL autocomplete provider
  const schemaCompletionSource = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const options: any[] = [];

    // Add tables and views
    if (schema) {
      for (const tbl of schema.tables) {
        options.push({
          label: tbl.name,
          type: 'class',
          detail: `table (${tbl.columns.length} cols)`,
          boost: 2,
        });
        for (const col of tbl.columns) {
          options.push({
            label: col.name,
            type: 'property',
            detail: `${col.type} [${tbl.name}]`,
            boost: 1,
          });
        }
      }

      for (const view of schema.views) {
        options.push({
          label: view.name,
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
        boost: 0,
      });
    }

    return {
      from: word.from,
      options,
    };
  };

  // Mount/update CodeMirror 6 instance
  useEffect(() => {
    if (!editorContainerRef.current) return;

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
    }

    const runShortcut = keymap.of([
      {
        key: 'Mod-Enter',
        run: (view) => {
          const currentSql = view.state.doc.toString();
          onExecute(currentSql);
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
        runShortcut,
        sql({
          dialect: SQLite,
        }),
        autocompletion({
          override: [schemaCompletionSource],
        }),
        theme === 'dark' ? oneDark : [],
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
            height: '140px',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-content': {
            caretColor: '#6366f1',
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

  return (
    <div className="flex flex-col bg-zinc-900 border-b border-zinc-800 shrink-0">
      {/* Tab bar header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-0 bg-zinc-950/70 border-b border-zinc-800">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-md cursor-pointer border-t border-x transition ${
                activeTabId === tab.id
                  ? 'bg-zinc-900 border-zinc-800 text-indigo-400 font-semibold'
                  : 'bg-zinc-950/50 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition"
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddTab}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition"
            title="New Query Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 pb-1.5">
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition border ${
              showHistory
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
            title="Query History"
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({historyList.length})</span>
          </button>

          <button
            onClick={handleRunCurrent}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Run</span>
            <span className="text-[10px] text-indigo-200 opacity-75 font-mono">Ctrl+↵</span>
          </button>
        </div>
      </div>

      {/* CodeMirror Viewport */}
      <div className="relative">
        <div ref={editorContainerRef} className="border-b border-zinc-800" />

        {/* Query History Drawer */}
        {showHistory && (
          <div className="absolute top-0 right-0 w-96 max-h-72 bg-zinc-900 border-l border-b border-zinc-800 shadow-2xl z-20 flex flex-col">
            <div className="flex items-center justify-between p-2.5 bg-zinc-950 border-b border-zinc-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Query History
              </span>
              <button
                onClick={() => setShowHistory(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
              {historyList.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No previous queries recorded yet
                </div>
              ) : (
                historyList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="p-2.5 hover:bg-zinc-800/60 cursor-pointer transition group"
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      <div className="flex items-center gap-2">
                        <span>{item.durationMs}ms</span>
                        <span>•</span>
                        <span>{item.rowCount} rows</span>
                        <button
                          onClick={(e) => copyHistoryQuery(item, e)}
                          className="text-zinc-500 hover:text-zinc-200"
                          title="Copy SQL"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <pre className="text-xs font-mono text-zinc-300 truncate max-w-full">
                      {item.sql}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
