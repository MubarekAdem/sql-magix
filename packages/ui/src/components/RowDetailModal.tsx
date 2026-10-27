import React, { useState } from 'react';
import {
  X,
  FileCode,
  Image as ImageIcon,
  Binary,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface RowDetailModalProps {
  row: Record<string, unknown>;
  rowIndex: number;
  totalRows: number;
  tableName: string;
  onNextRow?: () => void;
  onPrevRow?: () => void;
  onClose: () => void;
}

export const RowDetailModal: React.FC<RowDetailModalProps> = ({
  row,
  rowIndex,
  totalRows,
  tableName,
  onNextRow,
  onPrevRow,
  onClose,
}) => {
  const [copiedCol, setCopiedCol] = useState<string | null>(null);

  const copyValue = (col: string, val: unknown) => {
    const text = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
    navigator.clipboard.writeText(text);
    setCopiedCol(col);
    setTimeout(() => setCopiedCol(null), 1500);
  };

  // Helper to test if a value is an image (data URI, base64 or buffer)
  const isImageValue = (val: unknown): boolean => {
    if (typeof val !== 'string') return false;
    return /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/i.test(val);
  };

  // Helper to format hex dump from byte array or string
  const renderHexDump = (val: unknown) => {
    let bytes: Uint8Array;
    if (val instanceof Uint8Array) {
      bytes = val;
    } else if (typeof val === 'string') {
      bytes = new TextEncoder().encode(val.substring(0, 128));
    } else {
      bytes = new Uint8Array([0x00]);
    }

    const lines: { offset: string; hex: string; ascii: string }[] = [];
    for (let i = 0; i < Math.min(bytes.length, 128); i += 16) {
      const slice = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(4, '0');
      const hex = Array.from(slice)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = Array.from(slice)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      lines.push({ offset, hex: hex.padEnd(48, ' '), ascii });
    }

    return (
      <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto space-y-0.5">
        {lines.map((l, idx) => (
          <div key={idx} className="flex gap-4">
            <span className="text-zinc-500">{l.offset}</span>
            <span className="text-indigo-300">{l.hex}</span>
            <span className="text-emerald-400">{l.ascii}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-white">Record Inspector</span>
              <span className="text-xs font-mono text-indigo-400">({tableName})</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-300">
              Row #{rowIndex + 1} of {totalRows}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Prev / Next record buttons */}
            <div className="flex items-center border border-zinc-800 rounded-lg bg-zinc-950">
              <button
                onClick={onPrevRow}
                disabled={!onPrevRow || rowIndex === 0}
                className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition"
                title="Previous Row"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onNextRow}
                disabled={!onNextRow || rowIndex >= totalRows - 1}
                className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 border-l border-zinc-800 transition"
                title="Next Row"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(row).map(([col, val]) => {
            const isNull = val === null || val === undefined;
            const isJson = typeof val === 'object' && val !== null;
            const isImage = isImageValue(val);
            const isBinary = val instanceof Uint8Array || (typeof val === 'string' && val.startsWith('BLOB('));

            return (
              <div
                key={col}
                className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200 font-mono">{col}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {isNull
                        ? 'NULL'
                        : isJson
                        ? 'JSON'
                        : isImage
                        ? 'IMAGE'
                        : isBinary
                        ? 'BLOB'
                        : typeof val}
                    </span>
                  </div>

                  <button
                    onClick={() => copyValue(col, val)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition flex items-center gap-1 text-[11px]"
                  >
                    {copiedCol === col ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Render Value according to type */}
                {isNull ? (
                  <div className="text-xs text-zinc-600 italic font-mono">NULL</div>
                ) : isImage ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded inline-block">
                      <img
                        src={val as string}
                        alt={col}
                        className="max-h-48 max-w-full rounded object-contain"
                      />
                    </div>
                  </div>
                ) : isBinary ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                      <Binary className="w-3 h-3" /> Hexadecimal Memory Dump
                    </div>
                    {renderHexDump(val)}
                  </div>
                ) : isJson ? (
                  <pre className="p-2.5 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono text-amber-300 max-h-48 overflow-auto leading-relaxed select-text">
                    {JSON.stringify(val, null, 2)}
                  </pre>
                ) : (
                  <div className="text-xs font-mono text-zinc-200 select-text break-words">
                    {String(val)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
