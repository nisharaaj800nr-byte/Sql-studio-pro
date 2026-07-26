# SQL Studio Pro

A professional, offline-first SQLite IDE for mobile, built with Expo + React Native.

## Architecture

**Monorepo (pnpm workspace):**
- `artifacts/mobile/` — Expo React Native app (primary artifact, port 18115)
- `artifacts/api-server/` — Express API server (optional, port 8080)
- `lib/api-zod/` — Shared Zod schemas
- `lib/api-client-react/` — Tanstack Query hooks

## Running the Project

Both workflows start automatically:
- **SQL Studio Pro Mobile** — `PORT=18115 pnpm --filter @workspace/mobile run dev`
- **SQL Studio Pro API** — `PORT=8080 pnpm --filter @workspace/api-server run dev`

## Key Design Decisions

- **100% offline SQL execution** via `expo-sqlite` on-device. No server required for queries.
- **SQL-aware tokenizer** in `artifacts/mobile/utils/sqlDiagnostics.ts` handles statement splitting, classification, and diagnostics without simple semicolon splitting.
- **Schema-aware autocomplete** fetches live schema from SQLite and caches it, invalidated after DDL changes.
- **Mobile-first UI** uses Ionicons throughout for consistent, professional appearance.
- Dark mode tokens: GitHub Dark aesthetic (`#0D1117` background, `#58A6FF` primary).
- Light mode tokens: clean slate palette (`#F1F5F9` background, `#2563EB` primary).

## Project Status

- Phase 1 (Core Stability): ✅ 7/7
- Phase 2 (Professional Features): ✅ 20/20
- Phase 3 (Multi-Language): 🟡 4/13 (SQL + HTML + CSS + JS)
- Phase 4 (Cloud & AI): ⬜ 0/6
- Test suite: ✅ 420/420 passing

## User Preferences

- Mobile-first design; all headers compact (22px title, insets.top + 8 padding)
- Tab bar uses Ionicons (consistent on both iOS and Android)
- Tab bar height: iOS 80px, Android 58px
- Section titles: 14px, fontWeight 700
- Card borders: hairlineWidth, borderRadius 12
- SQL must run 100% locally; AI is optional and never required for SQL execution
