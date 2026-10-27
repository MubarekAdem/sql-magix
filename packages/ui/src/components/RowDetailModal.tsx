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

  const isImageValue = (val: unknown): boolean => {
    if (typeof val !== 'string') return false;
    return /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/i.test(val);
  };

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
      <div className="bg-white dark:bg-[#0c0e14] p-3 rounded-xl border border-[#e2e6ee] dark:border-[#222938] text-[11px] font-mono text-[#3f4756] dark:text-[#c4cad4] overflow-x-auto space-y-0.5">
        {lines.map((l, idx) => (
          <div key={idx} className="flex gap-4">
            <span className="text-[#8c96a8]">{l.offset}</span>
            <span className="text-indigo-600 dark:text-indigo-400">{l.hex}</span>
            <span className="text-emerald-600 dark:text-emerald-400">{l.ascii}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Record Inspector</span>
              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-medium">({tableName})</span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-[#eef1f6] dark:bg-[#1f2433] text-[#5f687a] dark:text-[#98a0af]">
              Row #{rowIndex + 1} of {totalRows.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Prev / Next record buttons */}
            <div className="flex items-center border border-[#e2e6ee] dark:border-[#262e40] rounded-lg bg-white dark:bg-[#161a24] overflow-hidden">
              <button
                onClick={onPrevRow}
                disabled={!onPrevRow || rowIndex === 0}
                className="p-1.5 px-2 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white disabled:opacity-30 transition"
                title="Previous Row"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onNextRow}
                disabled={!onNextRow || rowIndex >= totalRows - 1}
                className="p-1.5 px-2 text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white disabled:opacity-30 border-l border-[#e2e6ee] dark:border-[#262e40] transition"
                title="Next Row"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {Object.entries(row).map(([col, val]) => {
            const isNull = val === null || val === undefined;
            const isJson = typeof val === 'object' && val !== null;
            const isImage = isImageValue(val);
            const isBinary = val instanceof Uint8Array || (typeof val === 'string' && val.startsWith('BLOB('));

            return (
              <div
                key={col}
                className="p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1b202a] dark:text-[#edf0f6] font-mono">{col}</span>
                    <span className="text-[10px] text-[#8c96a8] font-mono uppercase">
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
                    className="p-1 rounded-md text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition flex items-center gap-1 text-xs"
                  >
                    {copiedCol === col ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Render Value according to type */}
                {isNull ? (
                  <div className="text-xs text-[#8c96a8] italic font-mono">NULL</div>
                ) : isImage ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-white dark:bg-[#0c0e14] border border-[#e2e6ee] dark:border-[#222938] rounded-lg inline-block">
                      <img
                        src={val as string}
                        alt="Blob preview"
                        className="max-h-48 rounded object-contain"
                      />
                    </div>
                  </div>
                ) : isBinary ? (
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#8c96a8] font-mono">Hex Dump Preview:</span>
                    {renderHexDump(val)}
                  </div>
                ) : isJson ? (
                  <pre className="p-3 bg-white dark:bg-[#0c0e14] border border-[#e2e6ee] dark:border-[#222938] rounded-xl text-xs font-mono text-indigo-600 dark:text-indigo-400 overflow-x-auto leading-relaxed">
                    {JSON.stringify(val, null, 2)}
                  </pre>
                ) : (
                  <pre className="p-3 bg-white dark:bg-[#0c0e14] border border-[#e2e6ee] dark:border-[#222938] rounded-xl text-xs font-mono text-[#1b202a] dark:text-[#edf0f6] whitespace-pre-wrap select-text leading-relaxed">
                    {String(val)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex justify-end bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
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
