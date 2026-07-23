# Architecture — SQL Studio Pro

## Overview

SQL Studio Pro is a **mobile-first, offline-first** React Native (Expo) application. It has no backend server — all data lives on the device.

```
┌─────────────────────────────────────────────────────────┐
│                   User Interface Layer                   │
│  (Expo Router screens, React Native components)          │
├─────────────────────────────────────────────────────────┤
│                  State Management Layer                  │
│  DatabaseContext │ EditorContext │ ThemeContext           │
├─────────────────────────────────────────────────────────┤
│                   Data Access Layer                      │
│  sqliteManager.ts (expo-sqlite) │ AsyncStorage           │
├─────────────────────────────────────────────────────────┤
│                    Storage Layer                         │
│  expo-sqlite (.db files) │ AsyncStorage (metadata)       │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture Decisions

### 1. Expo + React Native (not native Kotlin/Flutter)
**Rationale:** Cross-platform capability (Android + iOS from one codebase), faster development, access to expo-sqlite for native SQLite, large ecosystem.

### 2. expo-sqlite for SQLite Access
**Rationale:** Native SQLite bindings with async API, works in Expo Go, supports all SQL operations including DDL.

### 3. React Context for Global State (not Redux/Zustand)
**Rationale:** App state is simple (two main contexts: databases + editor). Redux/Zustand would add complexity without benefit. Context + AsyncStorage covers all use cases.

### 4. AsyncStorage for Metadata
**Rationale:** Database metadata (names, colors, timestamps) doesn't belong in SQLite. AsyncStorage is simple key-value persistence that works offline.

### 5. File-Based Routing (Expo Router)
**Rationale:** Declarative, predictable, supports deep linking natively, better for navigation testing.

---

## Data Flow

```
User Action
    ↓
Screen Component
    ↓
Context (DatabaseContext / EditorContext)
    ↓
sqliteManager utility
    ↓
expo-sqlite (native SQLite binding)
    ↓
SQLite file on device
    ↓
Result returned up the chain
    ↓
React state updated
    ↓
UI re-renders
```

---

## Key Packages

| Package | Purpose | Version |
|---------|---------|---------|
| expo | SDK & build tooling | ~54.0 |
| expo-router | File-based navigation | ~6.0 |
| expo-sqlite | SQLite database access | ~16.0 |
| expo-haptics | Haptic feedback | ~15.0 |
| @react-native-async-storage/async-storage | Persistent KV store | 2.2.0 |
| react-native-reanimated | Animations | ~4.1 |
| @expo/vector-icons | Icon library | ^15.0 |

---

## Performance Considerations

- All SQLite operations use async API (never blocking main thread)
- Result pagination (100 rows/page default)
- Database stats loaded lazily
- FlatList with keyExtractor for efficient rendering
- Context values memoized where appropriate

---

*See also: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) | [PACKAGE_STRUCTURE.md](./PACKAGE_STRUCTURE.md)*
