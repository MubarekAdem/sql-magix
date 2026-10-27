import React, { useState } from 'react';
import type { DatabaseSchema, Dialect } from '@sql-magic/core';
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
        sql = `SELECT * FROM ${targetTable} WHERE ${cols[0]?.name || 'id'} IS NOT NULL LIMIT 50;`;
      }

      setGeneratedSql(sql);
      setIsGenerating(false);
    }, 350);
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">AI SQL Generator</span>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                <Lock className="w-3 h-3" />
                <span>Zero-Data Privacy • Only schema DDL is referenced</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Natural Language Prompt Input */}
          <div>
            <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
              Describe what data you want in plain English:
            </label>
            <div className="relative">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. Find all products priced over 50 with stock under 20..."
                rows={3}
                className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-xl p-3 text-xs text-[#1b202a] dark:text-[#edf0f6] placeholder-[#8c96a8] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans resize-none transition-all"
              />
              <button
                onClick={handleGenerate}
                disabled={!promptInput.trim() || isGenerating}
                className="absolute right-2.5 bottom-3.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-40 transition shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Thinking...' : 'Generate SQL'}</span>
              </button>
            </div>
          </div>

          {/* Quick Starter Templates */}
          <div>
            <span className="text-[11px] font-medium text-[#8c96a8] block mb-2">
              Or pick an example prompt:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setPromptInput(sample)}
                  className="p-2.5 text-left rounded-xl bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#262e40] hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-white dark:hover:bg-[#181d2a] text-xs text-[#3f4756] dark:text-[#c4cad4] transition-all duration-150 active:scale-[0.98]"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Generated SQL Result */}
          {generatedSql && (
            <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5" />
                  <span>Generated SQL Query</span>
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition flex items-center gap-1 text-xs"
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
              <pre className="p-3 bg-white dark:bg-[#0c0e14] border border-[#e2e6ee] dark:border-[#222938] rounded-lg text-xs font-mono text-[#1b202a] dark:text-[#edf0f6] overflow-x-auto leading-relaxed">
                {generatedSql}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex items-center justify-end gap-2.5 bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
          >
            Cancel
          </button>
          {generatedSql && (
            <button
              onClick={handleUseQuery}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white transition shadow-2xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run in Editor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
