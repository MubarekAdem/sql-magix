import React, { useState } from 'react';
import {
  Bookmark,
  X,
  Play,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
} from 'lucide-react';

interface Snippet {
  id: string;
  title: string;
  description: string;
  sql: string;
}

const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: 's1',
    title: 'Find Duplicate Rows',
    description: 'Finds duplicate records matching specific column combinations',
    sql: 'SELECT email, COUNT(*) as count FROM customers GROUP BY email HAVING COUNT(*) > 1;',
  },
  {
    id: 's2',
    title: 'Top Performers by Revenue',
    description: 'Aggregates total spend per customer and orders by highest value',
    sql: 'SELECT c.name, COUNT(o.id) as orders_count, SUM(o.total_amount) as total_spent\nFROM customers c\nJOIN orders o ON c.id = o.customer_id\nGROUP BY c.id\nORDER BY total_spent DESC\nLIMIT 10;',
  },
  {
    id: 's3',
    title: 'Identify Orphan Records (Anti-Join)',
    description: 'Finds parent records without any matching child rows',
    sql: 'SELECT c.* FROM customers c\nLEFT JOIN orders o ON c.id = o.customer_id\nWHERE o.id IS NULL;',
  },
  {
    id: 's4',
    title: 'Recent Time-Window Filter',
    description: 'Filters records created within the last 30 days',
    sql: "SELECT * FROM orders WHERE order_date >= datetime('now', '-30 days') ORDER BY order_date DESC;",
  },
  {
    id: 's5',
    title: 'Paginated Key-Set Query',
    description: 'Performs efficient cursor pagination avoiding large offsets',
    sql: 'SELECT * FROM products WHERE id > {{last_seen_id}} ORDER BY id ASC LIMIT 50;',
  },
];

interface SavedSnippetsModalProps {
  onInsertSql: (sql: string) => void;
  onClose: () => void;
}

export const SavedSnippetsModal: React.FC<SavedSnippetsModalProps> = ({
  onInsertSql,
  onClose,
}) => {
  const [snippets, setSnippets] = useState<Snippet[]>(DEFAULT_SNIPPETS);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet>(DEFAULT_SNIPPETS[0]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedSnippet.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleApply = () => {
    onInsertSql(selectedSnippet.sql);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm text-white">SQL Snippets & Recipes</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: Left list, Right preview */}
        <div className="flex flex-1 overflow-hidden divide-x divide-zinc-800">
          {/* Snippets Master List */}
          <div className="w-72 overflow-y-auto p-2 space-y-1 bg-zinc-950/60">
            {snippets.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSnippet(s)}
                className={`p-2.5 rounded-lg cursor-pointer transition ${
                  selectedSnippet.id === s.id
                    ? 'bg-indigo-600/20 border border-indigo-500/50 text-white'
                    : 'text-zinc-300 hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <div className="text-xs font-semibold">{s.title}</div>
                <div className="text-[11px] text-zinc-500 truncate mt-0.5">{s.description}</div>
              </div>
            ))}
          </div>

          {/* Snippet Details & Editor Insert */}
          <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedSnippet.title}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{selectedSnippet.description}</p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>SQL Template:</span>
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition flex items-center gap-1 text-[11px]"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 overflow-x-auto leading-relaxed">
                  {selectedSnippet.sql}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Insert in Editor</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
