/**
 * Integration tests for sqliteManager.ts using the sql.js mock of expo-sqlite.
 * These tests run real SQL statements against an in-memory SQLite database.
 */

// Reset the in-memory DB map before each test for isolation
const sqliteMock = require('expo-sqlite');
beforeEach(() => sqliteMock._reset());

import {
  checkIntegrity,
  executeQuery,
  exportDatabaseToSQL,
  exportTableToCSV,
  exportTableToJSON,
  getForeignKeys,
  getSQLCompletionItems,
  getSQLiteCapabilities,
  importCSVToTable,
  importSQLFile,
  insertRow,
  updateRow,
  deleteRow,
  savepointBegin,
  savepointRelease,
  savepointRollback,
} from '../utils/sqliteManager';

// Unique DB id per test to avoid cache collisions between tests
let dbSeq = 0;
function freshDb(): string {
  return `test_${++dbSeq}_${Date.now()}`;
}

// Helper: create a table and optionally insert rows
async function setup(
  dbId: string,
  ddl: string,
  rows: string[] = [],
): Promise<void> {
  await executeQuery(dbId, ddl);
  for (const row of rows) {
    await executeQuery(dbId, row);
  }
}

// ─── Basic CRUD ───────────────────────────────────────────────────────────────

describe('Basic CRUD', () => {
  it('CREATE TABLE', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    expect(r.type).toBe('ddl');
    expect(r.error).toBeUndefined();
  });

  it('INSERT and SELECT', async () => {
    const db = freshDb();
    await setup(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'Alice')");
    const r = await executeQuery(db, 'SELECT * FROM t');
    expect(r.type).toBe('select');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id: 1, name: 'Alice' });
  });

  it('UPDATE', async () => {
    const db = freshDb();
    await setup(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)', [
      "INSERT INTO t VALUES (1, 'Alice')",
    ]);
    const r = await executeQuery(db, "UPDATE t SET name = 'Bob' WHERE id = 1");
    expect(r.type).toBe('dml');
    expect(r.rowsAffected).toBe(1);
  });

  it('DELETE', async () => {
    const db = freshDb();
    await setup(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY)', ["INSERT INTO t VALUES (1)"]);
    const r = await executeQuery(db, 'DELETE FROM t WHERE id = 1');
    expect(r.type).toBe('dml');
    expect(r.rowsAffected).toBe(1);
  });

  it('REPLACE (INSERT OR REPLACE)', async () => {
    const db = freshDb();
    await setup(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, x TEXT)', ["INSERT INTO t VALUES (1, 'a')"]);
    const r = await executeQuery(db, "REPLACE INTO t VALUES (1, 'b')");
    expect(r.type).toBe('dml');
    const sel = await executeQuery(db, 'SELECT x FROM t WHERE id = 1');
    expect(sel.rows[0]).toMatchObject({ x: 'b' });
  });

  it('UPSERT — INSERT … ON CONFLICT DO UPDATE', async () => {
    const db = freshDb();
    await setup(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, x TEXT)', ["INSERT INTO t VALUES (1, 'a')"]);
    const r = await executeQuery(db, "INSERT INTO t VALUES (1, 'c') ON CONFLICT (id) DO UPDATE SET x = EXCLUDED.x");
    expect(r.error).toBeUndefined();
    const sel = await executeQuery(db, 'SELECT x FROM t WHERE id = 1');
    expect(sel.rows[0]).toMatchObject({ x: 'c' });
  });
});

// ─── JOINs ────────────────────────────────────────────────────────────────────

describe('JOINs and subqueries', () => {
  async function joinDb() {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    await executeQuery(db, 'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, amount REAL)');
    await executeQuery(db, "INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob')");
    await executeQuery(db, 'INSERT INTO orders VALUES (10, 1, 99.9), (11, 1, 50), (12, 2, 20)');
    return db;
  }

  it('INNER JOIN', async () => {
    const db = await joinDb();
    const r = await executeQuery(db, 'SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id');
    expect(r.rows).toHaveLength(3);
  });

  it('LEFT JOIN', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE a (id INTEGER)');
    await executeQuery(db, 'CREATE TABLE b (a_id INTEGER, val TEXT)');
    await executeQuery(db, 'INSERT INTO a VALUES (1), (2)');
    await executeQuery(db, "INSERT INTO b VALUES (1, 'x')");
    const r = await executeQuery(db, 'SELECT a.id, b.val FROM a LEFT JOIN b ON a.id = b.a_id');
    expect(r.rows).toHaveLength(2);
  });

  it('CROSS JOIN', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE x (v INTEGER)');
    await executeQuery(db, 'INSERT INTO x VALUES (1),(2)');
    const r = await executeQuery(db, 'SELECT a.v, b.v FROM x a CROSS JOIN x b');
    expect(r.rows).toHaveLength(4);
  });

  it('subquery', async () => {
    const db = await joinDb();
    const r = await executeQuery(db, 'SELECT id FROM users WHERE id IN (SELECT user_id FROM orders)');
    expect(r.rows).toHaveLength(2);
  });

  it('correlated subquery', async () => {
    const db = await joinDb();
    const r = await executeQuery(db,
      'SELECT name FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.amount > 90)'
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: 'Alice' });
  });
});

// ─── CTE and recursive CTE ────────────────────────────────────────────────────

describe('CTE and recursive CTE', () => {
  it('simple CTE', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'WITH cte AS (SELECT 42 AS n) SELECT n FROM cte');
    expect(r.rows[0]).toMatchObject({ n: 42 });
  });

  it('multiple CTEs', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'WITH a AS (SELECT 1 AS n), b AS (SELECT 2 AS n) SELECT a.n + b.n AS total FROM a, b');
    expect(r.rows[0]).toMatchObject({ total: 3 });
  });

  it('recursive CTE', async () => {
    const db = freshDb();
    const r = await executeQuery(db,
      'WITH RECURSIVE cnt(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM cnt WHERE n < 5) SELECT * FROM cnt'
    );
    expect(r.rows).toHaveLength(5);
  });
});

// ─── Aggregates and window functions ─────────────────────────────────────────

describe('Aggregates and window functions', () => {
  async function numDb() {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE nums (grp TEXT, val INTEGER)');
    await executeQuery(db, "INSERT INTO nums VALUES ('a',1),('a',2),('b',3),('b',4)");
    return db;
  }

  it('COUNT, SUM, AVG, MIN, MAX', async () => {
    const db = await numDb();
    const r = await executeQuery(db, 'SELECT COUNT(*) AS c, SUM(val) AS s, AVG(val) AS avg, MIN(val) AS mn, MAX(val) AS mx FROM nums');
    expect(r.rows[0]).toMatchObject({ c: 4, s: 10, mn: 1, mx: 4 });
  });

  it('GROUP BY and HAVING', async () => {
    const db = await numDb();
    const r = await executeQuery(db, 'SELECT grp, SUM(val) AS s FROM nums GROUP BY grp HAVING SUM(val) > 3');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ grp: 'b', s: 7 });
  });

  it('WINDOW — ROW_NUMBER', async () => {
    const db = await numDb();
    const r = await executeQuery(db,
      'SELECT grp, val, ROW_NUMBER() OVER (PARTITION BY grp ORDER BY val) AS rn FROM nums'
    );
    expect(r.rows).toHaveLength(4);
    // rn resets per group
    const aRows = r.rows.filter((row: any) => row.grp === 'a');
    expect(aRows[0]).toMatchObject({ rn: 1 });
  });

  it('WINDOW — RANK', async () => {
    const db = await numDb();
    const r = await executeQuery(db,
      'SELECT val, RANK() OVER (ORDER BY val DESC) AS rnk FROM nums'
    );
    expect(r.rows).toHaveLength(4);
  });
});

// ─── DDL and constraints ──────────────────────────────────────────────────────

describe('DDL and constraints', () => {
  it('PRIMARY KEY + AUTOINCREMENT', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, x TEXT)');
    await executeQuery(db, "INSERT INTO t (x) VALUES ('a')");
    const r = await executeQuery(db, 'SELECT id FROM t');
    expect(r.rows[0]).toMatchObject({ id: 1 });
  });

  it('NOT NULL constraint raises error', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT NOT NULL)');
    const r = await executeQuery(db, 'INSERT INTO t VALUES (1, NULL)');
    expect(r.error).toBeTruthy();
  });

  it('UNIQUE constraint raises error', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER UNIQUE)');
    await executeQuery(db, 'INSERT INTO t VALUES (1)');
    const r = await executeQuery(db, 'INSERT INTO t VALUES (1)');
    expect(r.error).toBeTruthy();
  });

  it('CHECK constraint raises error', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (age INTEGER CHECK (age >= 0))');
    const r = await executeQuery(db, 'INSERT INTO t VALUES (-1)');
    expect(r.error).toBeTruthy();
  });

  it('DEFAULT values', async () => {
    const db = freshDb();
    await executeQuery(db, "CREATE TABLE t (id INTEGER, flag TEXT DEFAULT 'yes')");
    await executeQuery(db, 'INSERT INTO t (id) VALUES (1)');
    const r = await executeQuery(db, 'SELECT flag FROM t');
    expect(r.rows[0]).toMatchObject({ flag: 'yes' });
  });

  it('ALTER TABLE ADD COLUMN', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER)');
    await executeQuery(db, 'ALTER TABLE t ADD COLUMN name TEXT');
    const r = await executeQuery(db, 'PRAGMA table_info(t)');
    expect(r.rows.map((row: any) => row.name)).toContain('name');
  });

  it('ALTER TABLE RENAME TABLE', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE old_name (id INTEGER)');
    await executeQuery(db, 'ALTER TABLE old_name RENAME TO new_name');
    const r = await executeQuery(db, "SELECT name FROM sqlite_master WHERE type='table'");
    expect(r.rows.map((row: any) => row.name)).toContain('new_name');
  });

  it('DROP TABLE', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER)');
    await executeQuery(db, 'DROP TABLE t');
    const r = await executeQuery(db, "SELECT name FROM sqlite_master WHERE type='table'");
    expect(r.rows.map((row: any) => row.name)).not.toContain('t');
  });

  it('CREATE TABLE AS SELECT', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE src (x INTEGER)');
    await executeQuery(db, 'INSERT INTO src VALUES (10),(20)');
    await executeQuery(db, 'CREATE TABLE dst AS SELECT * FROM src');
    const r = await executeQuery(db, 'SELECT COUNT(*) AS c FROM dst');
    expect(r.rows[0]).toMatchObject({ c: 2 });
  });
});

// ─── Indexes, views and triggers ──────────────────────────────────────────────

describe('Indexes, views, and triggers', () => {
  it('CREATE INDEX', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    const r = await executeQuery(db, 'CREATE INDEX idx_name ON t (name)');
    expect(r.error).toBeUndefined();
  });

  it('CREATE UNIQUE INDEX', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, email TEXT)');
    await executeQuery(db, 'CREATE UNIQUE INDEX idx_email ON t (email)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'a@b.com')");
    const r = await executeQuery(db, "INSERT INTO t VALUES (2, 'a@b.com')");
    expect(r.error).toBeTruthy();
  });

  it('CREATE VIEW', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, val INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1, 100)');
    await executeQuery(db, 'CREATE VIEW v AS SELECT id, val * 2 AS doubled FROM t');
    const r = await executeQuery(db, 'SELECT doubled FROM v');
    expect(r.rows[0]).toMatchObject({ doubled: 200 });
  });

  it('CREATE TRIGGER', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, ts TEXT)');
    await executeQuery(db, "CREATE TRIGGER trg AFTER INSERT ON t BEGIN UPDATE t SET ts = 'triggered' WHERE id = NEW.id; END");
    await executeQuery(db, 'INSERT INTO t (id) VALUES (1)');
    const r = await executeQuery(db, 'SELECT ts FROM t WHERE id = 1');
    expect(r.rows[0]).toMatchObject({ ts: 'triggered' });
  });
});

// ─── Transactions and savepoints ──────────────────────────────────────────────

describe('Transactions and savepoints', () => {
  it('BEGIN / COMMIT persists data', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    await executeQuery(db, 'BEGIN');
    await executeQuery(db, 'INSERT INTO t VALUES (42)');
    await executeQuery(db, 'COMMIT');
    const r = await executeQuery(db, 'SELECT x FROM t');
    expect(r.rows[0]).toMatchObject({ x: 42 });
  });

  it('BEGIN / ROLLBACK discards data', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    await executeQuery(db, 'BEGIN');
    await executeQuery(db, 'INSERT INTO t VALUES (42)');
    await executeQuery(db, 'ROLLBACK');
    const r = await executeQuery(db, 'SELECT COUNT(*) AS c FROM t');
    expect(r.rows[0]).toMatchObject({ c: 0 });
  });

  it('SAVEPOINT + RELEASE commits savepoint', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    await savepointBegin(db, 'sp1');
    await executeQuery(db, 'INSERT INTO t VALUES (1)');
    await savepointRelease(db, 'sp1');
    const r = await executeQuery(db, 'SELECT COUNT(*) AS c FROM t');
    expect(r.rows[0]).toMatchObject({ c: 1 });
  });

  it('SAVEPOINT + ROLLBACK TO discards changes', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    await savepointBegin(db, 'sp2');
    await executeQuery(db, 'INSERT INTO t VALUES (99)');
    await savepointRollback(db, 'sp2');
    await savepointRelease(db, 'sp2');
    const r = await executeQuery(db, 'SELECT COUNT(*) AS c FROM t');
    expect(r.rows[0]).toMatchObject({ c: 0 });
  });

  it('rejects invalid savepoint name', async () => {
    const db = freshDb();
    const r = await savepointBegin(db, 'bad-name!');
    expect(r.error).toBeTruthy();
  });
});

// ─── PRAGMA ───────────────────────────────────────────────────────────────────

describe('PRAGMA', () => {
  it('PRAGMA table_info returns columns', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    const r = await executeQuery(db, 'PRAGMA table_info(t)');
    expect(r.type).toBe('pragma');
    const names = r.rows.map((row: any) => row.name);
    expect(names).toContain('id');
    expect(names).toContain('name');
  });

  it('PRAGMA foreign_keys = ON (write)', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'PRAGMA foreign_keys = ON');
    expect(r.type).toBe('pragma');
    expect(r.error).toBeUndefined();
  });

  it('PRAGMA journal_mode', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'PRAGMA journal_mode');
    expect(r.type).toBe('pragma');
    expect(r.rows.length).toBeGreaterThan(0);
  });
});

// ─── EXPLAIN ─────────────────────────────────────────────────────────────────

describe('EXPLAIN', () => {
  it('EXPLAIN returns opcodes', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'EXPLAIN SELECT 1');
    expect(r.type).toBe('explain');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('EXPLAIN QUERY PLAN returns plan', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    const r = await executeQuery(db, 'EXPLAIN QUERY PLAN SELECT * FROM t WHERE id = 1');
    expect(r.type).toBe('explain');
    expect(r.rows.length).toBeGreaterThan(0);
  });
});

// ─── Bound parameters ────────────────────────────────────────────────────────

describe('Bound parameters', () => {
  it('positional ? parameter', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    // Use insertRow which uses bound params internally
    const r = await insertRow(db, 't', { id: 1, name: 'Safe input; DROP TABLE t;--' });
    expect(r.error).toBeUndefined();
    const sel = await executeQuery(db, 'SELECT name FROM t WHERE id = 1');
    expect(sel.rows[0]).toMatchObject({ name: 'Safe input; DROP TABLE t;--' });
  });

  it('SQL injection attempt via user value is neutralised', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await insertRow(db, 't', { id: 1, name: "'; DROP TABLE t; --" });
    // Table must still exist
    const r = await executeQuery(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='t'");
    expect(r.rows).toHaveLength(1);
  });
});

// ─── Multiple statements ──────────────────────────────────────────────────────

describe('Multiple statements', () => {
  it('executes multiple statements in order', async () => {
    const db = freshDb();
    const r = await executeQuery(db,
      'CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1); SELECT x FROM t'
    );
    expect(r.type).toBe('select');
    expect(r.rows[0]).toMatchObject({ x: 1 });
  });
});

// ─── SQL comments and quoted identifiers ─────────────────────────────────────

describe('SQL comments and quoted identifiers', () => {
  it('line comments are ignored', async () => {
    const db = freshDb();
    const r = await executeQuery(db, '-- this is a comment\nSELECT 1 AS n');
    expect(r.rows[0]).toMatchObject({ n: 1 });
  });

  it('block comments are ignored', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT /* ignore me */ 2 AS n');
    expect(r.rows[0]).toMatchObject({ n: 2 });
  });

  it('double-quoted identifiers work', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE "my table" ("my col" INTEGER)');
    await executeQuery(db, 'INSERT INTO "my table" VALUES (7)');
    const r = await executeQuery(db, 'SELECT "my col" FROM "my table"');
    expect(r.rows[0]).toMatchObject({ 'my col': 7 });
  });
});

// ─── Result truncation ────────────────────────────────────────────────────────

describe('Result truncation', () => {
  it('truncation flag is set when result exceeds maxRows', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (n INTEGER)');
    for (let i = 1; i <= 10; i++) {
      await executeQuery(db, `INSERT INTO t VALUES (${i})`);
    }
    const r = await executeQuery(db, 'SELECT n FROM t', 5);
    expect(r.truncated).toBe(true);
    expect(r.rows).toHaveLength(5);
  });

  it('no truncation when results fit within maxRows', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (n INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1),(2),(3)');
    const r = await executeQuery(db, 'SELECT n FROM t', 10);
    expect(r.truncated).toBeUndefined();
    expect(r.rows).toHaveLength(3);
  });

  it('query with explicit LIMIT is not further capped', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (n INTEGER)');
    for (let i = 1; i <= 20; i++) await executeQuery(db, `INSERT INTO t VALUES (${i})`);
    // User asked for LIMIT 5 — we should not inject another LIMIT
    const r = await executeQuery(db, 'SELECT n FROM t LIMIT 5', 100);
    expect(r.rows).toHaveLength(5);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns error for invalid SQL', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT FROM FROM WHERE');
    expect(r.error).toBeTruthy();
    expect(r.type).toBe('error');
  });

  it('returns error for no such table', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT * FROM nonexistent');
    expect(r.error).toBeTruthy();
  });

  it('returns empty result without crashing for empty table', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE empty_t (id INTEGER)');
    const r = await executeQuery(db, 'SELECT * FROM empty_t');
    expect(r.rows).toHaveLength(0);
    expect(r.error).toBeUndefined();
  });

  it('returns error for empty SQL', async () => {
    const db = freshDb();
    const r = await executeQuery(db, '');
    expect(r.error).toBeTruthy();
  });
});

// ─── Import and export ────────────────────────────────────────────────────────

describe('Import and export', () => {
  it('exportTableToCSV', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'Alice'), (2, 'Bob')");
    const csv = await exportTableToCSV(db, 't');
    expect(csv).toContain('id,name');
    expect(csv).toContain('Alice');
    expect(csv).toContain('Bob');
  });

  it('exportTableToCSV escapes commas in values', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (val TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES ('hello, world')");
    const csv = await exportTableToCSV(db, 't');
    expect(csv).toContain('"hello, world"');
  });

  it('exportTableToJSON', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'Alice')");
    const json = await exportTableToJSON(db, 't');
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: 1, name: 'Alice' });
  });

  it('exportDatabaseToSQL', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'Alice')");
    const sql = await exportDatabaseToSQL(db);
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('INSERT INTO');
  });

  it('importCSVToTable', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    const csv = 'id,name\n1,Alice\n2,Bob';
    const { imported, errors } = await importCSVToTable(db, 't', csv);
    expect(imported).toBe(2);
    expect(errors).toHaveLength(0);
    const r = await executeQuery(db, 'SELECT COUNT(*) AS c FROM t');
    expect(r.rows[0]).toMatchObject({ c: 2 });
  });

  it('importSQLFile', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    const result = await importSQLFile(db, 'INSERT INTO t VALUES (99)');
    expect(result.ok).toBe(true);
    const r = await executeQuery(db, 'SELECT x FROM t');
    expect(r.rows[0]).toMatchObject({ x: 99 });
  });
});

// ─── Row-level CRUD helpers ───────────────────────────────────────────────────

describe('Row-level CRUD helpers', () => {
  async function crudDb() {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    return db;
  }

  it('insertRow', async () => {
    const db = await crudDb();
    const r = await insertRow(db, 't', { id: 1, name: 'Test' });
    expect(r.rowsAffected).toBe(1);
  });

  it('updateRow', async () => {
    const db = await crudDb();
    await insertRow(db, 't', { id: 1, name: 'Old' });
    const r = await updateRow(db, 't', 'id', 1, { name: 'New' });
    expect(r.rowsAffected).toBe(1);
  });

  it('deleteRow', async () => {
    const db = await crudDb();
    await insertRow(db, 't', { id: 1, name: 'ToDelete' });
    const r = await deleteRow(db, 't', 'id', 1);
    expect(r.rowsAffected).toBe(1);
  });
});

// ─── Integrity check ──────────────────────────────────────────────────────────

describe('Integrity check', () => {
  it('reports ok for clean database', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER)');
    const { ok, issues } = await checkIntegrity(db);
    expect(ok).toBe(true);
    expect(issues).toHaveLength(0);
  });
});

// ─── SQLite capabilities ──────────────────────────────────────────────────────

describe('getSQLiteCapabilities', () => {
  it('returns version string', async () => {
    const db = freshDb();
    const caps = await getSQLiteCapabilities(db);
    expect(caps.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('reports window function support', async () => {
    const db = freshDb();
    const caps = await getSQLiteCapabilities(db);
    // sql.js ships SQLite 3.40+, so windows should be supported
    expect(typeof caps.supportsWindowFunctions).toBe('boolean');
  });
});

// ─── Autocomplete completions ─────────────────────────────────────────────────

describe('getSQLCompletionItems', () => {
  it('returns tables and columns', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE users (id INTEGER, email TEXT)');
    const items = await getSQLCompletionItems(db);
    expect(items.tables).toContain('users');
    expect(items.columns).toContain('id');
    expect(items.columns).toContain('email');
  });

  it('returns built-in pragmas', async () => {
    const db = freshDb();
    const items = await getSQLCompletionItems(db);
    expect(items.pragmas).toContain('table_info');
    expect(items.pragmas).toContain('foreign_keys');
  });

  it('returns built-in functions', async () => {
    const db = freshDb();
    const items = await getSQLCompletionItems(db);
    expect(items.functions).toContain('count');
    expect(items.functions).toContain('json_extract');
  });

  it('extracts CTE aliases from current SQL', async () => {
    const db = freshDb();
    const items = await getSQLCompletionItems(db, 'WITH my_cte AS (SELECT 1) SELECT * FROM my_cte');
    expect(items.cteAliases).toContain('my_cte');
  });

  it('extracts table aliases from current SQL', async () => {
    const db = freshDb();
    const items = await getSQLCompletionItems(db, 'SELECT u.id FROM users AS u');
    expect(items.tableAliases).toContain('u');
  });
});

// ─── Foreign keys ─────────────────────────────────────────────────────────────

describe('Foreign keys', () => {
  it('getForeignKeys returns FK info', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE parent (id INTEGER PRIMARY KEY)');
    await executeQuery(db, 'CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id))');
    const fks = await getForeignKeys(db, 'child');
    expect(fks).toHaveLength(1);
    expect(fks[0].table).toBe('parent');
    expect(fks[0].from).toBe('parent_id');
  });
});

// ─── Date / time functions ────────────────────────────────────────────────────

describe('Date / time functions', () => {
  it('strftime', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT strftime('%Y', '2024-06-15') AS yr");
    expect(r.rows[0]).toMatchObject({ yr: '2024' });
  });

  it('date()', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT date('2024-01-01', '+1 month') AS d");
    expect(r.rows[0]).toMatchObject({ d: '2024-02-01' });
  });

  it('julianday()', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT julianday('2000-01-01') AS jd");
    expect(typeof (r.rows[0] as any).jd).toBe('number');
  });
});

// ─── String functions ─────────────────────────────────────────────────────────

describe('String functions', () => {
  it('upper / lower', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT upper('hello') AS u, lower('WORLD') AS l");
    expect(r.rows[0]).toMatchObject({ u: 'HELLO', l: 'world' });
  });

  it('substr', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT substr('abcdef', 2, 3) AS s");
    expect(r.rows[0]).toMatchObject({ s: 'bcd' });
  });

  it('replace', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT replace('aabbcc', 'bb', 'XX') AS r");
    expect(r.rows[0]).toMatchObject({ r: 'aaXXcc' });
  });

  it('trim', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT trim('  hello  ') AS t");
    expect(r.rows[0]).toMatchObject({ t: 'hello' });
  });

  it('instr', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT instr('hello world', 'world') AS pos");
    expect(r.rows[0]).toMatchObject({ pos: 7 });
  });
});

// ─── CASE expression ──────────────────────────────────────────────────────────

describe('CASE expression', () => {
  it('simple CASE', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT CASE 1 WHEN 1 THEN 'one' WHEN 2 THEN 'two' ELSE 'other' END AS label");
    expect(r.rows[0]).toMatchObject({ label: 'one' });
  });

  it('searched CASE', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT CASE WHEN 5 > 3 THEN 'yes' ELSE 'no' END AS result");
    expect(r.rows[0]).toMatchObject({ result: 'yes' });
  });
});

// ─── NULL functions ───────────────────────────────────────────────────────────

describe('NULL functions', () => {
  it('COALESCE', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT COALESCE(NULL, NULL, 42) AS v');
    expect(r.rows[0]).toMatchObject({ v: 42 });
  });

  it('IFNULL', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT IFNULL(NULL, 99) AS v');
    expect(r.rows[0]).toMatchObject({ v: 99 });
  });

  it('NULLIF', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT NULLIF(1, 1) AS v');
    expect(r.rows[0]).toMatchObject({ v: null });
  });
});

// ─── CAST and COLLATE ─────────────────────────────────────────────────────────

describe('CAST and COLLATE', () => {
  it('CAST to INTEGER', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT CAST('42' AS INTEGER) AS n");
    expect(r.rows[0]).toMatchObject({ n: 42 });
  });

  it('CAST to REAL', async () => {
    const db = freshDb();
    const r = await executeQuery(db, "SELECT CAST('3.14' AS REAL) AS n");
    expect(typeof (r.rows[0] as any).n).toBe('number');
  });

  it('COLLATE NOCASE', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (name TEXT COLLATE NOCASE)');
    await executeQuery(db, "INSERT INTO t VALUES ('Alice')");
    const r = await executeQuery(db, "SELECT name FROM t WHERE name = 'alice'");
    expect(r.rows).toHaveLength(1);
  });
});

// ─── UNION / INTERSECT / EXCEPT ──────────────────────────────────────────────

describe('Set operations', () => {
  it('UNION ALL', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT 1 AS n UNION ALL SELECT 1 AS n');
    expect(r.rows).toHaveLength(2);
  });

  it('UNION (deduplication)', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT 1 AS n UNION SELECT 1 AS n');
    expect(r.rows).toHaveLength(1);
  });

  it('INTERSECT', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT 1 INTERSECT SELECT 1');
    expect(r.rows).toHaveLength(1);
  });

  it('EXCEPT', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT 1 UNION ALL SELECT 2 EXCEPT SELECT 1');
    expect(r.rows).toHaveLength(1);
  });
});
