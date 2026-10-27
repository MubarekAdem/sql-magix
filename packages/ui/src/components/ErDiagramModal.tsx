import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type { DatabaseSchema, TableInfo } from '@sql-magic/core';
import mermaid from 'mermaid';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Key,
  Table as TableIcon,
  Layers,
  ArrowRight,
  Code,
  Download,
  Copy,
  Check,
  LayoutGrid,
  Sparkles,
  Search,
  RotateCcw,
  ExternalLink,
  Shuffle,
} from 'lucide-react';

interface ErDiagramModalProps {
  schema: DatabaseSchema | null;
  selectedTable: TableInfo | null;
  theme?: 'light' | 'dark';
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
    if (table.columns.length > 0) {
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
    } else {
      lines.push(`    ${tblName}`);
    }
  }

  return lines.join('\n');
}

export const ErDiagramModal: React.FC<ErDiagramModalProps> = ({
  schema,
  selectedTable,
  theme,
  onSelectTable,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'mermaid' | 'canvas' | 'code'>('mermaid');
  
  // Independent zoom & pan per visual viewport to prevent coordinate cross-contamination
  const [mermaidZoom, setMermaidZoom] = useState<number>(1);
  const [mermaidPan, setMermaidPan] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isMermaidPanning, setIsMermaidPanning] = useState<boolean>(false);
  const [startMermaidPan, setStartMermaidPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [canvasZoom, setCanvasZoom] = useState<number>(1);
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isCanvasPanning, setIsCanvasPanning] = useState<boolean>(false);
  const [startCanvasPan, setStartCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const mermaidContainerRef = useRef<HTMLDivElement | null>(null);
  const mermaidRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Generate Mermaid Code from schema
  const mermaidCode = useMemo(() => generateMermaidEr(schema), [schema]);

  // Foreign Key Relationships
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

  // Auto-arrange layout helper (topological / column arrangement)
  const calculateAutoLayout = useCallback(
    (tables: TableInfo[]): Record<string, NodePosition> => {
      const positions: Record<string, NodePosition> = {};
      if (tables.length === 0) return positions;

      const inDegree: Record<string, number> = {};
      const outDegree: Record<string, number> = {};

      tables.forEach((t) => {
        inDegree[t.name] = 0;
        outDegree[t.name] = t.foreignKeys?.length || 0;
      });

      tables.forEach((t) => {
        t.foreignKeys?.forEach((fk) => {
          if (inDegree[fk.referencedTable] !== undefined) {
            inDegree[fk.referencedTable]++;
          }
        });
      });

      const sorted = [...tables].sort((a, b) => {
        const diff = (inDegree[b.name] - outDegree[b.name]) - (inDegree[a.name] - outDegree[a.name]);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });

      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(tables.length))));
      const colWidth = 320;
      const rowHeight = 300;

      sorted.forEach((t, i) => {
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        positions[t.name] = {
          x: 60 + colIdx * colWidth,
          y: 60 + rowIdx * rowHeight,
        };
      });

      return positions;
    },
    []
  );

  // Initialize Canvas Positions
  useEffect(() => {
    if (!schema?.tables) return;
    setNodePositions(calculateAutoLayout(schema.tables));
  }, [schema, calculateAutoLayout]);

  // Determine active theme (prop or DOM attribute)
  const isDark = useMemo(() => {
    if (theme) return theme === 'dark';
    return document.documentElement.classList.contains('dark');
  }, [theme]);

  // Render Mermaid Diagram (runs once on load & theme change, cached for instant switching)
  useEffect(() => {
    if (!mermaidCode) return;

    let isMounted = true;

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        er: {
          useMaxWidth: false,
          entityPadding: 18,
          fontSize: 12,
        },
        themeVariables: isDark
          ? {
              darkMode: true,
              background: 'transparent',
              primaryColor: '#161a24',
              primaryTextColor: '#edf0f6',
              primaryBorderColor: '#2b3447',
              lineColor: '#818cf8',
              secondaryColor: '#101319',
              tertiaryColor: '#1a1f2c',
              mainBkg: '#161a24',
              nodeBorder: '#2b3447',
              textColor: '#98a0af',
              attributeBackgroundColorOdd: '#12151d',
              attributeBackgroundColorEven: '#171b26',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }
          : {
              darkMode: false,
              background: 'transparent',
              primaryColor: '#ffffff',
              primaryTextColor: '#1b202a',
              primaryBorderColor: '#d2d8e4',
              lineColor: '#4f46e5',
              secondaryColor: '#f1f3f7',
              tertiaryColor: '#f8f9fb',
              mainBkg: '#ffffff',
              nodeBorder: '#d2d8e4',
              textColor: '#475569',
              attributeBackgroundColorOdd: '#f8f9fb',
              attributeBackgroundColorEven: '#ffffff',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            },
      });

      const uniqueId = `mermaid-er-${Math.random().toString(36).slice(2, 9)}`;
      mermaid
        .render(uniqueId, mermaidCode)
        .then(({ svg }) => {
          if (isMounted) {
            const cleanSvg = svg.replace(/max-width:\s*[^;"]+;?/gi, '');
            setSvgHtml(cleanSvg);
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
  }, [mermaidCode, isDark]);

  // Mermaid Panning & Zoom Handlers
  const handleMermaidMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    setIsMermaidPanning(true);
    setStartMermaidPan({ x: e.clientX - mermaidPan.x, y: e.clientY - mermaidPan.y });
  };

  const handleMermaidMouseMove = (e: React.MouseEvent) => {
    if (isMermaidPanning) {
      setMermaidPan({ x: e.clientX - startMermaidPan.x, y: e.clientY - startMermaidPan.y });
    }
  };

  const handleMermaidMouseUp = () => {
    setIsMermaidPanning(false);
  };

  const handleMermaidWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setMermaidZoom((prev) => Math.min(2.5, Math.max(0.3, prev * factor)));
  };

  // Canvas Panning & Dragging Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.er-table-card') ||
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input')
    ) {
      return;
    }
    setIsCanvasPanning(true);
    setStartCanvasPan({ x: e.clientX - canvasPan.x, y: e.clientY - canvasPan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isCanvasPanning) {
      setCanvasPan({ x: e.clientX - startCanvasPan.x, y: e.clientY - startCanvasPan.y });
      return;
    }

    if (draggedNode && viewMode === 'canvas') {
      const currentPos = nodePositions[draggedNode] || { x: 0, y: 0 };
      setNodePositions((prev) => ({
        ...prev,
        [draggedNode]: {
          x: currentPos.x + e.movementX / canvasZoom,
          y: currentPos.y + e.movementY / canvasZoom,
        },
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsCanvasPanning(false);
    setDraggedNode(null);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setCanvasZoom((prev) => Math.min(2.5, Math.max(0.3, prev * factor)));
  };

  // Global Zoom & Reset dispatchers for the active view mode
  const currentZoom = viewMode === 'mermaid' ? mermaidZoom : canvasZoom;

  const handleZoom = (delta: number) => {
    if (viewMode === 'mermaid') {
      setMermaidZoom((prev) => Math.min(2.5, Math.max(0.3, prev * delta)));
    } else if (viewMode === 'canvas') {
      setCanvasZoom((prev) => Math.min(2.5, Math.max(0.3, prev * delta)));
    }
  };

  const handleResetView = () => {
    if (viewMode === 'mermaid') {
      setMermaidZoom(1);
      setMermaidPan({ x: 50, y: 50 });
    } else if (viewMode === 'canvas') {
      setCanvasZoom(1);
      setCanvasPan({ x: 50, y: 50 });
    }
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

  // Filter tables by search query
  const filteredTables = useMemo(() => {
    if (!schema?.tables) return [];
    if (!searchQuery.trim()) return schema.tables;
    const q = searchQuery.toLowerCase();
    return schema.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [schema, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-sans select-none animate-in fade-in duration-150">
      <div
        className={`bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'fixed inset-0 rounded-none border-none max-w-none max-h-none h-full w-full'
            : 'w-full max-w-7xl h-[88vh] rounded-2xl'
        }`}
      >
        {/* Modal Header with Centered, Mathematically-Locked Tab Switcher */}
        <div className="relative h-14 px-4 sm:px-5 border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between shrink-0 bg-white dark:bg-[#141822] z-20">
          {/* Left: Title & Entity Count Badge */}
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#1b202a] dark:text-white truncate max-w-[140px] sm:max-w-xs">
                  Entity-Relationship Diagram
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                  {schema?.tables.length || 0} tables • {relationships.length} relations
                </span>
              </div>
            </div>
          </div>

          {/* Center: Absolute Locked Tab Switcher (Never shifts or jumps on tab switch) */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center p-1 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] z-30 shadow-2xs">
            <button
              onClick={() => setViewMode('mermaid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                viewMode === 'mermaid'
                  ? 'bg-white dark:bg-[#222938] text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
              title="Mermaid standard relational diagram"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Mermaid ER</span>
            </button>

            <button
              onClick={() => setViewMode('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                viewMode === 'canvas'
                  ? 'bg-white dark:bg-[#222938] text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
              title="Interactive draggable relational cards"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" />
              <span>Table Cards</span>
            </button>

            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                viewMode === 'code'
                  ? 'bg-white dark:bg-[#222938] text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
              title="Raw Mermaid syntax"
            >
              <Code className="w-3.5 h-3.5 text-indigo-500" />
              <span>Syntax</span>
            </button>
          </div>

          {/* Right Action Tools: Stable layout with smooth transitions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Box (Visible in visual modes) */}
            {viewMode !== 'code' && (
              <div className="relative hidden lg:block">
                <Search className="w-3.5 h-3.5 text-[#8c96a8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Find table or column..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-[#f8f9fb] dark:bg-[#11141c] text-[#1b202a] dark:text-[#edf0f6] placeholder-[#8c96a8] focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-36 xl:w-44 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Auto Arrange (Canvas Mode) */}
            {viewMode === 'canvas' && (
              <button
                onClick={() => {
                  if (schema?.tables) {
                    setNodePositions(calculateAutoLayout(schema.tables));
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition active:scale-[0.98]"
                title="Arrange tables by dependency hierarchy"
              >
                <Shuffle className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden xl:inline">Auto Arrange</span>
              </button>
            )}

            {/* Zoom Controls (Mermaid & Canvas modes) */}
            {viewMode !== 'code' && (
              <div className="flex items-center p-1 rounded-xl bg-[#f1f3f7] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40]">
                <button
                  onClick={() => handleZoom(0.85)}
                  className="p-1.5 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-white/[0.08] transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-xs font-mono text-[#5f687a] dark:text-[#98a0af] min-w-[38px] text-center">
                  {Math.round(currentZoom * 100)}%
                </span>
                <button
                  onClick={() => handleZoom(1.15)}
                  className="p-1.5 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-white/[0.08] transition"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetView}
                  className="p-1.5 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-white/[0.08] border-l border-[#e2e6ee] dark:border-[#262e40] ml-1 transition"
                  title="Reset View"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Export SVG (Mermaid Mode) */}
            {viewMode === 'mermaid' && svgHtml && (
              <button
                onClick={handleDownloadSvg}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition active:scale-[0.98]"
                title="Download SVG vector file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Export SVG</span>
              </button>
            )}

            {/* Copy Mermaid Code */}
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white hover:bg-[#f1f3f7] dark:hover:bg-[#222938] transition active:scale-[0.98]"
              title="Copy Mermaid syntax"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold hidden sm:inline">
                    Copied!
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Code</span>
                </>
              )}
            </button>

            {/* Maximize / Restore Toggle */}
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition active:scale-[0.96]"
              title={isFullscreen ? 'Restore Modal' : 'Maximize Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition active:scale-[0.96]"
              title="Close Diagram (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Empty Database State */}
        {(!schema || schema.tables.length === 0) ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8f9fb] dark:bg-[#0c0e14]">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-[#1b202a] dark:text-white mb-1">
              No Tables in Database
            </h3>
            <p className="text-xs text-[#5f687a] dark:text-[#98a0af] max-w-sm mb-5 leading-relaxed">
              Create a new table using the Schema Designer or import tabular data from CSV/JSON to visualize relational entity relationships.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition active:scale-[0.98]"
            >
              Return to Studio
            </button>
          </div>
        ) : (
          /* Main Multi-Tab Viewport (Preserves DOM & coordinates with zero flash) */
          <div className="flex-1 relative overflow-hidden">
            {/* 1. Mermaid Standard Viewport */}
            <div
              ref={mermaidContainerRef}
              onMouseDown={handleMermaidMouseDown}
              onMouseMove={handleMermaidMouseMove}
              onMouseUp={handleMermaidMouseUp}
              onWheel={handleMermaidWheel}
              className={`absolute inset-0 overflow-hidden bg-[#f8f9fb] dark:bg-[#0c0e14] cursor-grab active:cursor-grabbing select-none ${
                viewMode === 'mermaid' ? 'block' : 'hidden'
              }`}
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(140, 150, 170, 0.15) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              {renderError && (
                <div className="absolute top-4 left-4 z-30 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 font-mono shadow-sm">
                  Mermaid render notice: {renderError}
                </div>
              )}

              <div
                ref={mermaidRef}
                className="mermaid-er-wrapper absolute origin-top-left transition-transform duration-75 p-12"
                style={{
                  transform: `translate(${mermaidPan.x}px, ${mermaidPan.y}px) scale(${mermaidZoom})`,
                }}
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />

              {!svgHtml && !renderError && (
                <div className="h-full flex items-center justify-center text-xs text-[#8c96a8] font-mono">
                  Generating relational Crow&apos;s Foot diagram...
                </div>
              )}
            </div>

            {/* 2. Interactive Table Cards Viewport */}
            <div
              ref={canvasContainerRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onWheel={handleCanvasWheel}
              className={`absolute inset-0 overflow-hidden bg-[#f8f9fb] dark:bg-[#0c0e14] cursor-grab active:cursor-grabbing select-none ${
                viewMode === 'canvas' ? 'block' : 'hidden'
              }`}
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(140, 150, 170, 0.15) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              <div
                className="absolute inset-0 origin-top-left transition-transform duration-75"
                style={{
                  transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                }}
              >
                {/* Dynamic Smart Bezier Connector Lines */}
                <svg className="absolute inset-0 w-[8000px] h-[8000px] pointer-events-none z-0">
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
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
                    </marker>
                  </defs>
                  {relationships.map((rel, idx) => {
                    const srcPos = nodePositions[rel.fromTable];
                    const dstPos = nodePositions[rel.toTable];
                    if (!srcPos || !dstPos) return null;

                    const cardWidth = 260;
                    let x1: number;
                    let y1: number;
                    let x2: number;
                    let y2: number;

                    if (srcPos.x + cardWidth < dstPos.x) {
                      x1 = srcPos.x + cardWidth;
                      y1 = srcPos.y + 45;
                      x2 = dstPos.x;
                      y2 = dstPos.y + 45;
                    } else if (dstPos.x + cardWidth < srcPos.x) {
                      x1 = srcPos.x;
                      y1 = srcPos.y + 45;
                      x2 = dstPos.x + cardWidth;
                      y2 = dstPos.y + 45;
                    } else {
                      x1 = srcPos.x + cardWidth / 2;
                      y1 = srcPos.y < dstPos.y ? srcPos.y + 120 : srcPos.y;
                      x2 = dstPos.x + cardWidth / 2;
                      y2 = srcPos.y < dstPos.y ? dstPos.y : dstPos.y + 120;
                    }

                    const dx = Math.abs(x2 - x1) * 0.5;
                    const pathData = `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${x2 + (x2 > x1 ? -dx : dx)} ${y2}, ${x2} ${y2}`;

                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const label = `${rel.fromCol} ➜ ${rel.toCol}`;
                    const labelWidth = Math.max(60, label.length * 6.5 + 16);

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
                        <rect
                          x={midX - labelWidth / 2}
                          y={midY - 9}
                          width={labelWidth}
                          height="18"
                          rx="5"
                          className="fill-white dark:fill-[#151922] stroke-[#e2e6ee] dark:stroke-[#262e40] stroke-1"
                        />
                        <text
                          x={midX}
                          y={midY + 3.5}
                          fill="#6366f1"
                          fontSize="10"
                          textAnchor="middle"
                          className="font-mono select-none font-medium"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Table Cards */}
                {(schema?.tables || []).map((t) => {
                  const pos = nodePositions[t.name] || { x: 50, y: 50 };
                  const isSelected = selectedTable?.name === t.name;
                  const isFiltered =
                    searchQuery.trim() !== '' &&
                    !filteredTables.some((ft) => ft.name === t.name);

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
                      className={`er-table-card absolute w-64 rounded-2xl bg-white dark:bg-[#151922] border z-10 cursor-move transition-all duration-150 ${
                        isFiltered ? 'opacity-25 grayscale pointer-events-none' : 'opacity-100'
                      } ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                          : 'border-[#e2e6ee] dark:border-[#222938] hover:border-indigo-400/60 shadow-xs dark:shadow-none'
                      }`}
                    >
                      {/* Table Header */}
                      <div className="p-3 bg-[#f8f9fb] dark:bg-[#101319] rounded-t-2xl border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <TableIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-semibold text-xs text-[#1b202a] dark:text-white truncate font-mono">
                            {t.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-[#8c96a8] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                            {t.columns.length} cols
                          </span>
                          <button
                            onClick={() => {
                              onSelectTable(t);
                              onClose();
                            }}
                            className="p-1 rounded-md text-[#8c96a8] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/5 dark:hover:bg-white/5 transition"
                            title="Open table in data grid"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
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
                                  <span
                                    title="Primary Key"
                                    className="w-4 h-4 rounded flex items-center justify-center bg-amber-500/10 text-amber-500 shrink-0"
                                  >
                                    <Key className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                {isFk && !c.primaryKey && (
                                  <span
                                    title="Foreign Key"
                                    className="w-4 h-4 rounded flex items-center justify-center bg-indigo-500/10 text-indigo-500 shrink-0"
                                  >
                                    <ArrowRight className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                <span
                                  className={`truncate ${
                                    c.primaryKey
                                      ? 'text-amber-600 dark:text-amber-300 font-semibold'
                                      : isFk
                                      ? 'text-indigo-600 dark:text-indigo-300 font-medium'
                                      : 'text-[#3f4756] dark:text-[#c4cad4]'
                                  }`}
                                >
                                  {c.name}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#8c96a8] shrink-0 ml-2">
                                {c.type}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Syntax Code Viewport (Consistent Light/Dark Theme matching UI) */}
            <div
              className={`absolute inset-0 overflow-auto p-4 sm:p-6 bg-[#f8f9fb] dark:bg-[#0c0e14] ${
                viewMode === 'code' ? 'block' : 'hidden'
              }`}
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(140, 150, 170, 0.15) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              <div className="max-w-4xl mx-auto rounded-2xl bg-white dark:bg-[#13161f] border border-[#e2e6ee] dark:border-[#222938] overflow-hidden shadow-xl">
                <div className="px-4 py-3 bg-[#f1f3f7] dark:bg-[#171b26] border-b border-[#e2e6ee] dark:border-[#222938] flex items-center justify-between text-[11px] text-[#5f687a] dark:text-[#8c96a8]">
                  <span className="font-medium font-sans">
                    Mermaid ER Syntax (GitHub Markdown Compatible)
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#222938] border border-[#e2e6ee] dark:border-[#262e40] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-sans font-medium transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
                <div className="p-4 overflow-x-auto text-xs font-mono leading-relaxed select-text text-[#1b202a] dark:text-[#c4cad4] divide-y divide-transparent">
                  {mermaidCode.split('\n').map((line, idx) => (
                    <div key={idx} className="flex gap-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] py-0.5">
                      <span className="w-8 select-none text-right text-[10px] text-[#8c96a8] font-mono opacity-60">
                        {idx + 1}
                      </span>
                      <span className="flex-1 whitespace-pre">
                        {line.startsWith('erDiagram') ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">{line}</span>
                        ) : line.includes('||--o{') ? (
                          <span className="text-[#0369a1] dark:text-sky-400 font-medium">{line}</span>
                        ) : line.includes('PK') ? (
                          <span>
                            {line.replace('PK', '')}
                            <span className="text-amber-600 dark:text-amber-400 font-bold">PK</span>
                          </span>
                        ) : line.includes('FK') ? (
                          <span>
                            {line.replace('FK', '')}
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">FK</span>
                          </span>
                        ) : (
                          line
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
