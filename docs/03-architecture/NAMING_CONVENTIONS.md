# Naming Conventions — SQL Studio Pro

## Files & Directories

| Type | Convention | Examples |
|------|-----------|---------|
| Screen files (Expo Router) | lowercase/camelCase | `databases.tsx`, `editor.tsx`, `[id].tsx` |
| Component files | PascalCase | `SQLEditor.tsx`, `DatabaseCard.tsx` |
| Context files | PascalCase + Context suffix | `DatabaseContext.tsx` |
| Hook files | camelCase + use prefix | `useColors.ts`, `use-mobile.tsx` |
| Utility files | camelCase | `sqliteManager.ts`, `formatters.ts` |
| Constant files | camelCase | `colors.ts` |
| Test files | same as source + `.test.ts` | `sqliteManager.test.ts` |

---

## TypeScript

### Interfaces & Types
```typescript
// Interfaces: PascalCase, describe a noun
interface DatabaseMeta { ... }
interface QueryResult { ... }
interface ColumnInfo { ... }

// Types: PascalCase
type TabKey = 'tables' | 'views' | 'indexes' | 'triggers';
type QueryType = 'select' | 'dml' | 'ddl' | 'error';
```

### Variables & Functions
```typescript
// Variables: camelCase
const activeDbId = ...
const queryHistory = ...

// Functions: camelCase, verb + noun
async function executeQuery(...) { }
async function getTables(...) { }
function formatBytes(...) { }

// Boolean variables: is/has/can prefix
const isLoading = false;
const hasError = true;
const canExecute = true;
```

### Constants
```typescript
// SCREAMING_SNAKE_CASE for true constants
const MAX_HISTORY_ENTRIES = 500;
const PAGE_SIZE = 100;
const STORAGE_KEY = '@sqlstudio_databases_v2';

// PascalCase for component-level arrays/objects
const SQL_SNIPPETS = [...];
const DB_COLORS = [...];
```

### React Components
```typescript
// PascalCase, descriptive, no "Screen" suffix for components
export function DatabaseCard(...) { }
export function EmptyState(...) { }
export function SQLEditor(...) { }

// Screen components exported as default, descriptive with Screen suffix
export default function DatabasesScreen() { }
export default function EditorScreen() { }
```

---

## AsyncStorage Keys

```
@sqlstudio_{entity}_{version}

Examples:
@sqlstudio_databases_v2
@sqlstudio_history_v1
@sqlstudio_saved_queries_v1
@sqlstudio_settings_v1
```

Version suffix allows migration when schema changes.

---

## SQLite File Names

```
sqlstudio_{unique_id}.db

Example: sqlstudio_db_1720000000000_abc12345.db
```

---

## Icon Names (MaterialIcons/MaterialCommunityIcons)

Prefer descriptive icon names from the icon set, matching the semantic action:
- `database` → database symbol
- `table-chart` → table/grid
- `code` → code/editor
- `history` → clock/history
- `play-arrow` → run/execute

---

*See also: [CODING_STANDARDS.md](./CODING_STANDARDS.md) | [PACKAGE_STRUCTURE.md](./PACKAGE_STRUCTURE.md)*
