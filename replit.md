# SQL Studio Pro

A professional mobile SQLite IDE built with Expo (React Native) and an Express API backend.

## Project Structure

```
artifacts/
  mobile/        — Expo React Native app (SQL Studio Pro)
  api-server/    — Express TypeScript backend
```

## How to Run

Both services start automatically via Replit workflows:

| Service | Workflow | Port |
|---|---|---|
| Mobile (Expo) | SQL Studio Pro Mobile | 18115 |
| API Server | SQL Studio Pro API | 8080 |

To start manually:
```bash
pnpm install
# Then start both workflows from the Replit workflow panel
```

## Screens

- **Home** — Dashboard with stats, recent databases, quick actions, SQL templates
- **Databases** — List of SQLite databases with search/filter
- **Database Detail** — Schema explorer (tables, views, indexes, triggers)
- **Table View** — Browse and edit table data
- **Editor** — SQL query editor with syntax highlighting and results grid
- **History** — Query execution history
- **Settings** — App configuration, theme, editor preferences
- **AI Assistant** — Natural language to SQL, query explanation

## Stack

- **Mobile**: Expo ~54, React Native, Expo Router, expo-sqlite, expo-file-system
- **API**: Express, TypeScript, esbuild, pino
- **Monorepo**: pnpm workspaces

## User Preferences

- Keep existing architecture and screen structure
- No new screens unless absolutely necessary — improve existing ones
- Target quality: VS Code / TablePlus / Linear level polish
