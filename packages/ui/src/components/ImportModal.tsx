import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import type { DatabaseSchema, Dialect } from '@sql-magic/core';
import { generateImportStatements, inferColumnType } from '@sql-magic/core';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  X,
  FileText,
  FileCode,
} from 'lucide-react';

interface ImportModalProps {
  schema: DatabaseSchema | null;
  dialect: Dialect;
  onExecuteImport: (createTableSql: string, insertSqls: string[]) => Promise<void>;
  onClose: () => void;
  isReadOnly?: boolean;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  schema,
  dialect,
  onExecuteImport,
  onClose,
  isReadOnly,
}) => {
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [tableName, setTableName] = useState<string>('imported_data');
  const [inferredCols, setInferredCols] = useState<{ name: string; type: string }[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
    setTableName(defaultName);

    const isJson = file.name.endsWith('.json');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        if (isJson) {
          const parsed = JSON.parse(text);
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          setupImportData(rows);
        } else {
          // CSV parsing via PapaParse
          Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data && results.data.length > 0) {
                setupImportData(results.data as Record<string, unknown>[]);
              }
            },
          });
        }
      } catch (err: unknown) {
        setErrorMessage(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    reader.readAsText(file);
  };

  const setupImportData = (rows: Record<string, unknown>[]) => {
    setParsedRows(rows);
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]);
      const inferred = cols.map((c) => {
        const values = rows.map((r) => r[c]);
        const inf = inferColumnType(values, dialect);
        return { name: c, type: inf.type };
      });
      setInferredCols(inferred);
    }
  };

  const handleExecute = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setErrorMessage(null);
    try {
      const { createTableSql, insertSqls } = generateImportStatements(
        tableName,
        parsedRows,
        dialect
      );
      await onExecuteImport(createTableSql, insertSqls);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-white">Import CSV / JSON</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Notice */}
        {isReadOnly && (
          <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Database is in Read-Only mode. Import requires write permission.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* File Upload Drop Area */}
          {parsedRows.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-zinc-950/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              <FileSpreadsheet className="w-10 h-10 text-zinc-500 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-200">
                Click or drop CSV / JSON file to import
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Column data types will be detected automatically
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">{fileName}</span>
                  <span className="text-xs text-zinc-500">
                    ({parsedRows.length} rows, {inferredCols.length} columns)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setParsedRows([]);
                    setFileName(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Change File
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Destination Table Name
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Inferred Columns */}
              <div>
                <span className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Detected Column Types
                </span>
                <div className="overflow-hidden border border-zinc-800 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400">
                      <tr>
                        <th className="px-3 py-2">Column</th>
                        <th className="px-3 py-2">Inferred Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-900/60">
                      {inferredCols.map((c, idx) => (
                        <tr key={c.name} className="hover:bg-zinc-900">
                          <td className="px-3 py-1.5 text-zinc-200">{c.name}</td>
                          <td className="px-3 py-1.5">
                            <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800 text-[11px]">
                              {c.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sample Data Preview */}
              <div>
                <span className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Preview (First 3 Rows)
                </span>
                <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400">
                      <tr>
                        {inferredCols.map((c) => (
                          <th key={c.name} className="px-3 py-1.5 border-r border-zinc-800">
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-900/40">
                      {parsedRows.slice(0, 3).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {inferredCols.map((c) => (
                            <td
                              key={c.name}
                              className="px-3 py-1 border-r border-zinc-800 text-zinc-300 whitespace-nowrap truncate max-w-xs"
                            >
                              {String((row as any)[c.name] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-mono">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-end gap-2 bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={parsedRows.length === 0 || isImporting || isReadOnly}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition shadow-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Importing...' : `Import ${parsedRows.length} Rows`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
