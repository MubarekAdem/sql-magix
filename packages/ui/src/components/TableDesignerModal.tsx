import React, { useState } from 'react';
import type { DatabaseSchema, Dialect } from '@sql-magic/core';
import {
  generateCreateTableSql,
  generateCreateIndexSql,
  generateDropTableSql,
  generateDropIndexSql,
  generateAddColumnSql,
  generateDropColumnSql,
  generateRenameTableSql,
  type TableDefinition,
  type ColumnDefinition,
  type IndexDefinition,
} from '@sql-magic/core';
import {
  Table,
  Plus,
  Trash2,
  Key,
  X,
  FileCode,
  Zap,
  CheckCircle,
  AlertTriangle,
  Edit3,
} from 'lucide-react';

interface TableDesignerModalProps {
  schema: DatabaseSchema | null;
  dialect: Dialect;
  onExecuteDdl: (sql: string) => Promise<void>;
  onClose: () => void;
  isReadOnly?: boolean;
  initialMode?: 'table' | 'index' | 'alter' | 'drop';
  initialTable?: string;
}

const COMMON_TYPES = [
  'INTEGER',
  'TEXT',
  'REAL',
  'BOOLEAN',
  'TIMESTAMP',
  'BLOB',
  'VARCHAR(255)',
  'JSON',
];

export const TableDesignerModal: React.FC<TableDesignerModalProps> = ({
  schema,
  dialect,
  onExecuteDdl,
  onClose,
  isReadOnly,
  initialMode = 'table',
  initialTable,
}) => {
  const [designerMode, setDesignerMode] = useState<'table' | 'index' | 'alter' | 'drop'>(initialMode);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Table Designer State
  const [tableName, setTableName] = useState<string>('new_table');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true, nullable: false },
    { name: 'title', type: 'TEXT', nullable: false },
    { name: 'created_at', type: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP' },
  ]);

  // Index Designer State
  const [indexName, setIndexName] = useState<string>('idx_custom');
  const [selectedTable, setSelectedTable] = useState<string>(
    initialTable || schema?.tables[0]?.name || ''
  );
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [isUniqueIndex, setIsUniqueIndex] = useState<boolean>(false);

  // Alter Table State
  const [alterAction, setAlterAction] = useState<'add_col' | 'drop_col' | 'rename'>('add_col');
  const [alterNewCol, setAlterNewCol] = useState<ColumnDefinition>({
    name: 'new_column',
    type: 'TEXT',
    nullable: true,
  });
  const [alterDropCol, setAlterDropCol] = useState<string>('');
  const [alterRenameTable, setAlterRenameTable] = useState<string>('');

  // Drop State
  const [dropTargetType, setDropTargetType] = useState<'table' | 'index'>('table');
  const [dropIndexName, setDropIndexName] = useState<string>('');
  const [dropConfirmText, setDropConfirmText] = useState<string>('');

  // Current selected table metadata
  const currentTableObj = schema?.tables.find((t) => t.name === selectedTable);

  // Auto-generate SQL based on mode
  let activeSql = '';
  switch (designerMode) {
    case 'table':
      activeSql = generateCreateTableSql(
        {
          name: tableName.trim() || 'unnamed_table',
          columns,
        },
        dialect
      );
      break;

    case 'index':
      activeSql =
        selectedTable && selectedCols.length > 0
          ? generateCreateIndexSql(
              {
                name: indexName.trim() || 'idx_unnamed',
                table: selectedTable,
                columns: selectedCols,
                unique: isUniqueIndex,
              },
              dialect
            )
          : '-- Select at least one column for the index';
      break;

    case 'alter':
      if (alterAction === 'add_col') {
        activeSql = generateAddColumnSql(selectedTable, alterNewCol, dialect);
      } else if (alterAction === 'drop_col') {
        const colToDrop = alterDropCol || currentTableObj?.columns[0]?.name || 'column_name';
        activeSql = generateDropColumnSql(selectedTable, colToDrop, dialect);
      } else {
        activeSql = generateRenameTableSql(
          selectedTable,
          alterRenameTable.trim() || `${selectedTable}_renamed`,
          dialect
        );
      }
      break;

    case 'drop':
      if (dropTargetType === 'table') {
        activeSql = generateDropTableSql(selectedTable, dialect);
      } else {
        const idx = dropIndexName || currentTableObj?.indexes?.[0]?.name || 'idx_name';
        activeSql = generateDropIndexSql(idx, selectedTable, dialect);
      }
      break;
  }

  const handleAddColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        name: `column_${prev.length + 1}`,
        type: 'TEXT',
        nullable: true,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, key: keyof ColumnDefinition, val: any) => {
    setColumns((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: val } : c))
    );
  };

  const handleExecute = async () => {
    if (designerMode === 'drop' && dropConfirmText.trim() !== selectedTable) {
      setErrorMessage(`Please type "${selectedTable}" to confirm dropping.`);
      return;
    }

    setIsExecuting(true);
    setErrorMessage(null);
    try {
      await onExecuteDdl(activeSql);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm text-white">Visual Schema Designer</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 font-mono">
              {dialect}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Warning if restricted */}
        {isReadOnly && (
          <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Server is in Read-Only mode. Writing DDL requires --allow-write.</span>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex items-center px-4 bg-zinc-950 border-b border-zinc-800">
          <button
            onClick={() => setDesignerMode('table')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
              designerMode === 'table'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            New Table
          </button>
          <button
            onClick={() => setDesignerMode('index')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
              designerMode === 'index'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            New Index
          </button>
          <button
            onClick={() => setDesignerMode('alter')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
              designerMode === 'alter'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Alter Table
          </button>
          <button
            onClick={() => setDesignerMode('drop')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
              designerMode === 'drop'
                ? 'border-rose-500 text-rose-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Drop Schema Object
          </button>
        </div>

        {/* Designer Viewport */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* NEW TABLE */}
          {designerMode === 'table' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Table Name
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g. customers, orders"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Columns Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-300">Columns</span>
                  <button
                    onClick={handleAddColumn}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 py-1 px-2 rounded hover:bg-zinc-800 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Column</span>
                  </button>
                </div>

                <div className="overflow-hidden border border-zinc-800 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400">
                      <tr>
                        <th className="px-2 py-1.5">Name</th>
                        <th className="px-2 py-1.5">Type</th>
                        <th className="px-2 py-1.5 text-center">PK</th>
                        <th className="px-2 py-1.5 text-center">Auto</th>
                        <th className="px-2 py-1.5 text-center">Nullable</th>
                        <th className="px-2 py-1.5">Default</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-900/60">
                      {columns.map((col, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900">
                          <td className="p-1">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => handleColumnChange(idx, 'name', e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-zinc-200 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            <select
                              value={col.type}
                              onChange={(e) => handleColumnChange(idx, 'type', e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-indigo-300 text-xs"
                            >
                              {COMMON_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="checkbox"
                              checked={!!col.primaryKey}
                              onChange={(e) => handleColumnChange(idx, 'primaryKey', e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="checkbox"
                              checked={!!col.autoIncrement}
                              onChange={(e) => handleColumnChange(idx, 'autoIncrement', e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="checkbox"
                              checked={col.nullable !== false}
                              onChange={(e) => handleColumnChange(idx, 'nullable', e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              placeholder="e.g. 0, NULL"
                              value={col.defaultValue || ''}
                              onChange={(e) => handleColumnChange(idx, 'defaultValue', e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-zinc-300 text-xs"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <button
                              onClick={() => handleRemoveColumn(idx)}
                              disabled={columns.length <= 1}
                              className="p-1 text-zinc-500 hover:text-rose-400 disabled:opacity-30 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* NEW INDEX */}
          {designerMode === 'index' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target Table
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setSelectedCols([]);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                >
                  {schema?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Index Name
                </label>
                <input
                  type="text"
                  value={indexName}
                  onChange={(e) => setIndexName(e.target.value)}
                  placeholder="idx_table_col"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {currentTableObj && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Select Columns for Index
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg max-h-36 overflow-y-auto">
                    {currentTableObj.columns.map((col) => {
                      const isChecked = selectedCols.includes(col.name);
                      return (
                        <label
                          key={col.name}
                          className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCols((prev) => [...prev, col.name]);
                              } else {
                                setSelectedCols((prev) => prev.filter((c) => c !== col.name));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-0"
                          />
                          <span className="font-mono">{col.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="unique-idx"
                  checked={isUniqueIndex}
                  onChange={(e) => setIsUniqueIndex(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <label htmlFor="unique-idx" className="text-xs text-zinc-300 cursor-pointer">
                  Unique Index (enforces uniqueness constraint)
                </label>
              </div>
            </div>
          )}

          {/* ALTER TABLE */}
          {designerMode === 'alter' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target Table
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                >
                  {schema?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                {(['add_col', 'drop_col', 'rename'] as const).map((act) => (
                  <button
                    key={act}
                    onClick={() => setAlterAction(act)}
                    className={`px-3 py-1 text-xs rounded border transition capitalize ${
                      alterAction === act
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {act.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {alterAction === 'add_col' && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      New Column Name
                    </label>
                    <input
                      type="text"
                      value={alterNewCol.name}
                      onChange={(e) => setAlterNewCol((c) => ({ ...c, name: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Column Type
                    </label>
                    <select
                      value={alterNewCol.type}
                      onChange={(e) => setAlterNewCol((c) => ({ ...c, type: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-indigo-300 font-mono"
                    >
                      {COMMON_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {alterAction === 'drop_col' && currentTableObj && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Select Column to Drop
                  </label>
                  <select
                    value={alterDropCol || currentTableObj.columns[0]?.name}
                    onChange={(e) => setAlterDropCol(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-rose-300 font-mono"
                  >
                    {currentTableObj.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {alterAction === 'rename' && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    New Table Name
                  </label>
                  <input
                    type="text"
                    value={alterRenameTable}
                    onChange={(e) => setAlterRenameTable(e.target.value)}
                    placeholder={`${selectedTable}_new`}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* DROP SCHEMA OBJECT */}
          {designerMode === 'drop' && (
            <div className="space-y-4">
              <div className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-lg text-xs text-rose-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Caution: Irreversible Action
                </div>
                <div>Dropping a table or index deletes data or constraints permanently.</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Object Type to Drop
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDropTargetType('table')}
                    className={`px-3 py-1 text-xs rounded border transition ${
                      dropTargetType === 'table'
                        ? 'bg-rose-950/50 text-rose-300 border-rose-700 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setDropTargetType('index')}
                    className={`px-3 py-1 text-xs rounded border transition ${
                      dropTargetType === 'index'
                        ? 'bg-rose-950/50 text-rose-300 border-rose-700 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Index
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target Table
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-rose-500"
                >
                  {schema?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {dropTargetType === 'index' && currentTableObj && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Select Index to Drop
                  </label>
                  <select
                    value={dropIndexName}
                    onChange={(e) => setDropIndexName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-rose-300 font-mono focus:outline-none focus:border-rose-500"
                  >
                    {(currentTableObj.indexes || []).map((idx) => (
                      <option key={idx.name} value={idx.name}>
                        {idx.name} ({idx.columns.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Type table name <strong className="text-rose-400 font-mono">"{selectedTable}"</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={dropConfirmText}
                  onChange={(e) => setDropConfirmText(e.target.value)}
                  placeholder={selectedTable}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-rose-300 font-mono focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Real-time Generated SQL */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
              <FileCode className="w-3.5 h-3.5 text-indigo-400" /> Generated SQL Preview
            </div>
            <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
              {activeSql}
            </pre>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-mono">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-end gap-2 bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting || isReadOnly}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded text-white disabled:opacity-50 transition shadow-sm ${
              designerMode === 'drop'
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {designerMode === 'drop' ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            <span>{isExecuting ? 'Executing...' : designerMode === 'drop' ? 'Drop Object' : 'Execute DDL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
