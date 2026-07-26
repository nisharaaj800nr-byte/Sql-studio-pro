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
- **Phase 3** (Multi-Language Support: HTML, CSS, JS, Python, etc.) — 🟡 In Progress
- **Phase 4** (Cloud & AI) — ⬜ Not started

See `PROJECT_STATUS.md` for the full task breakdown.

## User preferences
