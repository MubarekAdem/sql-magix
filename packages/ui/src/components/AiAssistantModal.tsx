import React, { useState, useEffect } from 'react';
import type { DatabaseSchema, Dialect } from 'sql-magic-core';
import {
  Sparkles,
  X,
  Play,
  Copy,
  Check,
  ShieldCheck,
  Code,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AiAssistantModalProps {
  schema: DatabaseSchema | null;
  dialect: Dialect;
  selectedTable?: string;
  onApplySql: (sql: string) => void;
  onClose: () => void;
}

const STORAGE_KEY = 'sql_magic_gemini_api_key';
const STORAGE_MODEL_KEY = 'sql_magic_gemini_model';

const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Recommended)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

const SAMPLE_PROMPTS = [
  'Find the top 5 records by highest amount/balance',
  'Count all items grouped by status or category',
  'Find records with no matching foreign key relationships (orphans)',
  'Calculate total revenue and average order value',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  schema,
  dialect,
  selectedTable,
  onApplySql,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite');
  const [promptInput, setPromptInput] = useState<string>('');
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Load saved API key and preferred model from localStorage
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem(STORAGE_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      if (savedKey) {
        setApiKey(savedKey);
      } else {
        setShowConfig(true); // Open settings if no key configured
      }

      const savedModel = localStorage.getItem(STORAGE_MODEL_KEY);
      if (savedModel && AVAILABLE_MODELS.some((m) => m.id === savedModel)) {
        setSelectedModel(savedModel);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    try {
      if (key.trim()) {
        localStorage.setItem(STORAGE_KEY, key.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    try {
      localStorage.setItem(STORAGE_MODEL_KEY, model);
    } catch {
      // Ignore
    }
  };

  // Build condensed schema representation without leaking any user data rows
  const buildSchemaContext = (): string => {
    if (!schema || schema.tables.length === 0) {
      return 'No tables currently in database.';
    }

    return schema.tables
      .map((t) => {
        const cols = t.columns
          .map((c) => {
            const pk = c.primaryKey ? ' PRIMARY KEY' : '';
            const nn = c.nullable ? '' : ' NOT NULL';
            return `${c.name} ${c.type}${pk}${nn}`;
          })
          .join(', ');

        const fks = (t.foreignKeys || [])
          .map((fk) => `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`)
          .join(', ');

        return `TABLE ${t.name} (${cols}${fks ? ', ' + fks : ''});`;
      })
      .join('\n');
  };

  // Call Gemini REST API with automated fallback cascade
  const callGemini = async (model: string, key: string, systemPrompt: string, userPrompt: string): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      key.trim()
    )}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\nUser Request: ${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      const status = res.status;
      const errorObj = new Error(errMsg);
      (errorObj as any).status = status;
      throw errorObj;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned an empty response. Please try rephrasing your request.');
    }
    return text;
  };

  const handleGenerate = async () => {
    if (!promptInput.trim()) return;

    if (!apiKey.trim()) {
      setError('Please provide a Gemini API Key to use the AI SQL generator.');
      setShowConfig(true);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedSql('');
    setAiExplanation('');
    setUsedModel(null);

    const schemaSummary = buildSchemaContext();
    const currentTableHint = selectedTable ? `\nFocus primarily on table: "${selectedTable}" if relevant.` : '';

    const systemPrompt = `You are an expert SQL assistant for database dialect "${dialect}".
Generate ONLY valid, executable ${dialect} SQL that answers the user's natural language request.
Use the following database schema context:
${schemaSummary}${currentTableHint}

CRITICAL RULES:
1. Output valid ${dialect} SQL syntax.
2. Return your response formatted with markdown sql code block:
\`\`\`sql
SELECT ...
\`\`\`
3. If necessary, provide a 1-sentence plain text explanation below the SQL block.
4. Do not invent tables or columns that are not present in the schema.
5. If table or column names contain uppercase letters, quote them according to ${dialect} standards (e.g. double quotes for PostgreSQL/SQLite, backticks for MySQL).`;

    // Candidate fallback models
    const fallbackList = [
      selectedModel,
      ...AVAILABLE_MODELS.map((m) => m.id).filter((id) => id !== selectedModel),
    ];

    let lastError: any = null;
    let successfulResult: string | null = null;
    let successfulModel: string | null = null;

    for (const modelToTry of fallbackList) {
      try {
        successfulResult = await callGemini(modelToTry, apiKey, systemPrompt, promptInput.trim());
        successfulModel = modelToTry;
        break;
      } catch (err: any) {
        lastError = err;
        // If 404 (model not found) or 400 (model unsupported), try next fallback model
        if (err.status === 404 || err.status === 400) {
          continue;
        }
        // If 403 or 401 (invalid key), do not loop through other models
        if (err.status === 401 || err.status === 403) {
          break;
        }
      }
    }

    if (!successfulResult) {
      const msg = lastError?.message || 'Failed to generate SQL with Gemini API.';
      setError(
        lastError?.status === 401 || lastError?.status === 403
          ? `Invalid API Key or Permission Denied: ${msg}`
          : `Gemini API Error: ${msg}`
      );
      setIsGenerating(false);
      return;
    }

    // Extract SQL from markdown code block
    const sqlMatch = successfulResult.match(/```(?:sql)?\s*([\s\S]*?)```/i);
    let extractedSql = '';
    let explanation = '';

    if (sqlMatch) {
      extractedSql = sqlMatch[1].trim();
      const parts = successfulResult.split(sqlMatch[0]);
      explanation = parts.join(' ').replace(/```/g, '').trim();
    } else {
      extractedSql = successfulResult.trim();
    }

    setGeneratedSql(extractedSql);
    setAiExplanation(explanation);
    setUsedModel(successfulModel);
    setIsGenerating(false);
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] transition-all duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Gemini SQL Assistant</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
                  {dialect.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Zero-Data Privacy • Only schema structure is shared</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                showConfig || !apiKey
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50'
                  : 'text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06]'
              }`}
              title="Configure Gemini API Key & Model"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="text-[11px]">{apiKey ? 'Settings' : 'Set API Key'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* API Key & Model Configuration Panel */}
          {showConfig && (
            <div className="p-4 rounded-xl bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1b202a] dark:text-[#edf0f6]">
                  <Key className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Gemini API Key & Model</span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Get Free API Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="Paste your Google AI Studio API key (AIzaSy...)"
                    className="w-full bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 pr-20 text-xs font-mono text-[#1b202a] dark:text-[#edf0f6] placeholder-[#8c96a8] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-2xs"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white rounded"
                      title={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {apiKey && (
                      <button
                        type="button"
                        onClick={() => handleSaveApiKey('')}
                        className="px-1.5 py-0.5 text-[10px] text-rose-500 hover:text-rose-600 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-[#8c96a8] dark:text-[#636d80]">
                  Stored locally in your browser storage. Never sent to any third-party server.
                </p>
              </div>

              {/* Model Selection Dropdown */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#e2e6ee]/60 dark:border-[#262e40]/60">
                <label className="text-[11px] text-[#5f687a] dark:text-[#98a0af] shrink-0 font-medium">
                  Primary Model:
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => handleSelectModel(e.target.value)}
                  className="bg-white dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-2.5 py-1 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer shadow-2xs"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Missing API Key Warning */}
          {!apiKey && !showConfig && (
            <div
              onClick={() => setShowConfig(true)}
              className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between text-xs cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition"
            >
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Gemini API Key required to generate SQL queries.</span>
              </div>
              <span className="font-semibold text-amber-700 dark:text-amber-300 underline text-[11px]">
                Configure Key
              </span>
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {error.includes('Key') && (
                  <button
                    onClick={() => setShowConfig(true)}
                    className="mt-1 text-[11px] underline font-semibold text-rose-700 dark:text-rose-300 hover:text-rose-900"
                  >
                    Open API Key Settings
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Natural Language Prompt Input */}
          <div>
            <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
              Describe what data you want in plain English:
            </label>
            <div className="relative">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="e.g. Find all customers with orders greater than 100 in the last 30 days..."
                rows={3}
                className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-xl p-3 text-xs text-[#1b202a] dark:text-[#edf0f6] placeholder-[#8c96a8] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans resize-none transition-all"
              />
              <button
                onClick={handleGenerate}
                disabled={!promptInput.trim() || isGenerating}
                className="absolute right-2.5 bottom-3.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-40 transition shadow-2xs"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate SQL</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-[#8c96a8]">
              <span>Tip: Press Ctrl + Enter to run</span>
              {selectedTable && (
                <span className="font-mono">
                  Context table: <span className="text-indigo-600 dark:text-indigo-400">{selectedTable}</span>
                </span>
              )}
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
            <div className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5" />
                    <span>Generated SQL Query</span>
                  </span>
                  {usedModel && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06] text-[#8c96a8] dark:text-[#636d80]">
                      {usedModel}
                    </span>
                  )}
                </div>
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

              {aiExplanation && (
                <p className="text-[11px] text-[#5f687a] dark:text-[#98a0af] italic px-1">
                  💡 {aiExplanation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between gap-2.5 bg-[#f8f9fb]/60 dark:bg-[#101319]/60 shrink-0">
          <div className="text-[11px] text-[#8c96a8] dark:text-[#636d80]">
            {apiKey ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Gemini API Key Configured
              </span>
            ) : (
              <span>No API Key configured</span>
            )}
          </div>

          <div className="flex items-center gap-2">
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
    </div>
  );
};
