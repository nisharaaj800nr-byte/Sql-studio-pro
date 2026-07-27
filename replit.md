# SQL Studio Pro

A professional, offline-first, multi-language database IDE for mobile (Expo/React Native) with a companion API server.

## Stack

- **Mobile app**: Expo (React Native) — `artifacts/mobile`
- **API server**: Express + Drizzle ORM — `artifacts/api-server`
- **Shared libraries**: `lib/` (api-client-react, api-spec, api-zod, db)
- **Package manager**: pnpm workspace

## Running the project

Dependencies must be installed first:

```
pnpm install
```

Both services run in parallel via the configured workflows:

| Workflow | Command | Port |
|----------|---------|------|
| SQL Studio Pro Mobile | `PORT=18115 pnpm --filter @workspace/mobile run dev` | 18115 |
| SQL Studio Pro API | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |

The mobile app is an Expo project — scan the QR code in the workflow logs with **Expo Go** on your phone, or open the web preview at the Mobile workflow's port.

## Database storage and permissions

- SQLite database files are stored locally in the app-private `documentDirectory/SQLite/` folder as `sqlstudio_<database-id>.db`.
- The database list, names, descriptions, and timestamps are stored separately in AsyncStorage.
- On web, SQLite uses browser storage (IndexedDB) rather than a device file.
- Database operations do not require camera, location, contacts, or broad storage permissions.
- SQL/CSV/database imports use the platform Document Picker, which grants access to the selected file only.
- iOS Files app exposure is enabled with `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`; Android uses the system picker without a broad storage permission.

## Project status

See `PROJECT_STATUS.md` for the detailed feature tracker. As of import:

- Phase 1 (Core Stability) — ✅ Complete
- Phase 2 (Professional Features) — ✅ Complete
- Phase 3 (Multi-Language Support) — 🟡 31% (SQLite, HTML, CSS, JS done)
- Phase 4 (Cloud & AI) — ⬜ Not started

## User preferences

<!-- Add preferences here as they are established -->
