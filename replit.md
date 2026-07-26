# SQL Studio Pro

A professional, offline-first SQLite IDE for mobile, built with Expo/React Native.

## Project Overview

SQL Studio Pro lets users create and query local SQLite databases entirely on-device — no internet connection required for core SQL execution. It features a professional SQL editor, multi-tab support, schema visualization, and more.

### Stack
- **Mobile**: Expo/React Native (Expo Router, expo-sqlite)
- **API**: Express + Drizzle ORM (optional — not required for SQL execution)
- **Monorepo**: pnpm workspaces

### Architecture
- All SQL execution happens locally via `expo-sqlite` — no data leaves the device
- API server is optional (future cloud/AI features)
- Offline-first: databases persist across app restarts via the device filesystem

## Running the App

```bash
# Install dependencies
pnpm install

# Start mobile dev server (Expo)
pnpm --filter @workspace/mobile run dev

# Start API server (optional)
pnpm --filter @workspace/api-server run dev
```

The mobile app runs on port **18115** (Expo Metro bundler).
Scan the QR code with Expo Go or use the web preview.

### Replit workflows

- **SQL Studio Pro Mobile** — `PORT=18115 pnpm --filter @workspace/mobile run dev`
- **SQL Studio Pro API** — `PORT=8080 pnpm --filter @workspace/api-server run dev`

The API is optional for the offline SQLite editor. If the imported project has no
`node_modules` directory, run `pnpm install` once before starting the mobile
workflow.

## Project Status

- Phase 1 (Core Stability): ✅ 100%
- Phase 2 (Professional Features): ✅ 100%
- Phase 3 (Multi-Language Support): 🟡 31% (SQLite ✅, HTML ✅, CSS ✅, JS ✅)
- Phase 4 (Cloud & AI): ⬜ 0%

Full details in `PROJECT_STATUS.md` and `TRACKER.md`.

## Key Files

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/(tabs)/` — Tab screens (Home, Databases, Editor, Code, History, Settings)
- `artifacts/mobile/components/SQLEditor.tsx` — SQL editor with syntax hints, autocomplete, diagnostics
- `artifacts/mobile/utils/sqliteManager.ts` — SQLite execution engine (expo-sqlite)
- `artifacts/mobile/utils/sqlDiagnostics.ts` — SQL parser, statement classifier, lint warnings
- `artifacts/api-server/` — Express API server (optional)

## User Preferences

- Mobile-first UI: compact headers, tight spacing, no wasted vertical space
- All SQL should execute locally — no internet required for core features
- Error hints, dialect warnings, and lint diagnostics in the editor
- Professional design: dark GitHub-inspired theme, Ionicons, clean tab bar
- Reference direction: compact IDE surfaces, dense database cards, and a dark
  bottom navigation treatment inspired by the supplied SQL Studio Pro screens
