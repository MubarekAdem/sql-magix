import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { DatabaseSchema, TableInfo } from '@sql-magic/core';
import mermaid from 'mermaid';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  Key,
  Table as TableIcon,
  Layers,
  ArrowRight,
  Move,
  Code,
  Download,
  Copy,
  Check,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';

interface ErDiagramModalProps {
  schema: DatabaseSchema | null;
  selectedTable: TableInfo | null;
  onSelectTable: (table: TableInfo) => void;
  onClose: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

function sanitizeIdent(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeType(type: string): string {
  const clean = type.split('(')[0].replace(/[^a-zA-Z0-9_]/g, '').trim();
  return clean || 'TEXT';
}

function generateMermaidEr(schema: DatabaseSchema | null): string {
  if (!schema || schema.tables.length === 0) {
    return 'erDiagram\n    EMPTY_DATABASE';
  }

  const lines: string[] = ['erDiagram'];

  // 1. Foreign Key Relationships
  const relSet = new Set<string>();
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys || []) {
      if (schema.tables.some((t) => t.name === fk.referencedTable)) {
        const parent = sanitizeIdent(fk.referencedTable);
        const child = sanitizeIdent(table.name);
        const label = fk.column.replace(/["'`]/g, '');
        const relKey = `${parent}-${child}-${label}`;
        if (!relSet.has(relKey)) {
          relSet.add(relKey);
          lines.push(`    ${parent} ||--o{ ${child} : "${label}"`);
        }
      }
    }
  }

  // 2. Table Definitions with Columns & Types
  for (const table of schema.tables) {
    const tblName = sanitizeIdent(table.name);
    lines.push(`    ${tblName} {`);
    for (const col of table.columns) {
      const type = sanitizeType(col.type || 'TEXT');
      const name = sanitizeIdent(col.name);
      let modifier = '';
      if (col.primaryKey) modifier = ' PK';
      else if (table.foreignKeys?.some((fk) => fk.column === col.name)) modifier = ' FK';
      lines.push(`        ${type} ${name}${modifier}`);
    }
    lines.push(`    }`);
  }

  return lines.join('\n');
}

export const ErDiagramModal: React.FC<ErDiagramModalProps> = ({
  schema,
  selectedTable,
  onSelectTable,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'mermaid' | 'canvas' | 'code'>('mermaid');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mermaidRef = useRef<HTMLDivElement | null>(null);

  // Generate Mermaid Code from schema
  const mermaidCode = useMemo(() => generateMermaidEr(schema), [schema]);

  // Initial layout for Canvas view
  useEffect(() => {
    if (!schema) return;
    const initialPos: Record<string, NodePosition> = {};
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(schema.tables.length))));
    const xSpacing = 320;
    const ySpacing = 280;

    schema.tables.forEach((t, i) => {
      const colIdx = i % cols;
      const rowIdx = Math.floor(i / cols);
      initialPos[t.name] = {
        x: 60 + colIdx * xSpacing,
        y: 60 + rowIdx * ySpacing,
      };
    });
    setNodePositions(initialPos);
  }, [schema]);

  // Render Mermaid Diagram to SVG
  useEffect(() => {
    if (!mermaidCode || viewMode !== 'mermaid') return;

    let isMounted = true;
    const isDark = document.documentElement.classList.contains('dark');

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        er: {
          useMaxWidth: false,
          entityPadding: 16,
          fontSize: 12,
        },
        themeVariables: isDark
          ? {
              darkMode: true,
              background: 'transparent',
              primaryColor: '#1a1f2c',
              primaryTextColor: '#edf0f6',
              primaryBorderColor: '#363d4e',
              lineColor: '#6366f1',
              secondaryColor: '#161922',
              tertiaryColor: '#101319',
              fontFamily: 'monospace',
            }
          : {
              darkMode: false,
              background: 'transparent',
              primaryColor: '#ffffff',
              primaryTextColor: '#1b202a',
              primaryBorderColor: '#cbd5e1',
              lineColor: '#4f46e5',
              secondaryColor: '#f1f3f7',
              tertiaryColor: '#f8f9fb',
              fontFamily: 'monospace',
            },
      });

      const uniqueId = `mermaid-er-${Math.random().toString(36).slice(2, 9)}`;
      mermaid
        .render(uniqueId, mermaidCode)
        .then(({ svg }) => {
          if (isMounted) {
            setSvgHtml(svg);
            setRenderError(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setRenderError(err instanceof Error ? err.message : String(err));
          }
        });
    } catch (err: unknown) {
      if (isMounted) {
        setRenderError(err instanceof Error ? err.message : String(err));
      }
    }

    return () => {
      isMounted = false;
    };
  }, [mermaidCode, viewMode]);

  const relationships = useMemo(() => {
    if (!schema) return [];
    const rels: {
      fromTable: string;
      fromCol: string;
      toTable: string;
      toCol: string;
    }[] = [];

    for (const t of schema.tables) {
      for (const fk of t.foreignKeys || []) {
        if (schema.tables.some((target) => target.name === fk.referencedTable)) {
          rels.push({
            fromTable: t.name,
            fromCol: fk.column,
            toTable: fk.referencedTable,
            toCol: fk.referencedColumn,
          });
        }
      }
    }
    return rels;
  }, [schema]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.er-table-node') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
      return;
    }

    if (draggedNode && viewMode === 'canvas') {
      const currentPos = nodePositions[draggedNode] || { x: 0, y: 0 };
      setNodePositions((prev) => ({
        ...prev,
        [draggedNode]: {
          x: currentPos.x + e.movementX / zoom,
          y: currentPos.y + e.movementY / zoom,
        },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(2.5, Math.max(0.3, prev * factor)));
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(2.5, Math.max(0.3, prev * delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'database-er-diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fb] dark:bg-[#0f1218] flex flex-col font-sans select-none transition-colors duration-150">
      {/* Top Header Toolbar */}
      <div className="h-14 px-4 bg-white/90 dark:bg-[#141822]/95 backdrop-blur-md border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#1b202a] dark:text-white">
                Entity-Relationship Diagram
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                {schema?.tables.length || 0} tables • {relationships.length} relations
              </span>
            </div>
            <span className="text-xs text-[#5f687a] dark:text-[#98a0af]">
              Standard Crow&apos;s Foot relational schema visualization
            </span>
          </div>
        </div>

        {/* View Mode Switcher & Tools */}
        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40]">
            <button
              onClick={() => setViewMode('mermaid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                viewMode === 'mermaid'
                  ? 'bg-white dark:bg-[#222938] text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
              title="Mermaid standard graph ER view"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Mermaid ER</span>
            </button>

            <button
              onClick={() => setViewMode('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                viewMode === 'canvas'
                  ? 'bg-white dark:bg-[#222938] text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
              title="Interactive draggable table cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Table Cards</span>
            </button>

            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                viewMode === 'code'
                  ? 'bg-white dark:bg-[#222938] text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
              title="Raw Mermaid syntax"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Syntax</span>
            </button>
          </div>

          {/* Zoom Controls (only for visual diagrams) */}
          {viewMode !== 'code' && (
            <div className="flex items-center p-1 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40]">
              <button
                onClick={() => handleZoom(0.85)}
                className="p-1.5 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-white/[0.08] transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-mono text-[#5f687a] dark:text-[#98a0af]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => handleZoom(1.15)}
                className="p-1.5 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-white/[0.08] transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={resetView}
                className="p-1.5 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-white/[0.08] border-l border-[#e2e6ee] dark:border-[#262e40] ml-1 transition"
                title="Reset View"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Copy / Export Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition active:scale-[0.98]"
              title="Copy Mermaid code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            {viewMode === 'mermaid' && svgHtml && (
              <button
                onClick={handleDownloadSvg}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition active:scale-[0.98]"
                title="Download SVG vector file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export SVG</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] transition active:scale-[0.96]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'code' ? (
        <div className="flex-1 overflow-auto p-6 bg-[#0c0e14] text-[#edf0f6] font-mono text-xs">
          <div className="max-w-4xl mx-auto rounded-2xl bg-[#13161f] border border-[#222938] overflow-hidden shadow-xl">
            <div className="px-4 py-2.5 bg-[#171b26] border-b border-[#222938] flex items-center justify-between text-[11px] text-[#8c96a8]">
              <span>Mermaid ER Syntax (Gfm / Markdown Compatible)</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-4 overflow-x-auto leading-relaxed text-[#c4cad4] select-text">
              {mermaidCode}
            </pre>
          </div>
        </div>
      ) : viewMode === 'mermaid' ? (
        /* Mermaid SVG Viewport */
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="flex-1 overflow-hidden relative bg-[#f8f9fb] dark:bg-[#0c0e14] cursor-grab active:cursor-grabbing select-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(140, 150, 170, 0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {renderError && (
            <div className="absolute top-4 left-4 z-30 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 font-mono">
              Mermaid render notice: {renderError}
            </div>
          )}

          <div
            ref={mermaidRef}
            className="absolute origin-top-left transition-transform duration-75 p-8"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />

          {!svgHtml && !renderError && (
            <div className="h-full flex items-center justify-center text-xs text-[#8c96a8] font-mono">
              Generating relational diagram...
            </div>
          )}
        </div>
      ) : (
        /* Custom Table Cards Canvas Viewport */
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="flex-1 overflow-hidden relative bg-[#f8f9fb] dark:bg-[#0c0e14] cursor-grab active:cursor-grabbing select-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(140, 150, 170, 0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div
            className="absolute inset-0 origin-top-left transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {/* SVG Connector Lines */}
            <svg className="absolute inset-0 w-[6000px] h-[6000px] pointer-events-none z-0">
              <defs>
                <marker
                  id="er-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#6366f1" />
                </marker>
              </defs>
              {relationships.map((rel, idx) => {
                const srcPos = nodePositions[rel.fromTable];
                const dstPos = nodePositions[rel.toTable];
                if (!srcPos || !dstPos) return null;

                const cardWidth = 260;
                const x1 = srcPos.x + cardWidth;
                const y1 = srcPos.y + 45;
                const x2 = dstPos.x;
                const y2 = dstPos.y + 45;

                const dx = Math.abs(x2 - x1) * 0.5;
                const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                return (
                  <g key={idx} className="group">
                    <path
                      d={pathData}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      markerEnd="url(#er-arrow)"
                      className="transition hover:stroke-indigo-400 hover:stroke-[3]"
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 6}
                      fill="#6366f1"
                      fontSize="11"
                      textAnchor="middle"
                      className="font-mono select-none font-medium"
                    >
                      {rel.fromCol} ➜ {rel.toCol}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Table Cards */}
            {(schema?.tables || []).map((t) => {
              const pos = nodePositions[t.name] || { x: 50, y: 50 };
              const isSelected = selectedTable?.name === t.name;

              return (
                <div
                  key={t.name}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggedNode(t.name);
                  }}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                  }}
                  className={`er-table-node absolute w-64 rounded-2xl bg-white dark:bg-[#151922] border shadow-lg dark:shadow-none z-10 cursor-move transition-all duration-150 ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'border-[#e2e6ee] dark:border-[#222938] hover:border-indigo-400/60'
                  }`}
                >
                  {/* Table Header */}
                  <div
                    onClick={() => {
                      onSelectTable(t);
                      onClose();
                    }}
                    className="p-3 bg-[#f8f9fb] dark:bg-[#101319] rounded-t-2xl border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition"
                    title="Click to open this table in data grid"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <TableIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-xs text-[#1b202a] dark:text-white truncate font-mono">
                        {t.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8c96a8] font-mono">
                      {t.columns.length} cols
                    </span>
                  </div>

                  {/* Columns List */}
                  <div className="p-2 space-y-0.5 max-h-56 overflow-y-auto font-mono text-[11px]">
                    {t.columns.map((c) => {
                      const isFk = t.foreignKeys?.some((fk) => fk.column === c.name);
                      return (
                        <div
                          key={c.name}
                          className="flex items-center justify-between px-2.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {c.primaryKey && (
                              <span title="Primary Key">
                                <Key className="w-3 h-3 text-amber-500 shrink-0" />
                              </span>
                            )}
                            {isFk && !c.primaryKey && (
                              <span title="Foreign Key">
                                <ArrowRight className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                              </span>
                            )}
                            <span
                              className={`truncate ${
                                c.primaryKey
                                  ? 'text-amber-600 dark:text-amber-300 font-semibold'
                                  : isFk
                                  ? 'text-indigo-600 dark:text-indigo-300'
                                  : 'text-[#3f4756] dark:text-[#c4cad4]'
                              }`}
                            >
                              {c.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8c96a8]">{c.type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
