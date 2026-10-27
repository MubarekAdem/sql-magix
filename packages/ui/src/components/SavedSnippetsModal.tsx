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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-[#1b202a] dark:text-white">SQL Snippets & Recipes</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Two columns with Concentric Radii */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Snippets Selector */}
          <div className="w-72 bg-[#f8f9fb] dark:bg-[#101319] border-r border-[#e2e6ee] dark:border-[#222938] p-3 space-y-1.5 overflow-y-auto">
            {snippets.map((snip) => {
              const isSelected = selectedSnippet.id === snip.id;
              return (
                <div
                  key={snip.id}
                  onClick={() => setSelectedSnippet(snip)}
                  className={`p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-white dark:bg-[#1c2232] border border-indigo-200 dark:border-indigo-800/60 shadow-2xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={`text-xs font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-[#1b202a] dark:text-[#edf0f6]'}`}>
                    {snip.title}
                  </div>
                  <div className="text-[11px] text-[#8c96a8] mt-0.5 line-clamp-2">
                    {snip.description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Snippet Detail & SQL Preview */}
          <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto bg-white dark:bg-[#151922]">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#1b202a] dark:text-white">
                  {selectedSnippet.title}
                </h3>
                <p className="text-xs text-[#5f687a] dark:text-[#98a0af] mt-1">
                  {selectedSnippet.description}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#5f687a] dark:text-[#98a0af] flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-indigo-500" />
                    <span>SQL Query</span>
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded-md text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition flex items-center gap-1 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 bg-[#f8f9fb] dark:bg-[#0c0e14] border border-[#e2e6ee] dark:border-[#222938] rounded-xl text-xs font-mono text-[#1b202a] dark:text-[#edf0f6] overflow-x-auto leading-relaxed">
                  {selectedSnippet.sql}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#e2e6ee] dark:border-[#222938]">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white transition shadow-2xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Insert into Editor</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
