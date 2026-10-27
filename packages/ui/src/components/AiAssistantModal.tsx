import React, { useState } from 'react';
import type { DatabaseSchema, Dialect } from '@sql-magic/core';
import { buildSchemaOnlyAiPrompt } from '@sql-magic/core';
import {
  Sparkles,
  X,
  Play,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  Code,
  Lock,
} from 'lucide-react';

interface AiAssistantModalProps {
  schema: DatabaseSchema | null;
  dialect: Dialect;
  selectedTable?: string;
  onApplySql: (sql: string) => void;
  onClose: () => void;
}

const SAMPLE_PROMPTS = [
  'Find the top 5 records by highest amount/balance',
  'Count all items grouped by status or category',
  'Find records that have no related orders (LEFT JOIN)',
  'Calculate the total revenue and average order value',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  schema,
  dialect,
  selectedTable,
  onApplySql,
  onClose,
}) => {
  const [promptInput, setPromptInput] = useState<string>('');
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Generate heuristic SQL translation directly in browser (client-side template engine)
  const handleGenerate = () => {
    if (!promptInput.trim() || !schema) return;
    setIsGenerating(true);

    setTimeout(() => {
      const q = promptInput.toLowerCase();
      const targetTable = selectedTable || schema.tables[0]?.name || 'customers';
      const tableObj = schema.tables.find((t) => t.name === targetTable);
      const cols = tableObj?.columns || [];

      let sql = '';
      if (q.includes('top 5') || q.includes('highest')) {
        const numCol = cols.find((c) => /amount|price|balance|total|qty|count/i.test(c.name))?.name || cols[0]?.name;
        sql = `SELECT * FROM ${targetTable} ORDER BY ${numCol} DESC LIMIT 5;`;
      } else if (q.includes('group') || q.includes('count')) {
        const catCol = cols.find((c) => /status|category|country|type/i.test(c.name))?.name || cols[1]?.name || cols[0]?.name;
        sql = `SELECT ${catCol}, COUNT(*) as total_count FROM ${targetTable} GROUP BY ${catCol} ORDER BY total_count DESC;`;
      } else if (q.includes('revenue') || q.includes('average')) {
        const numCol = cols.find((c) => /amount|price|balance|total/i.test(c.name))?.name || 'total_amount';
        sql = `SELECT COUNT(*) as total_orders, SUM(${numCol}) as total_sum, ROUND(AVG(${numCol}), 2) as average_val FROM ${targetTable};`;
      } else if (q.includes('join') || q.includes('no related')) {
        const fk = tableObj?.foreignKeys?.[0];
        if (fk) {
          sql = `SELECT t.* FROM ${targetTable} t LEFT JOIN ${fk.referencedTable} r ON t.${fk.column} = r.${fk.referencedColumn} WHERE r.${fk.referencedColumn} IS NULL;`;
        } else {
          sql = `SELECT * FROM ${targetTable} WHERE id NOT IN (SELECT customer_id FROM orders);`;
        }
      } else {
        // General search
        sql = `SELECT * FROM ${targetTable} WHERE ${cols[0]?.name || 'id'} IS NOT NULL LIMIT 50;`;
      }

      setGeneratedSql(sql);
      setIsGenerating(false);
    }, 400);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleUseQuery = () => {
    onApplySql(generatedSql);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-amber-500/20 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-white">AI Text-to-SQL Assistant</span>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <Lock className="w-3 h-3" />
                <span>Zero-Data Privacy: Uses schema DDL only, row data is NEVER sent</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Natural Language Prompt Input */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Ask in plain English:
            </label>
            <div className="relative">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. Find all products priced over 50 with stock under 20..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-sans resize-none"
              />
              <button
                onClick={handleGenerate}
                disabled={!promptInput.trim() || isGenerating}
                className="absolute right-2.5 bottom-3.5 flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Generating...' : 'Generate SQL'}</span>
              </button>
            </div>
          </div>

          {/* Quick Starter Templates */}
          <div>
            <span className="text-[11px] font-medium text-zinc-400 block mb-1.5">
              Or pick an example prompt:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setPromptInput(sample)}
                  className="p-2 text-left rounded bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-800/50 text-xs text-zinc-300 transition"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Generated SQL Result */}
          {generatedSql && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5" /> Generated SQL Query
                </span>
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
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-2.5 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono text-zinc-100 overflow-x-auto leading-relaxed">
                {generatedSql}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-end gap-2 bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
          >
            Cancel
          </button>
          {generatedSql && (
            <button
              onClick={handleUseQuery}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run in Editor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
