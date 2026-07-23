# State Management — SQL Studio Pro

## Architecture Decision: React Context

SQL Studio Pro uses React Context for global state. This decision was made because:
- App state is simple (two main domains: databases and editor)
- No complex derived state calculations
- No real-time subscriptions
- Avoids Redux/Zustand boilerplate for a mobile-only app

---

## State Map

```
┌─────────────────────────────────────────────────┐
│               DatabaseContext                    │
│                                                 │
│  databases: DatabaseMeta[]          (persisted) │
│  activeDbId: string | null          (ephemeral) │
│  isLoading: boolean                 (ephemeral) │
│                                                 │
│  createDatabase(name, desc)                     │
│  deleteDatabase(id)                             │
│  updateDatabase(id, updates)                    │
│  touchDatabase(id)                              │
│  refreshDatabases()                             │
│  getDb(id)                                      │
│  setActiveDbId(id)                              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│               EditorContext                      │
│                                                 │
│  currentSql: string                 (ephemeral) │
│  queryResult: QueryResult | null    (ephemeral) │
│  isExecuting: boolean               (ephemeral) │
│  queryHistory: QueryHistoryEntry[]  (persisted) │
│  savedQueries: SavedQuery[]         (persisted) │
│                                                 │
│  setCurrentSql(sql)                             │
│  executeQuery(dbId, dbName, sql)                │
│  saveQuery(name, sql, dbId)                     │
│  deleteHistoryEntry(id)                         │
│  deleteSavedQuery(id)                           │
│  clearHistory()                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         Local Component State (useState)         │
│                                                 │
│  search: string          (search bar input)     │
│  activeTab: TabKey       (current tab)          │
│  isLoading: boolean      (data loading)         │
│  items: TableInfo[]      (local data)           │
│  page: number            (pagination)           │
└─────────────────────────────────────────────────┘
```

---

## Persistence Strategy

| State | Persistence | Key |
|-------|------------|-----|
| databases | AsyncStorage | `@sqlstudio_databases_v2` |
| queryHistory | AsyncStorage | `@sqlstudio_history_v1` |
| savedQueries | AsyncStorage | `@sqlstudio_saved_queries_v1` |
| settings | AsyncStorage | `@sqlstudio_settings_v1` |
| currentSql | None (session) | — |
| activeDbId | None (session) | — |
| queryResult | None (session) | — |

---

## Provider Tree

```tsx
<SafeAreaProvider>
  <ErrorBoundary>
    <QueryClientProvider>       {/* React Query (for future API) */}
      <GestureHandlerRootView>
        <KeyboardProvider>
          <DatabaseProvider>   {/* Database state */}
            <EditorProvider>   {/* Editor + history state */}
              <RootLayoutNav />
            </EditorProvider>
          </DatabaseProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  </ErrorBoundary>
</SafeAreaProvider>
```

---

## Update Patterns

### Database CRUD
```typescript
// createDatabase: updates state + persists to AsyncStorage + initializes SQLite db
const db = await createDatabase('mydb');

// deleteDatabase: removes from state + AsyncStorage (SQLite file remains)
await deleteDatabase(id);
```

### Query Execution
```typescript
// executeQuery: 
// 1. Sets isExecuting = true
// 2. Calls sqliteManager.executeQuery()
// 3. Adds to history
// 4. Sets queryResult
// 5. Sets isExecuting = false
// 6. Persists history to AsyncStorage
await executeQuery(dbId, dbName, sql);
```

---

*See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)*
