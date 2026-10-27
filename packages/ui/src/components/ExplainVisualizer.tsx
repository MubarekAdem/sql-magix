import React, { useMemo } from 'react';
import type { Plan, Dialect } from '@sql-magic/core';
import { analyzePlanForMissingIndexes, type IndexRecommendation } from '@sql-magic/core';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Zap,
  ArrowRight,
  PlusCircle,
  Copy,
  Check,
  Search,
} from 'lucide-react';

interface ExplainVisualizerProps {
  plan: Plan;
  dialect: Dialect;
  querySql?: string;
  onExecuteCreateIndex?: (sql: string) => Promise<void>;
}

export const ExplainVisualizer: React.FC<ExplainVisualizerProps> = ({
  plan,
  dialect,
  querySql,
  onExecuteCreateIndex,
}) => {
  const [copiedSql, setCopiedSql] = React.useState<string | null>(null);
  const [isApplying, setIsApplying] = React.useState<boolean>(false);

  // Recommendations for missing indexes
  const recommendations: IndexRecommendation[] = useMemo(() => {
    return analyzePlanForMissingIndexes(plan, dialect, querySql);
  }, [plan, dialect, querySql]);

  // Breakdown lines of execution plan
  const planLines = useMemo(() => {
    if (!plan.text) return [];
    return plan.text.split('\n').filter((l) => l.trim().length > 0);
  }, [plan.text]);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(sql);
    setTimeout(() => setCopiedSql(null), 1500);
  };

  const handleApplyIndex = async (sql: string) => {
    if (!onExecuteCreateIndex) return;
    setIsApplying(true);
    try {
      await onExecuteCreateIndex(sql);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 max-w-4xl space-y-6 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Execution Plan & Index Advisor</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">
            {dialect}
          </span>
        </div>
      </div>

      {/* Index Advisor Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Missing Index Suggestions ({recommendations.length})</span>
          </div>

          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3 bg-zinc-950/80 border border-amber-800/40 rounded-lg space-y-2 text-xs"
              >
                <div className="text-zinc-300 font-sans">{rec.reason}</div>
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 font-mono text-[11px] text-emerald-400">
                  <span className="truncate mr-2">{rec.createIndexSql}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(rec.createIndexSql)}
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                      title="Copy SQL"
                    >
                      {copiedSql === rec.createIndexSql ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {onExecuteCreateIndex && (
                      <button
                        onClick={() => handleApplyIndex(rec.createIndexSql)}
                        disabled={isApplying}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs transition disabled:opacity-50"
                      >
                        <PlusCircle className="w-3 h-3" />
                        <span>Apply Index</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphical Step Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Query Execution Hierarchy
        </h4>

        <div className="space-y-2 font-mono text-xs">
          {planLines.map((line, idx) => {
            const isTableScan = /SCAN\s+(TABLE)?|Seq Scan|type:\s*ALL/i.test(line);
            const isIndexSearch = /USING\s+(COVERING\s+)?INDEX|Index Scan|Bitmap Index/i.test(line);

            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex items-center justify-between transition ${
                  isTableScan
                    ? 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                    : isIndexSearch
                    ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-zinc-600 select-none text-[10px] w-5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">{line}</span>
                </div>

                <div className="shrink-0 ml-3">
                  {isTableScan && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-700">
                      Sequential Scan
                    </span>
                  )}
                  {isIndexSearch && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">
                      Index Lookup
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw Output Block */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Raw Optimizer Output
        </h4>
        <pre className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
          {plan.text}
        </pre>
      </div>
    </div>
  );
};
