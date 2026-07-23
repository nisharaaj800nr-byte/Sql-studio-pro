# Coding Standards — SQL Studio Pro

## TypeScript

### Strict Mode
All files must compile under `strict: true`. No `any` unless absolutely necessary and always commented.

```typescript
// GOOD
const db = item as DatabaseMeta;

// BAD
const db: any = item;
```

### Type Safety
```typescript
// GOOD: explicit types
const [databases, setDatabases] = useState<DatabaseMeta[]>([]);
async function executeQuery(dbId: string, sql: string): Promise<QueryResult>

// BAD: implicit any
const [databases, setDatabases] = useState([]);
```

### Null Handling
```typescript
// GOOD: optional chaining
const name = db?.name ?? 'Unknown';

// BAD: will crash if null
const name = db.name;
```

---

## React Native

### StyleSheet
```typescript
// GOOD: StyleSheet.create at bottom of file
const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800' },
});

// BAD: inline styles
<View style={{ flex: 1, backgroundColor: '#fff' }}>
```

### Colors
```typescript
// GOOD: always use colors from hook
const colors = useColors();
<Text style={{ color: colors.foreground }}>

// BAD: hardcoded hex (except in StyleSheet constants)
<Text style={{ color: '#333' }}>
```

### Imports
```typescript
// GOOD: use @/ alias
import { useColors } from '@/hooks/useColors';

// BAD: relative path
import { useColors } from '../../hooks/useColors';
```

---

## Performance Rules

1. **Never call hooks inside loops or conditions** (React rules)
2. **Use useCallback for functions passed as props** to memoized components
3. **Use FlatList** (not ScrollView + map) for lists of 20+ items
4. **Async SQLite operations** — never block the main thread
5. **Image assets** — use expo-image for caching

---

## No-No List

```typescript
// NO: console.log in production code
console.log('debug');  // ❌

// NO: inline functions in renderItem
renderItem={({ item }) => <Comp onPress={() => doSomething(item)} />}  // ❌ (new fn on every render)

// NO: Array index as key
keyExtractor={(_, i) => i.toString()}  // ❌ (use stable IDs)

// NO: any
const x: any = ...  // ❌

// NO: hardcoded colors
backgroundColor: '#0D1117'  // ❌ (use colors.background)
```

---

## Error Handling

```typescript
// All async SQLite operations must be wrapped in try/catch
try {
  const result = await executeQuery(dbId, sql);
  if (result.error) {
    // Handle gracefully, don't throw
    Alert.alert('Error', result.error);
  }
} catch (e) {
  // Unexpected errors
  console.error('[ExecuteQuery]', e);
  Alert.alert('Unexpected Error', 'Please try again.');
}
```

---

## Commit Standards

Follow Conventional Commits:
```
feat(editor): add line numbers to SQL editor
fix(history): prevent duplicate entries
docs(readme): update setup instructions
refactor(context): extract database color logic
test(sqlite): add unit tests for executeQuery
```

---

*See also: [NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md) | [ANDROID_GUIDELINES.md](./ANDROID_GUIDELINES.md)*
