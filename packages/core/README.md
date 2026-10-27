# ⚡ sql-magic-core

> Universal database adapter engine, schema introspection, and editing abstractions for **SQLite**, **PostgreSQL**, and **MySQL**.

[![npm version](https://img.shields.io/npm/v/sql-magic-core.svg?color=indigo)](https://www.npmjs.com/package/sql-magic-core)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/MubarekAdem/sql-magix/blob/main/LICENSE)

---

## 📦 Installation

```bash
npm install sql-magic-core
# or
pnpm add sql-magic-core
```

---

## 🚀 Quick Usage

### 1. Browser & In-Memory SQLite (WASM)

```ts
import { SqliteEngine } from 'sql-magic-core';

// Create in-memory SQLite database
const engine = new SqliteEngine();
await engine.init();

// Execute queries
await engine.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);');
await engine.query("INSERT INTO users (name) VALUES ('Alice'), ('Bob');");

// Introspect schema (tables, columns, types, foreign keys, indexes)
const schema = await engine.getSchema();
console.log(schema.tables);

// Query results
const result = await engine.query('SELECT * FROM users;');
console.log(result.columns, result.rows);
```

### 2. Node.js Database Factory (PostgreSQL, MySQL, SQLite)

```ts
import { createAdapter, detectDialectFromUrl } from 'sql-magic-core/server';

// Automatically detect dialect and connect
const adapter = await createAdapter('postgres://user:secret@localhost:5432/mydb', {
  readOnly: true,
});

// Full schema introspection
const schema = await adapter.getSchema();

// Execute query
const result = await adapter.query('SELECT * FROM customers LIMIT 10;');
console.log(result.rows);

// Clean up
await adapter.close();
```

---

## 🛠️ Features

- **Dialect Agnostic:** Standardized `DbAdapter` interface across SQLite, PostgreSQL, and MySQL.
- **Deep Schema Introspection:** Extracts tables, views, triggers, columns, data types, primary keys, foreign keys, indexes, and row counts.
- **Transactional Staging & Commits:** Generate transactional SQL scripts (`generateCommitScript`) for staged cell updates, row insertions, and deletions with safe identifier quoting.
- **CSV / JSON Ingestion:** `generateImportStatements` with automatic column type inference (`inferColumnType`).
- **Statistics & Profiling:** `computeColumnStatistics` calculates null counts, distinct ratios, averages, and numeric histograms.
- **Query Plan Introspection:** Parse EXPLAIN query plans and generate index recommendations (`analyzePlanForMissingIndexes`).

---

## 📄 License

MIT © [Mubarek Adem](https://github.com/MubarekAdem)
