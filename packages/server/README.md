# 🌐 sql-magic-server

> Lightweight Hono REST API server, SSE live file watcher, and security middleware for **sql-magix**.

[![npm version](https://img.shields.io/npm/v/sql-magic-server.svg?color=indigo)](https://www.npmjs.com/package/sql-magic-server)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/MubarekAdem/sql-magix/blob/main/LICENSE)

---

## 📦 Installation

```bash
npm install sql-magic-server sql-magic-core
# or
pnpm add sql-magic-server sql-magic-core
```

---

## 🚀 Programmatic Usage

```ts
import { startViewer } from 'sql-magic-server';
import { createAdapter } from 'sql-magic-core/server';

// Connect to a database
const adapter = await createAdapter('postgres://user:secret@localhost:5432/mydb', {
  readOnly: true,
});

// Launch viewer server
const server = await startViewer({
  port: 3000,
  host: '127.0.0.1',
  adapter,
  readOnly: true,
});

console.log(`Server running at ${server.host}:${server.port}`);
```

---

## 🛡️ Built-in Security

- **Strict Read-Only Enforcement:** Blocks mutating DDL and DML statements at the API layer unless `--allow-write` is specified.
- **Cryptographic Token Auth:** Generates random authorization tokens to prevent unauthorized local network access.
- **DNS Rebinding & Origin Protection:** Rejects unauthorized `Host` headers and cross-origin requests.
- **Sensitive Credential Redaction:** Masks connection passwords in API responses and logs.
- **Live File Watcher:** Efficient debounced file watcher for SQLite databases and write-ahead logs (`-wal`), pushing updates to the UI via Server-Sent Events (SSE).

---

## 📄 License

MIT © [Mubarek Adem](https://github.com/MubarekAdem)
