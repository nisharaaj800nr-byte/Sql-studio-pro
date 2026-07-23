# Module Specification — SQL Studio Pro

## Module: Dashboard (Home)

**Route:** `/(tabs)/` (index)  
**Purpose:** Overview screen with stats and quick navigation.

### Components
- App header with logo and version
- Stats row: Total Databases, Total Queries, Tables count
- Recent Databases list (last 5)
- Quick action buttons: New Database, Open Editor, Templates
- Recent queries preview (last 3)

### Data Sources
- DatabaseContext: databases array
- EditorContext: queryHistory
- Computed: total table count across all DBs

---

## Module: Databases

**Route:** `/(tabs)/databases`  
**Purpose:** Create, manage, and navigate to databases.

### Components
- Search bar
- FAB (create)
- DatabaseCard list (FlatList)
- Empty state with CTA
- Pull-to-refresh

### State
- Local: search string, dbStats map
- Global: DatabaseContext (databases, create, delete)

---

## Module: SQL Editor

**Route:** `/(tabs)/editor`  
**Purpose:** Write and execute SQL queries.

### Components
- Database selector bar (top)
- SQLEditor (TextInput with line numbers)
- SQL snippet horizontal scroll
- Run/Format/Clear/Save toolbar
- Divider handle
- ResultGrid or EmptyState (bottom)

### State
- Global: EditorContext (currentSql, queryResult, isExecuting)
- Global: DatabaseContext (databases, activeDbId)

---

## Module: Query History

**Route:** `/(tabs)/history`  
**Purpose:** Browse and reuse past queries.

### Components
- Search bar
- Stats bar (total, success, failed)
- FlatList of QueryHistoryItem
- Empty state
- Clear all button

### State
- Global: EditorContext (queryHistory, deleteHistoryEntry, clearHistory)

---

## Module: Settings

**Route:** `/(tabs)/settings`  
**Purpose:** Configure app preferences.

### Components
- ScrollView with grouped sections
- SettingRow component (icon + label + right element)
- Section headers
- Switch toggles for boolean settings

---

## Module: Database Detail

**Route:** `/database/[id]/`  
**Purpose:** Explore schema of a specific database.

### Components
- Tabbed interface (Tables/Views/Indexes/Triggers)
- TableCard list
- FAB for create table
- Info bar with DB color dot, name, Query button

---

## Module: Table Viewer

**Route:** `/database/[id]/table/[name]`  
**Purpose:** Browse table data and structure.

### Components
- Tab bar (Data/Structure)
- ResultGrid for data
- Structure table (columns)
- Pagination controls

---

## Module: SQL Templates (AI)

**Route:** `/ai`  
**Purpose:** SQL template library and reference.

### Components
- Search bar
- Category filter chips
- Template card (title, description, SQL preview, Use button)

---

*See also: [FEATURE_SPECIFICATION.md](./FEATURE_SPECIFICATION.md)*
