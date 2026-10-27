import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WatcherEvent {
  type: 'db-change';
  file: string;
  timestamp: number;
}

export type WatcherListener = (event: WatcherEvent) => void;

/**
 * Watches a SQLite database file and its WAL / SHM companion files.
 */
export class DatabaseWatcher {
  private filepath: string;
  private listeners = new Set<WatcherListener>();
  private watchers: fs.FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(filepath: string) {
    this.filepath = path.resolve(filepath);
  }

  /**
   * Start watching the target file and directory for modifications.
   */
  start(): void {
    if (!fs.existsSync(this.filepath)) return;

    try {
      const dir = path.dirname(this.filepath);
      const targetBase = path.basename(this.filepath);

      // Watch parent directory to capture file replacements and companion files (-wal, -shm)
      const watcher = fs.watch(dir, (eventType, filename) => {
        if (!filename) return;
        if (
          filename === targetBase ||
          filename === `${targetBase}-wal` ||
          filename === `${targetBase}-shm`
        ) {
          this.triggerChange();
        }
      });

      this.watchers.push(watcher);
    } catch {
      // Fallback or ignore if directory not watchable
    }
  }

  private triggerChange(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      const event: WatcherEvent = {
        type: 'db-change',
        file: this.filepath,
        timestamp: Date.now(),
      };
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }, 150); // 150ms debounce
  }

  /**
   * Subscribe to database change events.
   */
  subscribe(listener: WatcherListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Stop watching and release file system handles.
   */
  close(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        // Ignored
      }
    }
    this.watchers = [];
    this.listeners.clear();
  }
}
