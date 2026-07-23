# Workflow Document — SQL Studio Pro

## Core User Workflows

---

### Workflow 1: Create and Query a Database

```
User opens app
  → Dashboard screen shown
  → Tap "New Database" quick action or (+) FAB in Databases tab
  → Alert.prompt: Enter database name
  → Database created (expo-sqlite + AsyncStorage)
  → Navigate to Database Detail screen
  → See empty "Tables" tab
  → Tap (+) FAB to create a table
  → Alert.prompt: Enter table name
  → Table created with default schema
  → Navigate to SQL Editor tab
  → Database auto-selected (last used)
  → Write SELECT * FROM tableName;
  → Tap Run button
  → Result shown in bottom grid
```

---

### Workflow 2: Browse Table Data

```
User opens app
  → Navigate to Databases tab
  → Tap a DatabaseCard
  → Database Detail screen shows
  → See tables list with row counts
  → Tap a TableCard
  → Table Viewer screen opens
  → Data tab: see rows in scrollable grid
  → Structure tab: see column definitions
  → Tap code icon (top right)
  → Editor opens with SELECT * FROM table
```

---

### Workflow 3: Use Query History

```
User runs several queries
  → All auto-saved to History tab
  → User navigates to History tab
  → Sees list of past queries with timestamps
  → Search for specific query
  → Tap query → opens in Editor
  → Optionally modify and re-run
```

---

### Workflow 4: Use SQL Templates

```
User wants to create a JOIN query
  → Tap AI (Templates) button in editor or navigate to ai route
  → Browse template categories
  → Tap "Inner Join" template
  → See SQL preview
  → Tap "Use in Editor"
  → Template loaded in editor
  → Modify table names
  → Run query
```

---

### Workflow 5: Export Data

```
User has query results
  → Execute a SELECT query
  → Results shown in grid
  → Tap export icon in result grid
  → Select format: CSV / JSON / SQL
  → File saved to device
  → Share sheet opens
  → Share via email, cloud, etc.
```

---

## Error Workflows

### Invalid SQL
```
User writes invalid SQL → Taps Run
  → expo-sqlite throws error
  → Result area shows red error card
  → Error message displayed
  → Query saved to history as failed
```

### No Database Selected
```
User taps Run without selecting a database
  → Alert: "No Database Selected"
  → Options: Select Database / Cancel
```

---

*See also: [USER_FLOW.md](../04-ui/USER_FLOW.md) | [SCREEN_FLOW.md](../04-ui/SCREEN_FLOW.md)*
