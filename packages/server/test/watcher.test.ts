import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DatabaseWatcher } from '../src/watcher.js';

describe('DatabaseWatcher', () => {
  let tempDir: string;
  let testDbFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sql_magic_watch_'));
    testDbFile = path.join(tempDir, 'active.db');
    fs.writeFileSync(testDbFile, 'initial');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it('notifies subscribers when the database file is modified', async () => {
    const watcher = new DatabaseWatcher(testDbFile);
    watcher.start();

    const changePromise = new Promise<{ type: string; file: string }>((resolve) => {
      const unsub = watcher.subscribe((evt) => {
        unsub();
        resolve(evt);
      });
    });

    // Modify file
    fs.appendFileSync(testDbFile, '-more-data');

    const result = await Promise.race([
      changePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for change event')), 1500)),
    ]);

    expect(result.type).toBe('db-change');
    expect(result.file).toBe(path.resolve(testDbFile));

    watcher.close();
  });
});
