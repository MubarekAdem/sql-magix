import type {
  DbAdapter,
  DbCapabilities,
  DatabaseSchema,
  Dialect,
  Plan,
  ResultSet,
} from '../types.js';
import { SQLITE_CAPABILITIES } from '../sqlite/engine.js';
import { quoteSqliteIdent } from '../sqlite/quote.js';
import type { WorkerPayload, WorkerRequest, WorkerResponse } from './protocol.js';

/**
 * Browser SQLite Adapter that offloads database operations to a Web Worker,
 * ensuring query executions and large file introspections never block the UI thread.
 */
export class BrowserSqliteAdapter implements DbAdapter {
  readonly dialect: Dialect = 'sqlite';
  public capabilities: DbCapabilities;
  private worker: Worker;
  private pendingRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: Error) => void }
  >();
  private reqCounter = 0;
  private isClosed = false;

  constructor(worker: Worker, options: { readOnly?: boolean } = {}) {
    this.worker = worker;
    this.capabilities = {
      ...SQLITE_CAPABILITIES,
      readOnly: !!options.readOnly,
    };

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const res = event.data;
      const handler = this.pendingRequests.get(res.id);
      if (!handler) return;

      this.pendingRequests.delete(res.id);

      if (res.type === 'error') {
        handler.reject(new Error(res.error));
        return;
      }

      switch (res.type) {
        case 'init:ready':
        case 'load:ready':
        case 'close:ready':
          handler.resolve(undefined);
          break;
        case 'query:result':
          handler.resolve(res.result);
          break;
        case 'getSchema:result':
          handler.resolve(res.schema);
          break;
        case 'explain:result':
          handler.resolve(res.plan);
          break;
        case 'export:result':
          handler.resolve(res.buffer);
          break;
        default:
          handler.resolve(res);
      }
    };

    this.worker.onerror = (event: ErrorEvent) => {
      const err = new Error(`SQLite Worker error: ${event.message}`);
      for (const handler of this.pendingRequests.values()) {
        handler.reject(err);
      }
      this.pendingRequests.clear();
    };
  }

  private send<T>(req: WorkerPayload, transfer?: Transferable[]): Promise<T> {
    if (this.isClosed) {
      return Promise.reject(new Error('BrowserSqliteAdapter is closed'));
    }

    const id = `req_${++this.reqCounter}_${Date.now()}`;
    const fullReq = { ...req, id } as WorkerRequest;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      if (transfer && transfer.length > 0) {
        this.worker.postMessage(fullReq, transfer);
      } else {
        this.worker.postMessage(fullReq);
      }
    });
  }

  /**
   * Initializes the SQLite engine inside the worker.
   */
  async init(wasmUrl?: string): Promise<void> {
    await this.send<void>({ type: 'init', wasmUrl });
  }

  /**
   * Loads a binary SQLite database (.db, .sqlite, .sqlite3).
   */
  async loadDatabase(buffer: Uint8Array | ArrayBuffer): Promise<void> {
    const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    await this.send<void>({ type: 'load', buffer: arr });
  }

  /**
   * Exports the binary database from worker memory.
   */
  async exportDatabase(): Promise<Uint8Array> {
    return this.send<Uint8Array>({ type: 'export' });
  }

  listSchemas(): Promise<string[]> {
    return Promise.resolve(['main']);
  }

  async getSchema(schemaName?: string): Promise<DatabaseSchema> {
    return this.send<DatabaseSchema>({ type: 'getSchema', schemaName });
  }

  async query(sql: string, params?: unknown[]): Promise<ResultSet> {
    return this.send<ResultSet>({ type: 'query', sql, params });
  }

  async explain(sql: string): Promise<Plan> {
    return this.send<Plan>({ type: 'explain', sql });
  }

  quoteIdent(name: string): string {
    return quoteSqliteIdent(name);
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    try {
      await this.send<void>({ type: 'close' });
    } finally {
      this.worker.terminate();
      this.isClosed = true;
    }
  }
}
