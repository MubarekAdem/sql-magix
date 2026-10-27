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

Run `sql-magic` directly against any local database file, directory, or connection URL:

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

### 2. Auto-Detect `.env` Connection (`DATABASE_URL`)

Place your database connection string in your project's `.env` or `.env.local`:

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/my_database
# or
POSTGRES_URL=postgres://user:password@localhost:5432/my_database
# or
MYSQL_URL=mysql://root:secret@127.0.0.1:3306/ecommerce
```

Then simply start `sql-magic` without any arguments—it automatically detects and loads the connection:

```bash
npx sql-magic
# or in the monorepo:
pnpm start
```

### 3. Switch Databases Directly in the UI ("Connect DB")

When running in Server mode, you can connect or switch to any database on the fly without restarting:
1. Click the **Connect DB** button in the top navigation bar.
2. Enter your connection string (or select from PostgreSQL, MySQL, or local SQLite presets).
3. Choose Read-Only or Read-Write mode and click **Connect**. The studio instantly switches databases and reloads the schema.

### 4. Browser-Only Mode (Zero Server, Zero Uploads)

Drag-and-drop any `.sqlite`, `.db`, or `.sqlite3` file directly into the browser. Files **never leave your machine**—all queries run client-side using SQLite WASM in a dedicated Web Worker.

### 5. Docker Container

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
- **Mermaid Relational ER Diagram:** Automatic translation of tables and foreign key constraints into standard Crow's Foot ER diagrams (`||--o{`). Switch seamlessly between the rendered interactive SVG, interactive Table Cards, and raw Mermaid markdown code. Features 1-click SVG download and clipboard copying.
- **SQLite PRAGMA Diagnostic Suite:** Redesigned 2-column split-pane layout featuring instant one-click execution for `integrity_check`, `foreign_key_check`, `quick_check`, and `VACUUM`. Displays real-time execution timing with sticky results table.
- **Robi-Compliant Light & Dark Theming:** Clean, accessible 4px-system UI design default to high-contrast white mode (`#ffffff` canvas, subtle slate borders, `#4361ee` indigo accents) with persistent dark-mode toggle (`Ctrl+Shift+L`).
- **Dynamic In-UI Database Switcher:** Switch between SQLite files, PostgreSQL clusters, and MySQL databases directly from the UI header without restarting the dev server.
- **Column Statistics & Profiler:** Instant null counts, distinct value ratios, averages, and numeric distribution histograms.
- **Quick Results Charts:** 1-click SVG data visualizations (Bar, Line, Area, Donut/Pie, Scatter).
- **Record Inspector:** Expanded record drawer with collapsible syntax-highlighted JSON viewer and 16-byte hexadecimal memory dump for BLOBs.
- **EXPLAIN Plan & Index Advisor:** Visual execution tree showing scan costs and automatically recommending `CREATE INDEX` statements to eliminate sequential scans.
- **Global Command Palette:** Spotlight search modal accessible via `Ctrl+K` or `Cmd+K`.
- **Privacy-Preserving AI Text-to-SQL:** Generate queries from plain English using only table schema DDL—table row data is never transmitted.
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

# Start Studio Server (auto-reads DATABASE_URL from .env)
pnpm start

# Or start Server and UI together in development mode
pnpm dev:all

# Or start standalone UI development server (Browser SQLite WASM mode)
pnpm --filter @sql-magic/ui dev
```

---

## 📄 License

MIT © Mubarek
