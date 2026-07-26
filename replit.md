# SQL Studio Pro

A professional, offline-first, multi-language database IDE for mobile — built with Expo (React Native) and an Express API backend.

## Stack

| Layer | Tech |
|-------|------|
| Mobile app | Expo / React Native (expo-router, expo-sqlite) |
| API server | Express 5 + Drizzle ORM + Pino |
| Workspace | pnpm monorepo |
| Language | TypeScript throughout |

## Workspace layout

```
artifacts/
  mobile/          — Expo React Native app (@workspace/mobile)
  api-server/      — Express API server (@workspace/api-server)
  mockup-sandbox/  — Vite component preview sandbox
lib/
  api-client-react/ — React Query hooks for the API
  api-spec/         — Shared OpenAPI / route types
  api-zod/          — Shared Zod schemas
  db/               — Drizzle ORM schema + migrations
scripts/            — Post-merge and utility scripts
```

## How to run

Both services start automatically via the **Project** workflow (run button).

| Service | Command | Port |
|---------|---------|------|
| Mobile (Expo web) | `pnpm --filter @workspace/mobile run dev` | 18115 |
| API server | `pnpm --filter @workspace/api-server run dev` | 8080 |

Install dependencies first if `node_modules` are missing:

```bash
pnpm install
```

The mobile app is an Expo project — use the QR code in the Metro output to open it in Expo Go on a physical device, or press `w` to open the web version.

## Project status

- **Phase 1** (Core Stability) — ✅ Complete
- **Phase 2** (Professional Features: autocomplete, multi-tab, ER diagram, CSV import, etc.) — ✅ Complete
- **Phase 3** (Multi-Language Support: HTML ✅, CSS ✅, JS ✅; React/Python pending) — 🟡 In Progress
- **Phase 4** (Cloud & AI) — ⬜ Not started

See `PROJECT_STATUS.md` for the full task breakdown.

## SQLite verification

Complete SQLite 3 IDE verification was done against the spec in `attached_assets/`. All 10 sections pass:

| Section | Status |
|---------|--------|
| Query types (SELECT, DML, CTE, JOIN, UNION, window, JSON, etc.) | ✅ |
| Schema & DDL (CREATE/ALTER/DROP, constraints, generated cols, WITHOUT ROWID, STRICT) | ✅ |
| SQLite commands (PRAGMA, EXPLAIN, VACUUM, ATTACH, SAVEPOINT, BEGIN variants) | ✅ |
| Execution behavior (bound params, multi-statement, truncation, row limits) | ✅ |
| Schema-aware autocomplete (tables, views, columns, CTEs, aliases, pragmas, functions) | ✅ |
| Diagnostics (syntax errors, constraint violations, dialect detection, warnings) | ✅ |
| Device-local / offline support (expo-sqlite, persistent files, no network required) | ✅ |
| Query editor UX (syntax highlight, error line, warnings, run/format/explain controls) | ✅ |
| Testing — 319 tests across 3 test files, all pass | ✅ |
| Explicit limitation handling (non-SQLite dialect detection + clear warnings) | ✅ |

### Run tests

```bash
cd artifacts/mobile && pnpm test
```

### Known SQLite engine limitations (device-dependent)

- `pow()`, `log()`, `log2()`, `log10()`, `trunc()` require `SQLITE_ENABLE_MATH_FUNCTIONS` — the app gracefully shows "no such function" if the device build omits this.
- `json_*` functions require `SQLITE_ENABLE_JSON1` (compiled in on all modern iOS/Android SQLite builds).
- STRICT tables require SQLite 3.37+; generated columns require SQLite 3.31+.
- Window functions require SQLite 3.25+.

## User preferences
