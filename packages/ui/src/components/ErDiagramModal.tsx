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
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 60 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});

  const containerRef = useRef<HTMLDivElement | null>(null);

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
    if ((e.target as HTMLElement).closest('.er-table-node')) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
      return;
    }

    if (draggedNode) {
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

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(2.5, Math.max(0.3, prev * delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 60, y: 60 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fb] dark:bg-[#0f1218] flex flex-col font-sans select-none transition-colors duration-150">
      {/* Top Header Toolbar */}
      <div className="h-14 px-4 bg-white/90 dark:bg-[#141822]/95 backdrop-blur-md border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1b202a] dark:text-white">
              Entity-Relationship Diagram
            </h2>
            <span className="text-xs text-[#5f687a] dark:text-[#98a0af]">
              {schema?.tables.length || 0} tables • {relationships.length} relations
            </span>
          </div>
        </div>

        {/* Viewport & Zoom Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40]">
            <button
              onClick={() => handleZoom(0.85)}
              className="p-1.5 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-white/[0.08] transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-mono text-[#5f687a] dark:text-[#98a0af]">
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
              title="Fit to View"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] transition active:scale-[0.96]"
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
        className="flex-1 overflow-hidden relative bg-[#f8f9fb] dark:bg-[#0c0e14] cursor-grab active:cursor-grabbing"
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

          {/* Table Cards with Concentric Radius */}
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
    </div>
  );
};
