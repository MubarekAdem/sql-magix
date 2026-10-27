import { SqliteEngine } from '../sqlite/engine.js';
import type { WorkerRequest, WorkerResponse } from './protocol.js';

let engine: SqliteEngine | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case 'init': {
        engine = new SqliteEngine({ wasmUrl: req.wasmUrl });
        await engine.init();
        send({ id: req.id, type: 'init:ready' });
        break;
      }

      case 'load': {
        if (!engine) {
          engine = new SqliteEngine();
          await engine.init();
        }
        engine.loadBinary(req.buffer);
        send({ id: req.id, type: 'load:ready' });
        break;
      }

      case 'query': {
        if (!engine) throw new Error('Database worker not initialized');
        const result = await engine.query(req.sql, req.params);
        send({ id: req.id, type: 'query:result', result });
        break;
      }

      case 'getSchema': {
        if (!engine) throw new Error('Database worker not initialized');
        const schema = await engine.getSchema(req.schemaName);
        send({ id: req.id, type: 'getSchema:result', schema });
        break;
      }

      case 'explain': {
        if (!engine) throw new Error('Database worker not initialized');
        const plan = await engine.explain(req.sql);
        send({ id: req.id, type: 'explain:result', plan });
        break;
      }

      case 'export': {
        if (!engine) throw new Error('Database worker not initialized');
        const buffer = engine.exportBinary();
        // Zero-copy transfer if possible
        (self as any).postMessage(
          { id: req.id, type: 'export:result', buffer },
          [buffer.buffer]
        );
        break;
      }

      case 'close': {
        if (engine) {
          await engine.close();
          engine = null;
        }
        send({ id: req.id, type: 'close:ready' });
        break;
      }

      default:
        throw new Error(`Unknown request type: ${(req as any).type}`);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    send({ id: req.id, type: 'error', error });
  }
};

function send(res: WorkerResponse): void {
  self.postMessage(res);
}
