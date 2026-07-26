# SQL Studio Pro

A professional SQL Database Management IDE — mobile app (Expo/React Native) with an Express API backend.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run test:sqlite` — regression tests for SQLite SQL classification, statement splitting, and editor warnings
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, requires DATABASE_URL)
- Optional env: `DATABASE_URL` — Postgres connection string (API server starts without it; only needed for remote-connection syncing)
- Optional env: `OPENAI_API_KEY` — enables AI natural-language-to-SQL endpoint at `POST /api/ai/sql`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo 54 + React Native, expo-router (file-based nav), expo-sqlite
- API: Express 5 + pino logging
- DB (server): PostgreSQL + Drizzle ORM (lazy-init — server starts without DATABASE_URL)
- Validation: Zod, drizzle-zod; API codegen via Orval (OpenAPI spec → hooks + schemas)
- Build: esbuild

## Where things live

- Mobile screens: `artifacts/mobile/app/` (tabs: index, databases, editor, history, settings; modal: ai)
- Shared contexts: `artifacts/mobile/contexts/` — DatabaseContext, EditorContext, **SettingsContext** (new)
- SQLite utilities: `artifacts/mobile/utils/sqliteManager.ts`
- Settings persistence: `@sqlstudio_settings_v1` key in AsyncStorage
- Design tokens: `artifacts/mobile/constants/colors.ts` — dark (GitHub) + light themes
- DB schema: `lib/db/src/schema/index.ts` — remoteConnections, savedQueries, queryHistory tables
- API routes: `artifacts/api-server/src/routes/` — health, connections, queries, ai
- Auth middleware: `artifacts/api-server/src/middlewares/auth.ts` — HMAC token + rate limiter

## Architecture decisions

- **Local-first SQLite**: All data lives in expo-sqlite on-device. SERVER is optional — only needed for remote DB sync and AI features. App is fully functional offline.
- **Lazy DB init**: `lib/db/src/index.ts` defers PostgreSQL pool creation until first access. API server starts without DATABASE_URL — only routes that touch the DB will fail.
- **SettingsContext drives behaviour**: Font size, word wrap, row limit, query timeout are runtime settings — components read from SettingsContext, not hardcoded. Persisted to AsyncStorage.
- **No AI key → graceful fallback**: AI tab uses heuristic NL→SQL for common patterns. Complex queries show a clear "configure OPENAI_API_KEY" message instead of crashing.
- **HMAC auth, no JWT library**: Auth middleware uses Node.js built-in `crypto.createHmac` to avoid extra dependencies. Swap for a proper JWT library before public launch.

## Product

SQL Studio Pro is a mobile SQLite IDE for Android/iOS:
- Create and manage local SQLite databases
- Full SQL editor with syntax snippets, auto-format, run button
- Result grid with column auto-sizing, export (CSV/JSON/SQL)
- Database explorer: tables, views, indexes, triggers
- Query history (last 500) and saved queries
- AI Assistant tab: NL→SQL chat + categorised SQL template library
- Settings: font size, word wrap, tab size, row limit, query timeout, export format — all live, persisted

## User preferences

- Keep project as a pnpm monorepo — do not convert to single-package
- Reduce zip exports to exclude .git, .local, node_modules (clean zip only ~2.4MB)

## Setup (first run on a new environment)

```
pnpm install
```

Both workflows start automatically after install. No other setup needed for offline features.

## Gotchas

- `expo-file-system` v57 removed `cacheDirectory`/`documentDirectory` as direct module exports — use `(FileSystem as any).cacheDirectory` pattern (see `exportUtils.ts`)
- expo-document-picker / expo-file-system / expo-sharing are pinned to v57 (vs Expo 54's expected v14/v19). The version-mismatch warning is cosmetic — do NOT downgrade without fixing the Metro file-watcher ENOENT issue first (see Task #4)
- API server uses `SESSION_SECRET` env var for HMAC auth — already configured as a Replit secret
- `DATABASE_URL` not set → DB routes return empty arrays, not errors. Set it via Replit database integration before enabling remote-connection features
- mockup-sandbox workflow is not needed for the main app — only for UI component prototyping

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
