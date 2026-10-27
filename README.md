# ✨ sql-magic

> The universal, zero-dependency database studio and CLI for **SQLite**, **PostgreSQL**, and **MySQL**.
> Open local `.db` files instantly in the browser or connect to live production databases from the terminal.

[![npm version](https://img.shields.io/badge/npm-v1.0.0-indigo.svg)](https://www.npmjs.com/package/sql-magic)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-emerald.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-51%20passing-brightgreen.svg)]()

---

## ⚡ Quick Start

### 1. Instant CLI (Zero Install)

Run `sql-magic` directly against any local database file or directory:

```bash
# Explore a local SQLite file
npx sql-magic ./app.db

# Scan current directory and list all .db files
npx sql-magic .

# Connect to PostgreSQL (read-only by default)
npx sql-magic postgres://postgres:secret@localhost:5432/mydb

# Connect to MySQL / MariaDB
npx sql-magic mysql://root:secret@127.0.0.1:3306/ecommerce

# Headless query export to stdout
npx sql-magic -q "SELECT id, name, price FROM products LIMIT 5;" ./store.db --format json
```

### 2. Browser-Only Mode (Zero Server, Zero Uploads)

Drag-and-drop any `.sqlite`, `.db`, or `.sqlite3` file directly into the browser. Files **never leave your machine**—all queries run client-side using SQLite WASM in a dedicated Web Worker.

### 3. Docker Container

```bash
docker run --rm -it -p 3000:3000 -v ./data:/data sql-magic /data/app.db
```

---

## 🚀 Key Features

### 🛡️ Security First
- **Read-Only by Default:** Server mode connections enforce read-only transactions at the engine level. Destructive mutations require explicit `--allow-write`.
- **Random Startup Token:** Opens the browser with a cryptographic one-time authentication token (`?token=...`).
- **DNS Rebinding & CSRF Protection:** Validates `Host` and `Origin` headers on every HTTP request.
- **Password Masking:** Connection credentials in logs and UI are masked automatically (`*****`).

### 📊 Virtual Scrolling Data Grid
- **Million-Row Smoothness:** Virtual DOM rendering powered by `@tanstack/react-virtual`.
- **Inline Cell Editing:** Double-click any cell to edit with automated type coercion (integers, floats, booleans, nulls).
- **Row Operations:** Inline `+ Add Row` and `Delete Row` staging.
- **Pending Changes Review Panel:** Inspect staged modifications before atomic transactional commit with visual before/after diffs and SQL previews.
- **Full Undo / Redo:** Multi-level history with `Ctrl+Z` / `Cmd+Z` and `Ctrl+Y` / `Cmd+Shift+Z`.

### 🧭 Visual Schema Designer & Importer
- **Schema Designer:** Create tables, primary keys, composite indexes, alter columns, and drop schema objects through an intuitive GUI.
- **CSV & JSON Import:** Upload tabular data with automated dialect-aware type inference (`inferColumnType`) and batch transactional imports.

### 🔬 Exploration & Power Features
- **Interactive ER Diagram:** Zoomable, draggable canvas mapping tables and foreign key relationships with cubic bezier curves.
- **Column Statistics & Profiler:** Instant null counts, distinct value ratios, averages, and numeric distribution histograms.
- **Quick Results Charts:** 1-click SVG data visualizations (Bar, Line, Area, Donut/Pie, Scatter).
- **Record Inspector:** Expanded record drawer with collapsible syntax-highlighted JSON viewer and 16-byte hexadecimal memory dump for BLOBs.
- **EXPLAIN Plan & Index Advisor:** Visual execution tree showing scan costs and automatically recommending `CREATE INDEX` statements to eliminate sequential scans.
- **Global Command Palette:** Spotlight search modal accessible via `Ctrl+K` or `Cmd+K`.
- **Privacy-Preserving AI Text-to-SQL:** Generate queries from plain English using only table schema DDL—table row data is never transmitted.
- **SQLite PRAGMA Diagnostic Suite:** 1-click execution for `integrity_check`, `foreign_key_check`, `quick_check`, and `VACUUM`.
- **Multi-Database ATTACH:** Manage secondary database attachments for cross-database querying.
- **Shareable Query Links:** 1-click URL copy containing query parameters without exposing confidential data.

---

## 🛠️ CLI Options Reference

| Flag | Description | Default |
| :--- | :--- | :--- |
| `path` | Path to a `.db` file, directory, or connection URL | `.` |
| `-p, --port <number>` | Port for the local web server | `3000` |
| `-H, --host <ip>` | Network interface to bind (`127.0.0.1` or `0.0.0.0`) | `127.0.0.1` |
| `--readonly` | Enforce strict read-only database connections | `true` |
| `--allow-write` | Enable write mutations and DDL commits | `false` |
| `--no-open` | Prevent opening browser automatically | `false` |
| `--no-watch` | Disable live SQLite file & WAL change watcher | `false` |
| `-q, --query <sql>` | Execute SQL query headlessly and exit | `undefined` |
| `-f, --format <format>` | Headless output format (`json` or `csv`) | `json` |
| `-v, --version` | Display installed version | |

---

## 🏗️ Architecture

```
sql-magic Monorepo
├── packages/core       # Unified DbAdapter, SQLite WASM, Node SQLite, Postgres, MySQL
├── packages/server     # Hono REST API, SSE file watcher, security middleware
├── packages/ui         # Vite + React 19 + Tailwind CSS studio (DataGrid, ER, Editor)
└── packages/cli        # npm binary bundling pre-built UI into self-contained package
```

---

## 💻 Development & Contributing

```bash
# Clone repository
git clone https://github.com/mubarek/sql-magic.git
cd sql-magic

# Install dependencies (Node 22+ & pnpm required)
pnpm install

# Run all test suites
pnpm test

# Build all monorepo packages
pnpm build

# Start UI development server
pnpm --filter @sql-magic/ui dev
```

---

## 📄 License

MIT © Mubarek
