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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] font-sans transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Import CSV / JSON</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Notice */}
        {isReadOnly && (
          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Database connection is in Read-Only mode. Import requires write permission.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File Upload Drop Area */}
          {parsedRows.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#ccd2df] dark:border-[#262e40] hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition bg-[#f8f9fb] dark:bg-[#101319]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-500 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#1b202a] dark:text-white">
                Click or drop CSV / JSON file to import
              </h3>
              <p className="text-xs text-[#8c96a8] mt-1">
                Column data types will be automatically inferred
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-[#1b202a] dark:text-white font-mono">{fileName}</span>
                  <span className="text-xs text-[#8c96a8]">
                    ({parsedRows.length.toLocaleString()} rows, {inferredCols.length} columns)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setParsedRows([]);
                    setFileName(null);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Change File
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Destination Table Name
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              {/* Inferred Columns */}
              <div>
                <span className="block text-xs font-semibold text-[#1b202a] dark:text-white mb-2">
                  Detected Column Types
                </span>
                <div className="rounded-xl overflow-hidden border border-[#e2e6ee] dark:border-[#222938]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938] text-[#5f687a] dark:text-[#98a0af]">
                      <tr>
                        <th className="px-3.5 py-2 font-medium">Column Name</th>
                        <th className="px-3.5 py-2 font-medium">Inferred Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938] bg-white dark:bg-[#151922]">
                      {inferredCols.map((c) => (
                        <tr key={c.name} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <td className="px-3.5 py-2 font-semibold text-[#1b202a] dark:text-[#edf0f6]">{c.name}</td>
                          <td className="px-3.5 py-2 text-indigo-600 dark:text-indigo-400 font-medium">{c.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview First 3 Rows */}
              <div>
                <span className="block text-xs font-semibold text-[#1b202a] dark:text-white mb-2">
                  Sample Data Preview
                </span>
                <div className="rounded-xl overflow-x-auto border border-[#e2e6ee] dark:border-[#222938]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938] text-[#8c96a8]">
                      <tr>
                        {inferredCols.map((c) => (
                          <th key={c.name} className="px-3 py-2 font-medium">
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938] bg-white dark:bg-[#151922]">
                      {parsedRows.slice(0, 3).map((r, i) => (
                        <tr key={i}>
                          {inferredCols.map((c) => (
                            <td key={c.name} className="px-3 py-1.5 truncate max-w-xs text-[#3f4756] dark:text-[#c4cad4]">
                              {String(r[c.name] ?? 'null')}
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
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 font-mono">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#e2e6ee] dark:border-[#222938] flex items-center justify-end gap-2.5 bg-[#f8f9fb]/60 dark:bg-[#101319]/60">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={parsedRows.length === 0 || isImporting || isReadOnly}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-50 transition shadow-2xs"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Importing...' : `Import ${parsedRows.length} Rows`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
