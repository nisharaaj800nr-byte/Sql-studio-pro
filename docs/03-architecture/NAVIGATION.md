# Navigation — SQL Studio Pro

## Navigation Library: Expo Router

Expo Router provides file-based routing for React Native, similar to Next.js. Each file in `app/` becomes a route.

---

## Route Map

```
/                           → app/(tabs)/index.tsx       (Dashboard)
/databases                  → app/(tabs)/databases.tsx   (Database list)
/editor                     → app/(tabs)/editor.tsx      (SQL editor)
/history                    → app/(tabs)/history.tsx     (Query history)
/settings                   → app/(tabs)/settings.tsx    (Settings)
/database/[id]              → app/database/[id]/index.tsx (DB detail)
/database/[id]/table/[name] → app/database/[id]/table/[name].tsx (Table viewer)
/ai                         → app/ai.tsx                 (SQL Templates, modal)
```

---

## Navigation Patterns

### Tab Navigation
Five tabs at the bottom. Tab state preserved when switching.

```
[Dashboard] [Databases] [Editor] [History] [Settings]
```

### Stack Navigation
Pushing detail screens on top of tabs:

```
Databases Tab
  → Push /database/[id]         (Database Detail)
      → Push /database/[id]/table/[name]  (Table Viewer)

Editor Tab
  → Modal /ai                   (SQL Templates)
```

### Navigation Commands

```typescript
// Navigate to a tab
router.push('/(tabs)/editor');

// Navigate to a detail screen
router.push(`/database/${db.id}`);
router.push(`/database/${id}/table/${encodeURIComponent(name)}`);

// Open AI screen as modal
router.push('/ai');

// Go back
router.back();

// Replace current screen
router.replace('/(tabs)/databases');
```

---

## Header Configuration

Headers are configured in `_layout.tsx` files or via `Stack.Screen` inside screen components:

```typescript
// In screen component (for dynamic content)
<Stack.Screen
  options={{
    title: db?.name ?? 'Database',
    headerRight: () => <Pressable onPress={handleAction}><Icon /></Pressable>,
  }}
/>
```

---

## Deep Linking

Schema: `mobile://`

```
mobile://database/db_123456       → Database detail
mobile://database/db_123/table/users → Table viewer
```

Configured in `app.json`:
```json
{
  "scheme": "mobile"
}
```

---

## Tab Layout (iOS 26+ vs Others)

- **iOS 26+:** NativeTabs with liquid glass (system-provided appearance)
- **iOS older / Android / Web:** Classic Tabs with BlurView background (iOS) or solid color (Android)

---

*See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [SCREEN_FLOW.md](../04-ui/SCREEN_FLOW.md)*
