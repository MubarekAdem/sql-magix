import React, { useState, useMemo } from 'react';
import type { ResultSet } from 'sql-magic-core';
import {
  X,
  BarChart,
  LineChart,
  PieChart,
  Download,
  ScatterChart,
  Layers,
} from 'lucide-react';

interface QuickChartModalProps {
  resultSet: ResultSet;
  onClose: () => void;
}

type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

// Robi's Low-Saturation Color Palette
const COLORS = [
  'hsl(224, 52%, 58%)', // Slate blue
  'hsl(152, 38%, 52%)', // Sage emerald
  'hsl(38, 48%, 52%)',  // Warm amber
  'hsl(330, 42%, 56%)', // Soft rose
  'hsl(260, 42%, 58%)', // Muted violet
  'hsl(190, 46%, 48%)', // Teal cyan
  'hsl(16, 52%, 56%)',  // Terracotta
  'hsl(205, 40%, 52%)', // Steel blue
];

export const QuickChartModal: React.FC<QuickChartModalProps> = ({ resultSet, onClose }) => {
  const columns = useMemo(() => resultSet.columns.map((c) => c.name), [resultSet.columns]);

  const numericCols = useMemo(() => {
    return resultSet.columns
      .filter((c) => {
        const sample = resultSet.rows.find((r) => r[c.name] !== null && r[c.name] !== undefined);
        return typeof sample?.[c.name] === 'number';
      })
      .map((c) => c.name);
  }, [resultSet]);

  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xAxisCol, setXAxisCol] = useState<string>(columns[0] || '');
  const [yAxisCol, setYAxisCol] = useState<string>(numericCols[0] || columns[1] || columns[0] || '');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: string; y: number; idx: number } | null>(null);

  const chartData = useMemo(() => {
    return resultSet.rows
      .slice(0, 30)
      .map((row) => ({
        label: String(row[xAxisCol] ?? 'null'),
        val: typeof row[yAxisCol] === 'number' ? row[yAxisCol] : Number(row[yAxisCol]) || 0,
      }));
  }, [resultSet.rows, xAxisCol, yAxisCol]);

  const maxY = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d) => d.val), 1);
  }, [chartData]);

  const svgWidth = 600;
  const svgHeight = 280;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <BarChart className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Query Visualizer</span>
              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#eef1f6] dark:bg-[#1f2433] text-[#5f687a] dark:text-[#98a0af]">
                {chartData.length} records plotted
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-3 bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Chart Type Selector with Concentric Radii */}
          <div className="flex items-center p-1 rounded-xl bg-[#eef1f6] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] gap-1">
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-150 ${
                chartType === 'bar' ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white font-medium shadow-2xs' : 'text-[#5f687a] dark:text-[#98a0af]'
              }`}
            >
              <BarChart className="w-3.5 h-3.5" />
              <span>Bar</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-150 ${
                chartType === 'line' ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white font-medium shadow-2xs' : 'text-[#5f687a] dark:text-[#98a0af]'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-150 ${
                chartType === 'pie' ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white font-medium shadow-2xs' : 'text-[#5f687a] dark:text-[#98a0af]'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Donut</span>
            </button>
            <button
              onClick={() => setChartType('scatter')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-150 ${
                chartType === 'scatter' ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white font-medium shadow-2xs' : 'text-[#5f687a] dark:text-[#98a0af]'
              }`}
            >
              <ScatterChart className="w-3.5 h-3.5" />
              <span>Scatter</span>
            </button>
          </div>

          {/* Axis Selectors */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[#5f687a] dark:text-[#98a0af] font-mono text-xs">X Axis:</span>
              <select
                value={xAxisCol}
                onChange={(e) => setXAxisCol(e.target.value)}
                className="bg-white dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-2.5 py-1 text-[#1b202a] dark:text-[#edf0f6] font-mono text-xs focus:outline-none"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#5f687a] dark:text-[#98a0af] font-mono text-xs">Y Axis:</span>
              <select
                value={yAxisCol}
                onChange={(e) => setYAxisCol(e.target.value)}
                className="bg-white dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-2.5 py-1 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-medium focus:outline-none"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center bg-[#f8f9fb] dark:bg-[#0c0e14] relative">
          {chartData.length === 0 ? (
            <div className="text-[#8c96a8] text-xs">No numeric data available to chart</div>
          ) : chartType === 'pie' ? (
            /* Pie / Donut Chart */
            <div className="flex flex-col md:flex-row items-center gap-8">
              <svg width="240" height="240" viewBox="-120 -120 240 240">
                {(() => {
                  const total = chartData.reduce((acc, d) => acc + Math.max(0, d.val), 0) || 1;
                  let cumAngle = 0;

                  return chartData.map((d, i) => {
                    const sliceAngle = (Math.max(0, d.val) / total) * 2 * Math.PI;
                    const startAngle = cumAngle;
                    const endAngle = cumAngle + sliceAngle;
                    cumAngle += sliceAngle;

                    const r1 = 50;
                    const r2 = 100;

                    const x1 = Math.cos(startAngle) * r2;
                    const y1 = Math.sin(startAngle) * r2;
                    const x2 = Math.cos(endAngle) * r2;
                    const y2 = Math.sin(endAngle) * r2;

                    const x3 = Math.cos(endAngle) * r1;
                    const y3 = Math.sin(endAngle) * r1;
                    const x4 = Math.cos(startAngle) * r1;
                    const y4 = Math.sin(startAngle) * r1;

                    const largeArc = sliceAngle > Math.PI ? 1 : 0;
                    const path = `M ${x1} ${y1} A ${r2} ${r2} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${largeArc} 0 ${x4} ${y4} Z`;

                    return (
                      <path
                        key={i}
                        d={path}
                        fill={COLORS[i % COLORS.length]}
                        stroke="rgba(0,0,0,0.2)"
                        strokeWidth="1.5"
                        className="transition-opacity hover:opacity-80 cursor-pointer"
                        onMouseEnter={() => setHoveredPoint({ x: d.label, y: d.val, idx: i })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  });
                })()}
              </svg>

              {/* Pie Legend */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto text-xs font-mono">
                {chartData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-md shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-[#3f4756] dark:text-[#c4cad4] truncate max-w-[140px]">{d.label}</span>
                    <span className="text-[#8c96a8] font-bold">{d.val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Bar, Line, or Scatter Chart */
            <div className="relative">
              <svg width={svgWidth} height={svgHeight} className="overflow-visible">
                {/* Y-axis gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y = padding.top + plotHeight * (1 - pct);
                  const valLabel = Math.round(maxY * pct);
                  return (
                    <g key={i}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        className="text-[#e2e6ee] dark:text-[#222938]"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 4}
                        fill="#8c96a8"
                        fontSize="10"
                        textAnchor="end"
                        className="font-mono select-none"
                      >
                        {valLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Bars */}
                {chartType === 'bar' &&
                  chartData.map((d, i) => {
                    const barWidth = Math.max(4, plotWidth / chartData.length - 8);
                    const x = padding.left + i * (plotWidth / chartData.length) + 4;
                    const h = (Math.max(0, d.val) / maxY) * plotHeight;
                    const y = padding.top + plotHeight - h;

                    return (
                      <rect
                        key={i}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(2, h)}
                        fill="hsl(224, 52%, 58%)"
                        rx="4"
                        className="transition-all hover:fill-indigo-400 cursor-pointer"
                        onMouseEnter={() => setHoveredPoint({ x: d.label, y: d.val, idx: i })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}

                {/* Line */}
                {chartType === 'line' && (
                  <>
                    <polyline
                      fill="none"
                      stroke="hsl(224, 52%, 58%)"
                      strokeWidth="2.5"
                      points={chartData
                        .map((d, i) => {
                          const x =
                            padding.left +
                            (i + 0.5) * (plotWidth / chartData.length);
                          const y = padding.top + plotHeight - (Math.max(0, d.val) / maxY) * plotHeight;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                    {chartData.map((d, i) => {
                      const x =
                        padding.left + (i + 0.5) * (plotWidth / chartData.length);
                      const y = padding.top + plotHeight - (Math.max(0, d.val) / maxY) * plotHeight;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#ffffff"
                          stroke="hsl(224, 52%, 58%)"
                          strokeWidth="2"
                          className="hover:r-6 cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ x: d.label, y: d.val, idx: i })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })}
                  </>
                )}

                {/* Scatter */}
                {chartType === 'scatter' &&
                  chartData.map((d, i) => {
                    const x =
                      padding.left + (i + 0.5) * (plotWidth / chartData.length);
                    const y = padding.top + plotHeight - (Math.max(0, d.val) / maxY) * plotHeight;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="5"
                        fill="hsl(152, 38%, 52%)"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="hover:scale-125 transition-transform cursor-pointer"
                        onMouseEnter={() => setHoveredPoint({ x: d.label, y: d.val, idx: i })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
              </svg>

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div className="absolute top-2 right-2 bg-white dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-xl px-3 py-1.5 text-xs font-mono shadow-lg pointer-events-none">
                  <div className="text-[#8c96a8] truncate max-w-[180px]">{hoveredPoint.x}</div>
                  <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {yAxisCol}: {hoveredPoint.y}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex items-center justify-end bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
