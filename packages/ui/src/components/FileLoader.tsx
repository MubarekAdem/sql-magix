import React, { useState, useRef } from 'react';
import { Upload, AlertTriangle, FileCheck, X, HardDrive } from 'lucide-react';

interface FileLoaderProps {
  onLoad: (file: File) => Promise<void>;
  isLoading: boolean;
}

export const FileLoader: React.FC<FileLoaderProps> = ({ onLoad, isLoading }) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [warningFile, setWarningFile] = useState<File | null>(null);
  const [readProgress, setReadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFile = async (file: File) => {
    // Large-file check: 100MB threshold
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > 100 && !warningFile) {
      setWarningFile(file);
      return;
    }

    setWarningFile(null);
    setReadProgress(10);

    try {
      const interval = setInterval(() => {
        setReadProgress((prev) => {
          if (prev === null || prev >= 90) return prev;
          return prev + 20;
        });
      }, 100);

      await onLoad(file);

      clearInterval(interval);
      setReadProgress(100);
      setTimeout(() => setReadProgress(null), 500);
    } catch {
      setReadProgress(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Modern File System Access API picker if supported
  const openFilePicker = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'SQLite Databases (*.db, *.sqlite, *.sqlite3, *.db3, *.s3db, *.sqlitedb, *.gpkg, *.mbtiles)',
              accept: {
                'application/x-sqlite3': [
                  '.db',
                  '.sqlite',
                  '.sqlite3',
                  '.db3',
                  '.s3db',
                  '.sl3',
                  '.sqlitedb',
                  '.gpkg',
                  '.mbtiles',
                ],
                'application/vnd.sqlite3': ['.db', '.sqlite', '.sqlite3'],
              },
            },
            {
              description: 'All Files (*.*)',
              accept: {
                '*/*': [],
              },
            },
          ],
          multiple: false,
        });
        if (handles && handles.length > 0) {
          const file = await handles[0].getFile();
          processFile(file);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,.db3,.s3db,.sl3,.sqlitedb,.gpkg,.mbtiles,*"
        onChange={handleInputChange}
        className="hidden"
      />

      <button
        onClick={openFilePicker}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-50 transition-all duration-150 shadow-2xs font-sans"
        title="Open local SQLite database (.db, .sqlite, etc)"
      >
        <Upload className="w-3.5 h-3.5" />
        <span>Open DB</span>
      </button>

      {/* Full-screen drag overlay with Robi's low-saturation styling */}
      {dragActive && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className="fixed inset-0 z-50 bg-[#0f1218]/85 backdrop-blur-md border-2 border-dashed border-indigo-500/80 flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 animate-bounce">
            <Upload className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Drop SQLite database to open</h2>
          <p className="text-sm text-[#98a0af]">
            Supports .db, .sqlite, .sqlite3 • Stored 100% locally in your browser
          </p>
        </div>
      )}

      {/* Large-file Memory Warning Modal with Robi's Concentric Radius */}
      {warningFile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151922] border border-[#e2e6ee] dark:border-[#222938] rounded-2xl shadow-2xl max-w-md w-full p-6 font-sans">
            <div className="flex items-center gap-3 text-amber-500 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#1b202a] dark:text-white">Large Database Warning</h3>
                <span className="text-xs text-[#8c96a8]">High memory usage notice</span>
              </div>
            </div>

            <p className="text-xs text-[#5f687a] dark:text-[#98a0af] leading-relaxed mb-5">
              <strong className="text-[#1b202a] dark:text-white font-mono">{warningFile.name}</strong> is{' '}
              <strong className="text-amber-600 dark:text-amber-400">
                {(warningFile.size / (1024 * 1024)).toFixed(1)} MB
              </strong>
              . Loading very large databases directly in browser WebAssembly requires sufficient client RAM.
              Database stays 100% private on your machine.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setWarningFile(null)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#e2e6ee] dark:border-[#262e40] bg-white dark:bg-[#1a1f2c] text-[#5f687a] dark:text-[#98a0af] hover:text-[#1b202a] dark:hover:text-white transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => processFile(warningFile)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white shadow-2xs transition"
              >
                Proceed & Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Progress Bar */}
      {readProgress !== null && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-[#e2e6ee] dark:bg-[#222938]">
          <div
            className="h-full bg-indigo-500 transition-all duration-200"
            style={{ width: `${readProgress}%` }}
          />
        </div>
      )}
    </>
  );
};
