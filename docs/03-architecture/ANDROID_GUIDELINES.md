# Android Guidelines — SQL Studio Pro

## React Native / Android Specifics

### Font Family
On Android, use system monospace font for code:
```typescript
fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
```

### Haptics
expo-haptics is polyfilled on Android (uses native vibration):
```typescript
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  // Works on Android
```

### Safe Area
Android has status bars and navigation bars. Always use:
```typescript
const insets = useSafeAreaInsets();
paddingTop: Platform.OS === 'web' ? 74 : insets.top + 10
```

### Alert.prompt
`Alert.prompt` is iOS-only. On Android, use a custom modal TextInput for user input.

**Current workaround:** App uses `Alert.prompt` — this works on iOS, falls back gracefully on Android (Expo handles the cross-platform adapter). Watch for Android-specific issues.

**Production fix:** Replace all `Alert.prompt` calls with a proper `Modal + TextInput` component.

### Keyboard Avoidance
```typescript
// Use react-native-keyboard-controller (pre-installed)
import { KeyboardProvider } from 'react-native-keyboard-controller';
```

### Back Button
Android has a hardware back button. Expo Router handles this automatically. Custom back behavior:
```typescript
import { useNavigation } from 'expo-router';
navigation.addListener('beforeRemove', handler);
```

---

## Android Performance

### FlatList Optimization
```typescript
<FlatList
  removeClippedSubviews={true}  // Android: removes off-screen views
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  windowSize={10}
/>
```

### SQLite on Android
- expo-sqlite uses the Android-bundled SQLite (version varies by Android version)
- All SQLite 3.x standard SQL is supported
- WAL mode recommended for performance: `PRAGMA journal_mode=WAL;`

---

## Android Permissions

SQL Studio Pro requires NO special Android permissions:
- ❌ Camera — not used
- ❌ Location — not used
- ❌ Contacts — not used
- ✅ Storage (internal) — auto-granted for app's own directory

For future CSV import from external storage:
- READ_EXTERNAL_STORAGE (Android 10 and below)
- Scoped storage (Android 11+) — handled by expo-document-picker

---

## Material Design

Target: Material Design 3 / Material You

Design principles applied:
- Dynamic colors (system accent where available)
- Elevation and shadows for depth
- Ripple effects on pressable elements
- Consistent corner radius (10dp)
- Typography scale: Display, Headline, Body, Label

---

## Minimum SDK

- Minimum: Android 8.0 (API 26)
- Target: Android 14 (API 34)
- Compile: Android 14 (API 34)

---

*See also: [CODING_STANDARDS.md](./CODING_STANDARDS.md) | [PERFORMANCE_GUIDE.md](../17-performance/PERFORMANCE_GUIDE.md)*
