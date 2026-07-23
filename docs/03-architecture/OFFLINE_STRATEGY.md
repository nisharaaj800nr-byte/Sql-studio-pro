# Offline Strategy — SQL Studio Pro

## Offline-First Principle

SQL Studio Pro is **100% offline**. The app has no API calls, no cloud dependencies, and no network requirements whatsoever.

---

## Why Offline-First

1. **Target users** often work in low/no connectivity environments (field work, underground, airplane)
2. **Database files** are local — no reason to send data over the network
3. **Privacy** — data stays on device by design
4. **Reliability** — offline apps never have "server downtime"

---

## Storage Architecture

### SQLite (via expo-sqlite)
- Stores all user database files
- Persisted in app's sandboxed document directory
- Survives app restarts, device reboots
- Deleted only when user explicitly deletes or uninstalls

### AsyncStorage
- Stores metadata: database list, query history, settings, saved queries
- Survives app restarts
- JSON-serialized, key-value store

---

## Data Persistence Guarantees

| Data | Survives App Restart | Survives Device Reboot | Survives Update |
|------|---------------------|----------------------|----------------|
| SQLite databases | ✅ | ✅ | ✅ |
| Database metadata | ✅ | ✅ | ✅ |
| Query history | ✅ | ✅ | ✅ |
| Saved queries | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ |
| Active editor SQL | ❌ | ❌ | ❌ |
| Current query result | ❌ | ❌ | ❌ |

---

## No-Network Features

All features work without network:
- Create/open/delete databases
- Execute SQL queries
- Browse table data
- View schema
- Query history
- SQL templates
- Import CSV (from device storage)
- Export CSV/JSON (to device storage)
- Settings

---

## Future: Optional Cloud Sync (v3.0)

Cloud sync will be opt-in, never required:
- User explicitly enables sync
- End-to-end encrypted
- Works without sync enabled
- Sync disabled = identical experience to today

---

*See also: [BACKUP_STRATEGY.md](../16-operations/BACKUP_STRATEGY.md) | [SECURITY_MODEL.md](../07-security/SECURITY_MODEL.md)*
