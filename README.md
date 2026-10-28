# ✨ sql-magix

> The universal, high-performance database studio and CLI for **SQLite**, **PostgreSQL**, and **MySQL**.
> Open local `.db` files instantly in the browser or connect to live production databases from the terminal.

[![npm version](https://img.shields.io/badge/npm-v0.1.0-indigo.svg)](https://www.npmjs.com/package/sql-magix)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-emerald.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-51%20passing-brightgreen.svg)]()

---

## ⚡ Quick Start

### 1. Instant CLI (Zero Install)

Run `sql-magix` directly against any local database file, directory, or connection URL:

```bash
# Explore a local SQLite file
npx sql-magix ./app.db

# Scan current directory and list all .db files
npx sql-magix .

# Connect to PostgreSQL (read-only by default)
npx sql-magix postgres://postgres:secret@localhost:5432/mydb

# Connect to MySQL / MariaDB
npx sql-magix mysql://root:secret@127.0.0.1:3306/ecommerce

# Headless query export to stdout
npx sql-magix -q "SELECT id, name, price FROM products LIMIT 5;" ./store.db --format json
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

Then simply start `sql-magix` without any arguments—it automatically detects and loads the connection:

```bash
npx sql-magix
# or in the repository (using pnpm or npm):
pnpm start
# or:
npm start
```
*(The start script auto-detects `pnpm` vs `npm` and builds the bundle if not already present).*

### 3. Switch Databases Directly in the UI ("Connect DB")

When running in Server mode, you can connect or switch to any database on the fly without restarting:
1. Click the **Connect DB** button in the top navigation bar.
2. Enter your connection string (or select from PostgreSQL, MySQL, or local SQLite presets).
3. Choose Read-Only or Read-Write mode and click **Connect**. The studio instantly switches databases and reloads the schema.

### 4. Browser-Only Mode (Zero Server, Zero Uploads)

Drag-and-drop any `.sqlite`, `.db`, or `.sqlite3` file directly into the browser. Files **never leave your machine**—all queries run client-side using SQLite WASM in a dedicated Web Worker.

### 5. Clean Startup with Onboarding

When starting with no database or a blank database, `sql-magix` greets you with a clean, focused onboarding workspace:
- **Open Local File:** Browse or drag-and-drop SQLite database files.
- **Connect Database:** Connect to PostgreSQL, MySQL, or SQLite instances.
- **Design New Table:** Visually create tables with schema, types, and constraints.
- **Import CSV / JSON:** Upload structured data with auto-inferred column types.
- **Paste Starter DDL:** 1-click template insertion into the SQL editor, plus an optional demo dataset loader.

---

## 🚀 Key Features

### 🛡️ Security First
- **Read-Only by Default:** Server mode connections enforce read-only transactions at the engine level. Destructive mutations require explicit `--allow-write`.
- **Random Startup Token:** Opens the browser with a cryptographic one-time authentication token (`?token=...`).
- **DNS Rebinding & CSRF Protection:** Validates `Host` and `Origin` headers on every HTTP request.
- **Password Masking:** Connection credentials in logs and UI are masked automatically (`*****`).

### 📊 Virtual Scrolling Data Grid & Resizable Editor
- **Million-Row Smoothness:** Virtual DOM rendering powered by `@tanstack/react-virtual`.
- **Draggable Resizer Splitter:** Drag the divider between Query Editor and Data Grid to adjust height smoothly, with double-click collapse/expand and persistent height in `localStorage`.
- **CodeMirror 6 with WCAG AAA Syntax Themes:** Accessible, high-contrast syntax highlighting in both Light and Dark modes (custom indigo keywords, ocean blue columns, green strings, amber numbers, red booleans).
- **Inline Cell Editing:** Double-click any cell to edit with automated type coercion (integers, floats, booleans, nulls).
- **Row Operations:** Inline `+ Add Row` and `Delete Row` staging.
- **Pending Changes Review Panel:** Inspect staged modifications before atomic transactional commit with visual before/after diffs and SQL previews.
- **Full Undo / Redo:** Multi-level history with `Ctrl+Z` / `Cmd+Z` and `Ctrl+Y` / `Cmd+Shift+Z`.

### 🧠 Gemini AI SQL Assistant
- **Direct Google Gemini API Integration:** Bring your own Gemini API key (stored securely in browser `localStorage`).
- **`gemini-3.5-flash-lite` by Default:** Utilizes Google's fast, cost-efficient model with automated fallback cascade (`gemini-3.5-flash-lite` → `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.0-flash`).
- **Zero-Data Privacy:** Only table schema DDL (names, types, foreign keys) is shared with Gemini; actual database rows are never transmitted.
- **1-Click Run in Editor:** Generates dialect-aware SQL with a single click to insert and execute.

### 🐘 Smart PostgreSQL Identifier Handling
- **Case-Folding Auto-Fix:** Automatically detects PostgreSQL unquoted identifier errors (`relation "table" does not exist` when table is `"Table"`).
- **1-Click Auto-Quote & Run:** Error banner surfaces an immediate fix button to auto-quote and re-execute.
- **Quoted Navigation:** Clicking tables in Explorer automatically encloses mixed-case names in double quotes.

### 🧭 Visual Schema Designer & Importer
- **Schema Designer:** Create tables, primary keys, composite indexes, alter columns, and drop schema objects through an intuitive GUI.
- **CSV & JSON Import:** Upload tabular data with automated dialect-aware type inference (`inferColumnType`) and batch transactional imports.

### 🔬 Relational ER Diagram & Exploration
- **Interactive Crow's Foot ER Diagram:** Automatic translation of tables and foreign key constraints into standard Crow's Foot ER diagrams (`||--o{`).
- **3 Cohesive View Modes:** Switch smoothly between **Mermaid Diagram**, **Interactive Table Cards**, and **Raw DDL/Syntax** without layout shifting.
- **Custom Theme Variables:** Clean scoped SVG styling eliminating yellow/beige boxes and harsh borders in both light and dark themes.
- **Smart Bezier Connectors:** Links cards through closest edge anchors without reverse loops or overlapping text.
- **Fullscreen Mode & Search:** Expand to full viewport (`Maximize2`) with instant table search highlighting.
- **SQLite PRAGMA Diagnostic Suite:** Instant execution for `integrity_check`, `foreign_key_check`, `quick_check`, and `VACUUM`.
- **Column Statistics & Profiler:** Null counts, distinct value ratios, averages, and numeric distribution histograms.
- **Quick Results Charts:** 1-click SVG data visualizations (Bar, Line, Area, Donut/Pie, Scatter).
- **Record Inspector:** Expanded drawer with syntax-highlighted JSON viewer and 16-byte hex dump for BLOBs.
- **EXPLAIN Plan & Index Advisor:** Visual execution tree showing scan costs and automatically recommending `CREATE INDEX` statements.
- **Global Command Palette:** Spotlight search modal accessible via `Ctrl+K` or `Cmd+K`.

---

## 🛠️ CLI Options Reference

| Flag | Description | Default |
| :--- | :--- | :--- |
| `target` | Path to a `.db` file, directory, or connection URL | `.` |
| `-u, --url <url>` | Explicit database connection URL | `undefined` |
| `-p, --port <number>` | Port for the local web server | `8989` |
| `-H, --host <ip>` | Network interface to bind (`127.0.0.1` or `0.0.0.0`) | `127.0.0.1` |
| `--readonly` | Enforce strict read-only database connections | `true` |
| `--allow-write` | Enable write mutations and DDL commits | `false` |
| `--no-open` | Prevent opening browser automatically | `false` |
| `--no-watch` | Disable live SQLite file & WAL change watcher | `false` |
| `-q, --query <sql>` | Execute SQL query headlessly and exit | `undefined` |
| `-f, --format <format>` | Headless output format (`json` or `csv`) | `json` |
| `--create-sample` | Generate a sample SQLite database populated with demo tables | `undefined` |
| `--demo` | Shortcut to seed and open sample store database | `false` |
| `-v, --version` | Display installed version | |

---

## 🏗️ Architecture

```
sql-magix Monorepo
├── packages/core       # sql-magic-core: Unified DbAdapter, SQLite WASM, Node SQLite, Postgres, MySQL
├── packages/server     # sql-magic-server: Hono REST API, SSE file watcher, security middleware
├── packages/ui         # Vite + React 19 + Tailwind CSS studio (DataGrid, ER, Editor, Designer)
└── packages/cli        # sql-magix: npm binary bundling pre-built UI into self-contained package
```

---

## 💻 Development & Contributing

```bash
# Clone repository
git clone https://github.com/MubarekAdem/sql-magix.git
cd sql-magix

# Install dependencies (works with pnpm or npm)
pnpm install
# or:
npm install

# Run all test suites across all packages (51 tests)
pnpm test
# or:
npm test

# Build all monorepo packages
pnpm build
# or:
npm run build

# Start Studio Server (auto-detects DATABASE_URL from .env or .env.local)
pnpm start
# or:
npm start

# Development mode (concurrent server + UI watch)
pnpm dev
# or:
npm run dev
```

---

## 📄 License

MIT © [Mubarek](https://github.com/MubarekAdem)
