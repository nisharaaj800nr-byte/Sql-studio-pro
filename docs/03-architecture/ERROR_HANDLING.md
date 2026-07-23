# Error Handling — SQL Studio Pro

## Error Categories

### 1. SQL Errors (Expected)
SQL syntax errors, constraint violations, missing tables — handled gracefully.

```typescript
// sqliteManager returns error in result, never throws
{
  type: 'error',
  error: 'no such table: users',
  columns: [],
  rows: [],
  rowsAffected: 0,
  executionTime: 12,
}
```

UI handling: ResultGrid shows red error card with message.

### 2. AsyncStorage Errors (Rare)
Storage quota exceeded, corrupted data.

```typescript
try {
  await AsyncStorage.setItem(key, JSON.stringify(data));
} catch (e) {
  console.error('[Storage] Failed to persist:', e);
  // App continues but data may not be saved
  // Future: show toast notification
}
```

### 3. SQLite Initialization Errors (Very Rare)
Database file corruption or permission issue.

```typescript
try {
  await openDb(dbId);
} catch (e) {
  // Return error result instead of crashing
  return { type: 'error', error: (e as Error).message, ... };
}
```

### 4. Runtime Errors (Unexpected)
Null reference, undefined property, etc.

**Handler:** `ErrorBoundary` + `ErrorFallback` component.

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

On crash: `ErrorFallback` shows with "Restart App" button (calls `reloadAppAsync()`).

---

## Error Surfaces

| Error Type | User-Facing Surface |
|-----------|-------------------|
| SQL syntax/runtime | Red card in ResultGrid |
| No database selected | Alert dialog |
| Empty query | Alert dialog |
| Delete confirmation | Alert dialog |
| Load failure | Toast / inline message |
| App crash | ErrorFallback screen |

---

## Error Recovery

1. **SQL Error** → User reads error, corrects SQL, re-runs
2. **Load Error** → Pull-to-refresh / retry button
3. **App Crash** → Tap "Restart App" → reloadAppAsync()
4. **Data Corruption** → Clear AsyncStorage (Settings → Clear Data)

---

## Logging Strategy

```typescript
// Development only
if (__DEV__) {
  console.error('[Context]', 'Operation failed:', e);
}

// Production: no console.log
// Future: integrate Sentry for production error tracking
```

---

*See also: [LOGGING.md](./LOGGING.md) | [RISK_REGISTER.md](../18-risk/RISK_REGISTER.md)*
