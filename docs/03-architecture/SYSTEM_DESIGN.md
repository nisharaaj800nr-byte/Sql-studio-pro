# System Design — SQL Studio Pro

## System Overview

SQL Studio Pro is a fully self-contained mobile application with zero server dependencies. The "system" consists of the React Native app and the device's local storage.

---

## Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      EXPO APP BUNDLE                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ DatabaseCtx  │  │  EditorCtx   │  │  React Components │  │
│  │              │  │              │  │                   │  │
│  │ - databases  │  │ - currentSql │  │  Dashboard        │  │
│  │ - activeDbId │  │ - history    │  │  Databases        │  │
│  │ - CRUD ops   │  │ - savedQs    │  │  Editor           │  │
│  └──────┬───────┘  └──────┬───────┘  │  History          │  │
│         │                 │          │  Settings         │  │
│         ▼                 ▼          │  DB Detail        │  │
│  ┌──────────────────────────────┐    │  Table Viewer     │  │
│  │       sqliteManager.ts       │    └───────────────────┘  │
│  │                              │                           │
│  │  executeQuery()              │                           │
│  │  getTables()                 │                           │
│  │  getColumns()                │                           │
│  │  getTableData()              │                           │
│  └──────────────┬───────────────┘                           │
│                 │                                           │
│  ┌──────────────▼───────────────┐                           │
│  │          expo-sqlite          │                           │
│  │   (Native SQLite bindings)    │                           │
│  └──────────────┬───────────────┘                           │
│                 │                                           │
└─────────────────┼───────────────────────────────────────────┘
                  │
    ┌─────────────▼─────────────┐    ┌─────────────────────┐
    │   Device File System       │    │   AsyncStorage       │
    │                           │    │                     │
    │  sqlstudio_db1.db         │    │  @sqlstudio_dbs_v2  │
    │  sqlstudio_db2.db         │    │  (DB metadata JSON) │
    │  sqlstudio_db3.db         │    │                     │
    │  ...                      │    │  @sqlstudio_history │
    └───────────────────────────┘    │  (Query history)    │
                                     └─────────────────────┘
```

---

## Storage Design

### expo-sqlite Files
- Each database is stored as a separate `.db` file
- Named: `sqlstudio_{id}.db` where id is a unique timestamp-based string
- Stored in Expo's document directory (sandboxed, private to app)
- Full SQLite 3.x support

### AsyncStorage Keys

| Key | Content | Type |
|-----|---------|------|
| `@sqlstudio_databases_v2` | Array of DatabaseMeta objects | JSON |
| `@sqlstudio_history_v1` | Array of QueryHistoryEntry objects | JSON |
| `@sqlstudio_saved_queries_v1` | Array of SavedQuery objects | JSON |
| `@sqlstudio_settings_v1` | Settings object | JSON |

---

## Error Handling Strategy

```
SQLite Error
    ↓
Caught in sqliteManager try/catch
    ↓
Returns QueryResult with error field set
    ↓
Context checks error field
    ↓
History entry marked as failed
    ↓
ResultGrid shows red error card
    ↓
User sees error message
```

Unhandled errors → ErrorBoundary → ErrorFallback screen with reload option

---

## Offline Architecture

- Zero API calls needed
- All data local
- App bundle is self-contained
- No service workers, no caching complexity
- Works in airplane mode, underground, on disconnected devices

---

*See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [OFFLINE_STRATEGY.md](./OFFLINE_STRATEGY.md)*
