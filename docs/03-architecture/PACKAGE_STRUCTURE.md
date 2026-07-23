# Package Structure — SQL Studio Pro

## Directory Layout

```
artifacts/mobile/
│
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (providers + Stack)
│   ├── +not-found.tsx            # 404 screen
│   ├── ai.tsx                    # SQL Templates screen (modal)
│   ├── (tabs)/                   # Tab group
│   │   ├── _layout.tsx           # Tab bar layout
│   │   ├── index.tsx             # Dashboard
│   │   ├── databases.tsx         # Database list
│   │   ├── editor.tsx            # SQL editor + results
│   │   ├── history.tsx           # Query history
│   │   └── settings.tsx          # Settings
│   └── database/
│       └── [id]/                 # Database-scoped screens
│           ├── _layout.tsx       # Nested Stack for DB group
│           ├── index.tsx         # Database detail (tables/views/etc)
│           └── table/
│               └── [name].tsx    # Table data viewer
│
├── components/                   # Reusable UI components
│   ├── DatabaseCard.tsx          # Card for a database
│   ├── EmptyState.tsx            # Empty state with icon + text
│   ├── ErrorBoundary.tsx         # React error boundary
│   ├── ErrorFallback.tsx         # Error fallback UI
│   ├── FAB.tsx                   # Floating action button
│   ├── KeyboardAwareScrollViewCompat.tsx
│   ├── QueryHistoryItem.tsx      # History list item
│   ├── ResultGrid.tsx            # Query result grid
│   ├── SQLEditor.tsx             # SQL TextInput with line numbers
│   ├── StatCard.tsx              # Stat display card
│   └── TableCard.tsx             # Table/view list item
│
├── constants/
│   └── colors.ts                 # Design tokens (light + dark)
│
├── contexts/
│   ├── DatabaseContext.tsx       # Database list + CRUD state
│   └── EditorContext.tsx         # SQL editor + history state
│
├── hooks/
│   ├── useColors.ts              # Color scheme aware hook
│   └── use-mobile.tsx            # Mobile detection hook
│
├── utils/
│   ├── sqliteManager.ts          # expo-sqlite wrapper functions
│   ├── sqlHighlight.ts           # SQL tokenizer + highlighting
│   └── formatters.ts             # Bytes, dates, numbers
│
├── assets/
│   └── images/
│       └── icon.png              # App icon
│
├── app.json                      # Expo configuration
└── package.json                  # Dependencies
```

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `DatabaseCard.tsx` |
| Screens | camelCase (expo-router) | `databases.tsx` |
| Utilities | camelCase | `sqliteManager.ts` |
| Hooks | camelCase, `use` prefix | `useColors.ts` |
| Contexts | PascalCase | `DatabaseContext.tsx` |
| Constants | camelCase | `colors.ts` |
| Types/Interfaces | PascalCase | `DatabaseMeta` |

---

## Import Aliases

```typescript
// Use @/ instead of relative paths
import { useColors } from '@/hooks/useColors';
import { SQLEditor } from '@/components/SQLEditor';
import { useDatabases } from '@/contexts/DatabaseContext';
```

---

*See also: [NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md) | [CODING_STANDARDS.md](./CODING_STANDARDS.md)*
