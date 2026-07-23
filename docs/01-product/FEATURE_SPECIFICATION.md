# Feature Specification — SQL Studio Pro

## Feature: SQL Editor

### Description
A multi-line code editor with line numbers, SQL syntax highlighting, and toolbar for executing queries.

### Requirements
- Multi-line TextInput with monospace font (Menlo on iOS, monospace on Android)
- Line number sidebar
- SQL snippet bar for quick keyword insertion: SELECT, FROM, WHERE, INSERT, CREATE TABLE, etc.
- Toolbar: Run, Format, Clear, Save (bookmark)
- Executes via expo-sqlite async API
- Handles SELECT → returns rows+columns
- Handles DML (INSERT/UPDATE/DELETE) → returns rows affected
- Handles DDL (CREATE/DROP/ALTER) → executes and confirms
- Shows execution time in milliseconds

### Edge Cases
- Empty query → alert user
- No database selected → prompt to select
- Syntax error → show error message in result area
- Very long queries → scroll support
- Very wide result sets → horizontal scroll

---

## Feature: Multi-Database Management

### Description
Create, open, rename, and delete multiple SQLite databases stored on-device.

### Requirements
- Each database stored as a separate SQLite file via expo-sqlite
- Database metadata (name, description, color, timestamps) stored in AsyncStorage
- Unique color per database for visual identification
- Last-modified timestamp updated on query execution
- Create: Alert.prompt for name + optional description
- Delete: Confirmation dialog with warning text
- Rename: Alert.prompt pre-filled with current name

---

## Feature: Database Explorer

### Description
Visual browser for database schema: tables, views, indexes, triggers.

### Requirements
- Tabbed interface: Tables | Views | Indexes | Triggers
- Count badge per tab
- Tables show: name, row count
- Views show: name
- Indexes show: name, table
- Triggers show: name
- Tap table → Table Viewer
- Long press → action menu (View Data, Copy SQL, Drop)
- FAB for Create Table (tables tab only)
- Pull-to-refresh

---

## Feature: Table Viewer

### Description
Browse table data and view column structure.

### Requirements
- Data tab: scrollable result grid, pagination (100 rows/page)
- Structure tab: column details (cid, name, type, not null, default, PK)
- Row count in tab label
- Page navigation controls
- Edit button opens editor with SELECT * FROM table

---

## Feature: Query History

### Description
Automatic log of all executed queries with metadata.

### Requirements
- Every query saved with: SQL, database name, timestamp, success flag, row count, execution time
- Max 500 entries, oldest removed automatically
- Search by SQL or database name
- Tap to copy SQL to editor
- Swipe/button to delete individual entries
- Clear all button with confirmation
- Success/failure visual indicators (green/red)

---

## Feature: SQL Templates (AI)

### Description
Library of common SQL query templates for quick-start.

### Requirements
- 12+ templates covering DDL, DQL, DML, PRAGMA, Transaction
- Category filter chips
- Search by title, description, or SQL content
- SQL preview in monospace scroll view
- "Use in Editor" button → copies to editor and navigates
- Category color coding

---

## Feature: Settings

### Description
User preferences for editor and app behavior.

### Requirements
- Theme: System/Dark/Light (default: System)
- Editor font size: 12/14/16/18 (default: 14)
- Auto-complete: toggle
- Result row limit: 50/100/200/500
- Query history entries: count display
- Clear history: confirmation required
- About: version, tech stack, links
- Export format preference: CSV/JSON/SQL

---

*See also: [MODULE_SPECIFICATION.md](./MODULE_SPECIFICATION.md) | [PRODUCT_REQUIREMENTS_DOCUMENT.md](./PRODUCT_REQUIREMENTS_DOCUMENT.md)*
