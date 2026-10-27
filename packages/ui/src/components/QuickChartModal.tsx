import React, { useState, useMemo } from 'react';
import type { ResultSet } from '@sql-magic/core';
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

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
];

export const QuickChartModal: React.FC<QuickChartModalProps> = ({ resultSet, onClose }) => {
  const columns = useMemo(() => resultSet.columns.map((c) => c.name), [resultSet.columns]);

  // Find likely default numeric & category columns
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

  // Parse chart data
  const chartData = useMemo(() => {
    return resultSet.rows
      .slice(0, 30) // top 30 rows for chart clarity
      .map((row) => ({
        label: String(row[xAxisCol] ?? 'null'),
        val: typeof row[yAxisCol] === 'number' ? row[yAxisCol] : Number(row[yAxisCol]) || 0,
      }));
  }, [resultSet.rows, xAxisCol, yAxisCol]);

  const maxY = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d) => d.val), 1);
  }, [chartData]);

  // Dimensions
  const svgWidth = 600;
  const svgHeight = 280;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BarChart className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm text-white">Quick Results Visualizer</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {chartData.length} records plotted
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-3 bg-zinc-950/70 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Chart Type Selector */}
          <div className="flex items-center gap-1 border border-zinc-800 rounded-lg p-0.5 bg-zinc-900">
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
                chartType === 'bar' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart className="w-3.5 h-3.5" />
              <span>Bar</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
                chartType === 'line' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
                chartType === 'pie' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Pie / Donut</span>
            </button>
            <button
              onClick={() => setChartType('scatter')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
                chartType === 'scatter' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ScatterChart className="w-3.5 h-3.5" />
              <span>Scatter</span>
            </button>
          </div>

          {/* Axis Selectors */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-mono text-[11px]">X:</span>
              <select
                value={xAxisCol}
                onChange={(e) => setXAxisCol(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-mono text-[11px]">Y:</span>
              <select
                value={yAxisCol}
                onChange={(e) => setYAxisCol(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
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
        <div className="p-6 flex-1 flex flex-col items-center justify-center bg-zinc-950 relative">
          {chartData.length === 0 ? (
            <div className="text-zinc-500 text-xs">No numeric data available to chart</div>
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

                    const r1 = 50; // donut inner radius
                    const r2 = 100; // donut outer radius

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
                        stroke="#09090b"
                        strokeWidth="2"
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
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-zinc-300 truncate max-w-[150px]">{d.label}:</span>
                    <span className="text-white font-bold">{d.val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Cartesian Chart (Bar, Line, Scatter) */
            <div className="relative w-full max-w-2xl">
              <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                {/* Horizontal Grid Lines & Y-axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = padding.top + plotHeight * (1 - ratio);
                  const labelVal = Math.round(maxY * ratio);
                  return (
                    <g key={i}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="#27272a"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 4}
                        fill="#71717a"
                        fontSize="10"
                        textAnchor="end"
                        className="font-mono"
                      >
                        {labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Plot Area */}
                {chartType === 'bar' &&
                  chartData.map((d, i) => {
                    const step = plotWidth / chartData.length;
                    const barWidth = Math.max(4, step * 0.7);
                    const barHeight = Math.max(2, (d.val / maxY) * plotHeight);
                    const x = padding.left + i * step + (step - barWidth) / 2;
                    const y = padding.top + plotHeight - barHeight;

                    return (
                      <g key={i}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          fill={COLORS[i % COLORS.length]}
                          rx="2"
                          className="transition-all hover:opacity-80 cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ x: d.label, y: d.val, idx: i })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      </g>
                    );
                  })}

                {chartType === 'line' && (
                  <>
                    {/* Polyline path */}
                    <path
                      d={chartData
                        .map((d, i) => {
                          const x = padding.left + (i / Math.max(1, chartData.length - 1)) * plotWidth;
                          const y = padding.top + plotHeight - (d.val / maxY) * plotHeight;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="3"
                    />

                    {/* Data Points */}
                    {chartData.map((d, i) => {
                      const x = padding.left + (i / Math.max(1, chartData.length - 1)) * plotWidth;
                      const y = padding.top + plotHeight - (d.val / maxY) * plotHeight;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#4f46e5"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="hover:r-6 cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ x: d.label, y: d.val, idx: i })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })}
                  </>
                )}

                {chartType === 'scatter' &&
                  chartData.map((d, i) => {
                    const x = padding.left + (i / Math.max(1, chartData.length - 1)) * plotWidth;
                    const y = padding.top + plotHeight - (d.val / maxY) * plotHeight;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="5"
                        fill="#10b981"
                        stroke="#064e3b"
                        strokeWidth="1"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint({ x: d.label, y: d.val, idx: i })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}

                {/* X-axis labels (subsample if many) */}
                {chartData.map((d, i) => {
                  if (chartData.length > 12 && i % Math.ceil(chartData.length / 8) !== 0) return null;
                  const x =
                    chartType === 'bar'
                      ? padding.left + i * (plotWidth / chartData.length) + (plotWidth / chartData.length) / 2
                      : padding.left + (i / Math.max(1, chartData.length - 1)) * plotWidth;

                  return (
                    <text
                      key={i}
                      x={x}
                      y={svgHeight - padding.bottom + 18}
                      fill="#a1a1aa"
                      fontSize="10"
                      textAnchor="middle"
                      className="font-mono truncate"
                    >
                      {d.label.length > 8 ? `${d.label.substring(0, 7)}…` : d.label}
                    </text>
                  );
                })}
              </svg>

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div className="absolute top-2 right-4 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white shadow-xl pointer-events-none font-mono">
                  <div className="text-zinc-400">{hoveredPoint.x}</div>
                  <div className="font-bold text-indigo-400">{hoveredPoint.y}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          >
            Close Chart
          </button>
        </div>
      </div>
    </div>
  );
};
