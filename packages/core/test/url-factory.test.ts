import { describe, it, expect } from 'vitest';
import {
  detectDialectFromUrl,
  maskConnectionString,
  normalizeValue,
} from '../src/server/url.js';
import { createAdapter } from '../src/server/factory.js';

describe('Dialect URL Resolution & Value Normalization', () => {
  it('accurately identifies dialects from connection schemes', () => {
    expect(detectDialectFromUrl('postgres://user:pass@localhost:5432/db')).toBe('postgres');
    expect(detectDialectFromUrl('postgresql://user:pass@localhost:5432/db')).toBe('postgres');
    expect(detectDialectFromUrl('mysql://root:secret@127.0.0.1:3306/app')).toBe('mysql');
    expect(detectDialectFromUrl('mariadb://root:secret@127.0.0.1:3306/app')).toBe('mysql');
    expect(detectDialectFromUrl('sqlite:///tmp/test.db')).toBe('sqlite');
    expect(detectDialectFromUrl('./data/production.sqlite')).toBe('sqlite');
    expect(detectDialectFromUrl('app.sqlite3')).toBe('sqlite');
  });

  it('masks database passwords for secure logging and UI display', () => {
    const rawPg = 'postgres://admin:TopSecretPassword123@db.example.com:5432/prod_db';
    const maskedPg = maskConnectionString(rawPg);
    expect(maskedPg).not.toContain('TopSecretPassword123');
    expect(maskedPg).toContain('admin:*****@');

    const rawMysql = 'mysql://root:my_secure_pass@localhost:3306/main';
    const maskedMysql = maskConnectionString(rawMysql);
    expect(maskedMysql).not.toContain('my_secure_pass');
    expect(maskedMysql).toContain('root:*****@');
  });

  it('normalizes BigInt and date values safely', () => {
    const big = BigInt('9007199254740992345');
    expect(normalizeValue(big)).toBe('9007199254740992345');

    const now = new Date();
    expect(normalizeValue(now)).toBe(now.toISOString());

    const buf = Buffer.from('hello world');
    expect(normalizeValue(buf)).toContain('<BLOB 11 bytes>');

    expect(normalizeValue(null)).toBe(null);
    expect(normalizeValue('simple string')).toBe('simple string');
  });

  it('initializes adapter via createAdapter factory', async () => {
    const adapter = await createAdapter(':memory:');
    expect(adapter.dialect).toBe('sqlite');
    expect(adapter.capabilities.explain).toBe(true);
    await adapter.close();
  });
});
