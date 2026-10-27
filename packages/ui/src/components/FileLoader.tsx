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
      // Simulate/track progress during initial buffer load
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
              description: 'SQLite Databases',
              accept: {
                'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
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
        // Fallback to standard input if user cancels or API fails
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
        accept=".db,.sqlite,.sqlite3"
        onChange={handleInputChange}
        className="hidden"
      />

      <button
        onClick={openFilePicker}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm disabled:opacity-50"
      >
        <Upload className="w-3.5 h-3.5" />
        <span>Open .db</span>
      </button>

      {/* Full-screen drag overlay when hovering files over viewport */}
      {dragActive && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className="fixed inset-0 z-50 bg-indigo-950/80 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center mb-4 animate-bounce">
            <Upload className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Drop SQLite database to open</h2>
          <p className="text-sm text-indigo-200">
            Supports .db, .sqlite, .sqlite3 • Files never leave your browser
          </p>
        </div>
      )}

      {/* Large-file Memory Warning Modal */}
      {warningFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-md w-full p-5 font-sans">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-800/60">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">Large Database Warning</h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              <strong className="text-white">{warningFile.name}</strong> is{' '}
              <strong className="text-amber-400">
                {(warningFile.size / (1024 * 1024)).toFixed(1)} MB
              </strong>
              . Loading very large databases directly in the browser requires sufficient client RAM.
              Files stay 100% on your machine.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setWarningFile(null)}
                className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => processFile(warningFile)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
              >
                Proceed & Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Progress Bar */}
      {readProgress !== null && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-zinc-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-200"
            style={{ width: `${readProgress}%` }}
          />
        </div>
      )}
    </>
  );
};
