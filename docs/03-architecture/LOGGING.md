# Logging — SQL Studio Pro

## Current Logging Strategy

SQL Studio Pro uses **minimal logging** in v1.0. No analytics or crash reporting without user consent.

---

## Development Logging

```typescript
// Use __DEV__ guard for all debug logs
if (__DEV__) {
  console.log('[DatabaseContext] Loaded databases:', databases.length);
  console.error('[SQLiteManager] Query failed:', error);
}
```

### Log Format
```
[ComponentName] Action: details
```

### Log Levels (Development)
- `console.log` — informational
- `console.warn` — unexpected but recoverable
- `console.error` — failures that need attention

---

## Production Logging (v1.0)

**None.** No production logs, no analytics, no telemetry.

---

## Future: Crash Reporting (v2.0)

Plan to integrate **Sentry** with:
- User consent required (opt-in)
- No database content ever sent
- Only stack traces and device info
- Anonymized user ID

```typescript
// Future implementation
if (settings.crashReportingEnabled) {
  Sentry.captureException(error);
}
```

---

## What We Will NEVER Log

- Database file contents
- SQL query text
- Query results or column names
- Any user data

---

## Query Execution Logging (In-App)

All queries are logged locally in the query history:

```typescript
const historyEntry: QueryHistoryEntry = {
  id: generateId(),
  sql: sql,
  databaseId: dbId,
  databaseName: dbName,
  timestamp: new Date().toISOString(),
  success: !result.error,
  rowCount: result.rows.length,
  executionTime: result.executionTime,
};
```

This is stored on-device only, never transmitted.

---

*See also: [ERROR_HANDLING.md](./ERROR_HANDLING.md) | [ANALYTICS.md](../14-analytics/ANALYTICS.md)*
