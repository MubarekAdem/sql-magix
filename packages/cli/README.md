# ✨ sql-magix

> The universal, high-performance database studio and CLI for **SQLite**, **PostgreSQL**, and **MySQL**.
> Open local `.db` files instantly in the browser or connect to live production databases directly from your terminal.

[![npm version](https://img.shields.io/npm/v/sql-magix.svg?color=indigo)](https://www.npmjs.com/package/sql-magix)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-emerald.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/MubarekAdem/sql-magix/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/MubarekAdem/sql-magix?style=social)](https://github.com/MubarekAdem/sql-magix)

---

## ⚡ Instant Usage (Zero Install)

Run `sql-magix` directly against any local database file, directory, or connection URL with `npx`:

```bash
# Explore a local SQLite file
npx sql-magix ./app.db

# Scan current directory and list all .db files
npx sql-magix .

# Connect to PostgreSQL (read-only by default)
npx sql-magix postgres://postgres:secret@localhost:5432/mydb

# Connect to MySQL / MariaDB
npx sql-magix mysql://root:secret@127.0.0.1:3306/ecommerce

# Headless query execution & JSON/CSV export
npx sql-magix -q "SELECT id, name, price FROM products LIMIT 5;" ./store.db --format json
```

Or install globally:

```bash
npm install -g sql-magix

# Then launch anywhere:
sql-magix ./mydb.sqlite
```

---

## 🔑 Key Highlights

- **Zero-Config `.env` Auto-Detection:** Automatically reads `DATABASE_URL`, `POSTGRES_URL`, or `MYSQL_URL` from `.env` or `.env.local`. Just type `npx sql-magix` and go.
- **Dynamic Database Switcher ("Connect DB"):** Switch between SQLite files, PostgreSQL clusters, and MySQL databases directly in the UI without restarting the CLI server.
- **Million-Row Virtual Data Grid:** Fast rendering powered by virtual scrolling with double-click inline cell editing, row staging, and multi-level Undo/Redo (`Ctrl+Z` / `Ctrl+Y`).
- **Interactive Crow's Foot ER Diagram:** Automatic translation of tables and foreign key constraints into Mermaid ER diagrams, interactive Table Cards, and DDL syntax with smart bezier connectors and fullscreen view.
- **Integrated Gemini AI SQL Assistant:** Convert plain English to dialect-accurate SQL queries using Google Gemini (`gemini-3.5-flash-lite`) with zero-data privacy (only schema DDL is referenced).
- **PostgreSQL Smart Auto-Fix:** Automatically detects unquoted mixed-case identifier errors (`relation "employee" does not exist`) with a 1-click **Auto-Quote & Run** button.
- **Resizable Query Editor with WCAG AAA Colors:** Draggable splitter between editor and grid with accessible syntax highlighting in Light & Dark modes.
- **Visual Schema Designer:** Add/drop tables, modify columns, primary keys, and foreign keys visually.
- **CSV & JSON Import:** Drag-and-drop spreadsheets to create populated tables with auto-inferred column types.
- **Read-Only by Default:** Protects production databases against accidental mutations. Mutations require explicit `--allow-write`.

---

## 🛠️ CLI Options

| Option | Description | Default |
| :--- | :--- | :--- |
| `[target]` | Database path, directory, or connection URL | `.` |
| `-u, --url <url>` | Explicit database connection string URL | `undefined` |
| `-p, --port <number>` | Port for local studio server | `3000` |
| `-H, --host <ip>` | Network interface to bind (`127.0.0.1` or `0.0.0.0`) | `127.0.0.1` |
| `--readonly` | Enforce strict read-only mode | `true` |
| `--allow-write` | Permit mutations and DDL commits | `false` |
| `--no-open` | Prevent opening the browser automatically | `false` |
| `--no-watch` | Disable live SQLite file & WAL change watcher | `false` |
| `-q, --query <sql>` | Execute SQL query headlessly and exit | `undefined` |
| `-f, --format <format>` | Headless output format (`json` or `csv`) | `json` |
| `--create-sample` | Generate a sample SQLite store database | `undefined` |
| `--demo` | Shortcut to seed and open sample store database | `false` |
| `-v, --version` | Display installed version | |

---

## 📦 Ecosystem Packages

- **[`sql-magix`](https://www.npmjs.com/package/sql-magix)**: Self-contained CLI and full studio.
- **[`sql-magic-core`](https://www.npmjs.com/package/sql-magic-core)**: Universal DbAdapter engine & schema introspection for SQLite, PostgreSQL, and MySQL.
- **[`sql-magic-server`](https://www.npmjs.com/package/sql-magic-server)**: Lightweight Hono REST API and live SSE file change watcher.

---

## 📄 License

MIT © [Mubarek Adem](https://github.com/MubarekAdem)
