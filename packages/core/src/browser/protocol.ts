import type { DatabaseSchema, Plan, ResultSet } from '../types.js';

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export type WorkerRequest =
  | { id: string; type: 'init'; wasmUrl?: string }
  | { id: string; type: 'load'; buffer: Uint8Array | ArrayBuffer }
  | { id: string; type: 'query'; sql: string; params?: unknown[] }
  | { id: string; type: 'getSchema'; schemaName?: string }
  | { id: string; type: 'explain'; sql: string }
  | { id: string; type: 'export' }
  | { id: string; type: 'close' };

export type WorkerPayload = DistributiveOmit<WorkerRequest, 'id'>;

export type WorkerResponse =
  | { id: string; type: 'init:ready' }
  | { id: string; type: 'load:ready' }
  | { id: string; type: 'query:result'; result: ResultSet }
  | { id: string; type: 'getSchema:result'; schema: DatabaseSchema }
  | { id: string; type: 'explain:result'; plan: Plan }
  | { id: string; type: 'export:result'; buffer: Uint8Array }
  | { id: string; type: 'close:ready' }
  | { id: string; type: 'error'; error: string };
