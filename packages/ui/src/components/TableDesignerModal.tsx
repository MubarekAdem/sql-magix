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

  const currentTableObj = schema?.tables.find((t) => t.name === selectedTable);

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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] font-sans transition-all duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-[#1b202a] dark:text-white">Schema Designer</span>
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#eef1f6] dark:bg-[#1f2433] text-[#5f687a] dark:text-[#98a0af] font-mono">
                {dialect}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c96a8] hover:text-[#1b202a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Warning if restricted */}
        {isReadOnly && (
          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Server is in Read-Only mode. Writing DDL requires --allow-write.</span>
          </div>
        )}

        {/* Mode Selector Pill Strip */}
        <div className="p-3 bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938]">
          <div className="flex items-center p-1 rounded-xl bg-[#eef1f6] dark:bg-[#1a1f2c] border border-[#e2e6ee] dark:border-[#262e40] gap-1">
            <button
              onClick={() => setDesignerMode('table')}
              className={`flex-1 py-1 px-3 text-xs font-medium rounded-lg transition-all duration-150 ${
                designerMode === 'table'
                  ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
            >
              New Table
            </button>
            <button
              onClick={() => setDesignerMode('index')}
              className={`flex-1 py-1 px-3 text-xs font-medium rounded-lg transition-all duration-150 ${
                designerMode === 'index'
                  ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
            >
              New Index
            </button>
            <button
              onClick={() => setDesignerMode('alter')}
              className={`flex-1 py-1 px-3 text-xs font-medium rounded-lg transition-all duration-150 ${
                designerMode === 'alter'
                  ? 'bg-white dark:bg-[#252c3d] text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white'
              }`}
            >
              Alter Table
            </button>
            <button
              onClick={() => setDesignerMode('drop')}
              className={`flex-1 py-1 px-3 text-xs font-medium rounded-lg transition-all duration-150 ${
                designerMode === 'drop'
                  ? 'bg-rose-500 text-white shadow-2xs'
                  : 'text-[#5f687a] dark:text-[#98a0af] hover:text-rose-500'
              }`}
            >
              Drop Object
            </button>
          </div>
        </div>

        {/* Designer Viewport Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* NEW TABLE */}
          {designerMode === 'table' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Table Name
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g. customers, orders"
                  className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              {/* Columns Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#1b202a] dark:text-white">Columns</span>
                  <button
                    onClick={handleAddColumn}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline py-1 px-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Column</span>
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden border border-[#e2e6ee] dark:border-[#222938]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#f8f9fb] dark:bg-[#101319] border-b border-[#e2e6ee] dark:border-[#222938] text-[#5f687a] dark:text-[#98a0af]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 text-center font-medium">PK</th>
                        <th className="px-3 py-2 text-center font-medium">Auto</th>
                        <th className="px-3 py-2 text-center font-medium">Nullable</th>
                        <th className="px-3 py-2 font-medium">Default</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e6ee] dark:divide-[#222938] bg-white dark:bg-[#151922]">
                      {columns.map((col, idx) => (
                        <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => handleColumnChange(idx, 'name', e.target.value)}
                              className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-md px-2 py-1 text-[#1b202a] dark:text-[#edf0f6] text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={col.type}
                              onChange={(e) => handleColumnChange(idx, 'type', e.target.value)}
                              className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-md px-2 py-1 text-indigo-600 dark:text-indigo-400 text-xs font-medium"
                            >
                              {COMMON_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!col.primaryKey}
                              onChange={(e) => handleColumnChange(idx, 'primaryKey', e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!col.autoIncrement}
                              onChange={(e) => handleColumnChange(idx, 'autoIncrement', e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={col.nullable !== false}
                              onChange={(e) => handleColumnChange(idx, 'nullable', e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={col.defaultValue || ''}
                              onChange={(e) => handleColumnChange(idx, 'defaultValue', e.target.value)}
                              placeholder="NULL"
                              className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-md px-2 py-1 text-[#5f687a] dark:text-[#98a0af] text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              onClick={() => handleRemoveColumn(idx)}
                              className="text-[#8c96a8] hover:text-rose-500 p-1 rounded transition"
                              title="Delete Column"
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
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Target Table
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setSelectedCols([]);
                  }}
                  className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none"
                >
                  {schema?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Index Name
                </label>
                <input
                  type="text"
                  value={indexName}
                  onChange={(e) => setIndexName(e.target.value)}
                  className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Columns to Index
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#f8f9fb] dark:bg-[#101319] border border-[#e2e6ee] dark:border-[#222938] rounded-xl max-h-48 overflow-y-auto">
                  {currentTableObj?.columns.map((c) => (
                    <label key={c.name} className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCols.includes(c.name)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCols((prev) => [...prev, c.name]);
                          else setSelectedCols((prev) => prev.filter((col) => col !== c.name));
                        }}
                        className="rounded text-indigo-600 focus:ring-0"
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUniqueIndex}
                  onChange={(e) => setIsUniqueIndex(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="font-medium text-[#1b202a] dark:text-white">UNIQUE Index constraint</span>
              </label>
            </div>
          )}

          {/* ALTER TABLE */}
          {designerMode === 'alter' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Target Table
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none"
                >
                  {schema?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAlterAction('add_col')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    alterAction === 'add_col'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      : 'border-[#e2e6ee] dark:border-[#262e40] text-[#5f687a] dark:text-[#98a0af]'
                  }`}
                >
                  Add Column
                </button>
                <button
                  onClick={() => setAlterAction('rename')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    alterAction === 'rename'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      : 'border-[#e2e6ee] dark:border-[#262e40] text-[#5f687a] dark:text-[#98a0af]'
                  }`}
                >
                  Rename Table
                </button>
              </div>

              {alterAction === 'add_col' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#5f687a] dark:text-[#98a0af] mb-1">Column Name</label>
                    <input
                      type="text"
                      value={alterNewCol.name}
                      onChange={(e) => setAlterNewCol((c) => ({ ...c, name: e.target.value }))}
                      className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#5f687a] dark:text-[#98a0af] mb-1">Column Type</label>
                    <select
                      value={alterNewCol.type}
                      onChange={(e) => setAlterNewCol((c) => ({ ...c, type: e.target.value }))}
                      className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-2.5 py-1.5 text-xs font-mono"
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

              {alterAction === 'rename' && (
                <div>
                  <label className="block text-xs text-[#5f687a] dark:text-[#98a0af] mb-1">New Table Name</label>
                  <input
                    type="text"
                    value={alterRenameTable}
                    onChange={(e) => setAlterRenameTable(e.target.value)}
                    placeholder={`${selectedTable}_new`}
                    className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* DROP SCHEMA OBJECT */}
          {designerMode === 'drop' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Target Object Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDropTargetType('table')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                      dropTargetType === 'table'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                        : 'border-[#e2e6ee] dark:border-[#262e40] text-[#5f687a] dark:text-[#98a0af]'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setDropTargetType('index')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                      dropTargetType === 'index'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                        : 'border-[#e2e6ee] dark:border-[#262e40] text-[#5f687a] dark:text-[#98a0af]'
                    }`}
                  >
                    Index
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Target Table
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-[#e2e6ee] dark:border-[#262e40] rounded-lg px-3 py-1.5 text-xs text-[#1b202a] dark:text-[#edf0f6] font-mono focus:outline-none"
                >
                  {schema?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
                  Type table name <strong className="text-rose-500 font-mono">"{selectedTable}"</strong> to confirm deletion:
                </label>
                <input
                  type="text"
                  value={dropConfirmText}
                  onChange={(e) => setDropConfirmText(e.target.value)}
                  placeholder={selectedTable}
                  className="w-full bg-[#f8f9fb] dark:bg-[#161a24] border border-rose-300 dark:border-rose-800/80 rounded-lg px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Real-time Generated SQL */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#5f687a] dark:text-[#98a0af] mb-1.5">
              <FileCode className="w-3.5 h-3.5 text-indigo-500" />
              <span>Generated SQL Preview</span>
            </div>
            <pre className="p-3 bg-[#f8f9fb] dark:bg-[#0e1117] border border-[#e2e6ee] dark:border-[#222938] rounded-xl text-xs font-mono text-[#3f4756] dark:text-[#c4cad4] overflow-x-auto leading-relaxed">
              {activeSql}
            </pre>
          </div>

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
            disabled={isExecuting || isReadOnly}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg text-white disabled:opacity-50 transition active:scale-[0.98] shadow-2xs ${
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
