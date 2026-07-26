# SQL Studio Pro

A professional, offline-first SQLite 3 IDE for mobile — built with Expo (React Native) and an Express API backend.

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

After importing or cloning, install dependencies first:

```bash
pnpm install
```

Then build the shared lib packages (required for API typecheck):

```bash
npx tsc --build lib/api-zod/tsconfig.json lib/db/tsconfig.json
```

Both services start automatically via the **Project** workflow (run button).

| Service | Command | Port |
|---------|---------|------|
| Mobile (Expo web) | `pnpm --filter @workspace/mobile run dev` | 18115 |
| API server | `pnpm --filter @workspace/api-server run dev` | 8080 |

The mobile app is an Expo project — scan the QR code in Metro output to open in Expo Go on a physical device, or press `w` for the web version.

## Running tests

```bash
cd artifacts/mobile && pnpm test
```

All 329 tests run in-process via Jest + sql.js (no device required).

## SQLite execution

All core SQL runs **locally on the device** via `expo-sqlite`. The API server is optional (AI features, sync). No SQL is ever sent to the server.

Supported:
- All DML: SELECT, INSERT, UPDATE, DELETE, REPLACE, UPSERT (INSERT … ON CONFLICT)
- All DDL: CREATE/ALTER/DROP TABLE, VIEW, INDEX, TRIGGER
- CTEs (WITH, WITH RECURSIVE), window functions, JSON functions, aggregate FILTER
- PRAGMA (read + write), EXPLAIN, EXPLAIN QUERY PLAN
- Transactions: BEGIN DEFERRED/IMMEDIATE/EXCLUSIVE, COMMIT, ROLLBACK
- SAVEPOINTs: SAVEPOINT, RELEASE, ROLLBACK TO
- Maintenance: VACUUM, ANALYZE, REINDEX, ATTACH, DETACH
- Multi-statement input (SQL-aware tokenizer, not a naive semicolon split)

## Project status

- **Phase 1** (Core Stability) — ✅ Complete
- **Phase 2** (Professional Features) — ✅ Complete
- **Phase 3** (Multi-Language: HTML ✅, CSS ✅, JS ✅) — 🟡 In Progress
- **Phase 4** (Cloud & AI) — ⬜ Planned

See `PROJECT_STATUS.md` and `TRACKER.md` for detailed task tracking.

## Setup verification (2026-07-26)

After import, `pnpm install` was run to install all 1200 packages. Both workflows
confirmed running:

| Check | Result |
|-------|--------|
| `pnpm install` | ✅ 1200 packages installed |
| Mobile workflow (Expo, port 18115) | ✅ Running — Metro bundler up |
| API workflow (Express, port 8080) | ✅ Running — server listening |
| Mobile typecheck (`tsc --noEmit`) | ✅ No errors |
| API build (`node build.mjs`) | ✅ dist/index.mjs built in ~155 ms |
| Mobile tests (`jest --runInBand`) | ✅ 408 tests passed, 0 failed |

## User preferences

- Keep existing project structure and stack — do not restructure or migrate.
- SQL execution must remain fully local/offline; the API server must never be required for core SQL.
- Tests must run headlessly (Jest + sql.js mock, no device/emulator needed).
- Documentation (TRACKER.md, PROJECT_STATUS.md, replit.md) must be updated after each significant milestone.
