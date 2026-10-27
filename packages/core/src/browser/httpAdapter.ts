import type {
  DbAdapter,
  DbCapabilities,
  DatabaseSchema,
  Dialect,
  Plan,
  ResultSet,
} from '../types.js';

export interface HttpAdapterOptions {
  baseUrl?: string;
  token?: string;
  dialect?: Dialect;
  capabilities?: DbCapabilities;
}

/**
 * Browser-to-Server Database Adapter.
 * Connects the web UI to the sql-magic backend server via HTTP and SSE.
 */
export class HttpAdapter implements DbAdapter {
  readonly dialect: Dialect;
  public capabilities: DbCapabilities;
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: HttpAdapterOptions = {}) {
    this.baseUrl = (
      options.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    ).replace(/\/$/, '');
    this.token = options.token;
    this.dialect = options.dialect || 'sqlite';
    this.capabilities = options.capabilities || {
      schemas: options.dialect !== 'sqlite',
      explain: true,
      pragma: options.dialect === 'sqlite',
      createTable: true,
      alterTable: true,
      dropTable: true,
      views: true,
      triggers: true,
      indexes: true,
      foreignKeys: true,
      readOnly: true,
      exportDatabase: false,
      multipleDatabases: options.dialect === 'sqlite',
      fullTextSearch: true,
      streaming: false,
    };
  }

  async listSchemas(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/schemas`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return ['main'];
    }
    const data = await res.json();
    return data.schemas || ['main'];
  }

  async connectDatabase(url: string, readOnly?: boolean): Promise<{
    dialect: Dialect;
    capabilities: DbCapabilities;
    targetPath: string;
    schema: DatabaseSchema;
  }> {
    const res = await fetch(`${this.baseUrl}/api/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
      },
      body: JSON.stringify({ url, readOnly }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Failed to connect to database (${res.status})`);
    }

    (this as any).dialect = data.dialect;
    this.capabilities = data.capabilities;
    return data;
  }

  async getSchema(schemaName?: string): Promise<DatabaseSchema> {
    const url = schemaName
      ? `${this.baseUrl}/api/schema?schema=${encodeURIComponent(schemaName)}`
      : `${this.baseUrl}/api/schema`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch schema (${res.status})`);
    }
    return res.json();
  }

  async query(sql: string, params?: unknown[]): Promise<ResultSet> {
    const res = await fetch(`${this.baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
      },
      body: JSON.stringify({ sql, params }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Query execution failed (${res.status})`);
    }
    return data;
  }

  async explain(sql: string): Promise<Plan> {
    const res = await fetch(`${this.baseUrl}/api/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
      },
      body: JSON.stringify({ sql }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Explain execution failed (${res.status})`);
    }
    return data;
  }

  quoteIdent(name: string): string {
    if (this.dialect === 'postgres') {
      return `"${name.replace(/"/g, '""')}"`;
    }
    if (this.dialect === 'mysql') {
      return `\`${name.replace(/`/g, '``')}\``;
    }
    return `"${name.replace(/"/g, '""')}"`;
  }

  async close(): Promise<void> {
    // No-op for HTTP adapter
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      headers['x-viewer-token'] = this.token;
    }
    return headers;
  }
}
