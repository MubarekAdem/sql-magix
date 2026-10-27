import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { DatabaseSchema, TableInfo } from '@sql-magic/core';
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

export const ErDiagramModal: React.FC<ErDiagramModalProps> = ({
  schema,
  selectedTable,
  onSelectTable,
  onClose,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize automatic grid layout positions for tables
  useEffect(() => {
    if (!schema) return;
    const initialPos: Record<string, NodePosition> = {};
    const cols = 3;
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

  // Foreign key relationships to draw
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

  // Handle canvas background drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.er-table-node')) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    } else if (draggedNode && nodePositions[draggedNode]) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const newX = (e.clientX - rect.left - pan.x) / zoom;
      const newY = (e.clientY - rect.top - pan.y) / zoom;
      setNodePositions((prev) => ({
        ...prev,
        [draggedNode]: { x: Math.max(0, newX), y: Math.max(0, newY) },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
  };

  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.min(2.5, Math.max(0.4, prev * factor)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 50, y: 50 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col font-sans select-none">
      {/* Top Controls Toolbar */}
      <div className="h-14 px-6 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-white flex items-center gap-2">
              <span>Interactive Entity-Relationship (ER) Diagram</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                {schema?.tables.length || 0} Tables • {relationships.length} Relations
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400">
              Drag tables to rearrange • Drag canvas to pan • Scroll/zoom
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-zinc-800 rounded-lg bg-zinc-950 p-0.5">
            <button
              onClick={() => handleZoom(0.85)}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono text-zinc-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => handleZoom(1.15)}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 border-l border-zinc-800 ml-1 transition"
              title="Fit to View"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-hidden relative bg-zinc-950 cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div
          className="absolute inset-0 origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Relationship Connector Lines */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
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
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#818cf8" />
              </marker>
            </defs>
            {relationships.map((rel, idx) => {
              const srcPos = nodePositions[rel.fromTable];
              const dstPos = nodePositions[rel.toTable];
              if (!srcPos || !dstPos) return null;

              // Compute connection coordinates (card width ~ 240px)
              const cardWidth = 240;
              const x1 = srcPos.x + cardWidth;
              const y1 = srcPos.y + 45;
              const x2 = dstPos.x;
              const y2 = dstPos.y + 45;

              // Cubic bezier curve path
              const dx = Math.abs(x2 - x1) * 0.5;
              const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <g key={idx} className="group">
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#4338ca"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    markerEnd="url(#er-arrow)"
                    className="transition hover:stroke-indigo-400 hover:stroke-[3]"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    fill="#a5b4fc"
                    fontSize="10"
                    textAnchor="middle"
                    className="font-mono select-none"
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
                className={`er-table-node absolute w-60 rounded-xl bg-zinc-900 border shadow-xl z-10 cursor-move transition-shadow hover:shadow-2xl ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Table Header */}
                <div
                  onClick={() => {
                    onSelectTable(t);
                    onClose();
                  }}
                  className="p-3 bg-zinc-950/80 rounded-t-xl border-b border-zinc-800/80 flex items-center justify-between cursor-pointer hover:bg-zinc-800/40 transition"
                  title="Click to open this table in data grid"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TableIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-xs text-white truncate font-mono">
                      {t.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {t.columns.length} cols
                  </span>
                </div>

                {/* Columns List */}
                <div className="p-2 space-y-1 max-h-56 overflow-y-auto font-mono text-[11px]">
                  {t.columns.map((c) => {
                    const isFk = t.foreignKeys?.some((fk) => fk.column === c.name);
                    return (
                      <div
                        key={c.name}
                        className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-800/50"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {c.primaryKey && (
                            <span title="Primary Key">
                              <Key className="w-3 h-3 text-amber-400 shrink-0" />
                            </span>
                          )}
                          {isFk && !c.primaryKey && (
                            <span title="Foreign Key">
                              <ArrowRight className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                            </span>
                          )}
                          <span
                            className={`truncate ${
                              c.primaryKey
                                ? 'text-amber-300 font-bold'
                                : isFk
                                ? 'text-indigo-300'
                                : 'text-zinc-300'
                            }`}
                          >
                            {c.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500">{c.type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
