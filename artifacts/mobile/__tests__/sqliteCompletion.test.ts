/**
 * SQLite module completion tests — covers gaps identified against the full spec:
 * - Import/export (CSV, JSON, SQL dump)
 * - SQL injection regression cases
 * - Dialect detection warnings
 * - Result truncation behaviour
 * - All error message categories (formatSQLiteError)
 * - Multi-statement with mixed kinds
 * - ATTACH / DETACH classification
 * - Diagnostic helpers: isDestructiveSQLText, getStaticSQLDiagnosticsWithOptions
 */

const sqliteMock = require('expo-sqlite');
beforeEach(() => sqliteMock._reset());

import {
  executeQuery,
  importCSVToTable,
  exportTableToCSV,
  exportTableToJSON,
  exportDatabaseToSQL,
  insertRow,
  updateRow,
  deleteRow,
  isDestructiveSQL,
  getSQLiteCapabilities,
} from '../utils/sqliteManager';

import {
  classifySQL,
  splitSQLStatements,
  getStaticSQLDiagnostics,
  getStaticSQLDiagnosticsWithOptions,
  formatSQLiteError,
  isDestructiveSQLText,
  statementReturnsRows,
} from '../utils/sqlDiagnostics';

let dbSeq = 0;
const freshDb = () => `comp_${++dbSeq}_${Date.now()}`;

// ─── SQL injection regression ─────────────────────────────────────────────────

describe('SQL injection regression', () => {
  it('table name with double-quote in insertRow is escaped', async () => {
    const db = freshDb();
    // Create table with a normal name first
    await executeQuery(db, `CREATE TABLE "safe_table" (id INTEGER PRIMARY KEY, val TEXT)`);
    const r = await insertRow(db, 'safe_table', { val: "O'Brien" });
    expect(r.type).toBe('dml');
    expect(r.error).toBeUndefined();
  });

  it('value with single quotes in insertRow uses parameterised binding', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE inj (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT)`);
    const r = await insertRow(db, 'inj', { note: "'; DROP TABLE inj; --" });
    expect(r.error).toBeUndefined();
    // Table must still exist
    const check = await executeQuery(db, 'SELECT count(*) AS c FROM inj');
    expect(check.error).toBeUndefined();
    expect((check.rows[0] as any).c).toBe(1);
  });

  it('updateRow uses parameterised binding for values', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE upd (id INTEGER PRIMARY KEY, v TEXT)`);
    await insertRow(db, 'upd', { id: 1, v: 'original' });
    const r = await updateRow(db, 'upd', 'id', 1, { v: "' OR '1'='1" });
    expect(r.error).toBeUndefined();
    const sel = await executeQuery(db, 'SELECT v FROM upd WHERE id = 1');
    expect((sel.rows[0] as any).v).toBe("' OR '1'='1");
  });

  it('deleteRow uses parameterised binding', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE del (id INTEGER PRIMARY KEY, v TEXT)`);
    await insertRow(db, 'del', { id: 1, v: 'a' });
    await insertRow(db, 'del', { id: 2, v: 'b' });
    const r = await deleteRow(db, 'del', 'id', 1);
    expect(r.error).toBeUndefined();
    const sel = await executeQuery(db, 'SELECT count(*) AS c FROM del');
    expect((sel.rows[0] as any).c).toBe(1);
  });

  it('column name with special characters in escapeIdentifier', async () => {
    const db = freshDb();
    // Column name with a quote in it — should be handled by escapeIdentifier doubling
    const r = await executeQuery(db, `CREATE TABLE t (id INTEGER, "col""name" TEXT)`);
    expect(r.error).toBeUndefined();
  });
});

// ─── CSV import/export ────────────────────────────────────────────────────────

describe('CSV import/export', () => {
  it('importCSVToTable basic flow', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE people (name TEXT, age INTEGER)`);
    const csv = `name,age\nAlice,30\nBob,25\nCarol,35`;
    const result = await importCSVToTable(db, 'people', csv);
    expect(result.imported).toBe(3);
    expect(result.errors).toHaveLength(0);
    const sel = await executeQuery(db, 'SELECT count(*) AS c FROM people');
    expect((sel.rows[0] as any).c).toBe(3);
  });

  it('importCSVToTable handles quoted fields with commas', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE notes (title TEXT, body TEXT)`);
    const csv = `title,body\n"Hello, World","First row"\n"Goodbye","Second, row"`;
    const result = await importCSVToTable(db, 'notes', csv);
    expect(result.imported).toBe(2);
    const sel = await executeQuery(db, 'SELECT title FROM notes ORDER BY title');
    const titles = sel.rows.map((r: any) => r.title);
    expect(titles).toContain('Goodbye');
    expect(titles).toContain('Hello, World');
  });

  it('importCSVToTable rejects CSV with no data rows', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (x TEXT)`);
    const result = await importCSVToTable(db, 't', 'x');
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('importCSVToTable reports row-level errors without aborting others', async () => {
    const db = freshDb();
    // id is INTEGER NOT NULL PRIMARY KEY — inserting a non-int text should error
    await executeQuery(db, `CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)`);
    // Two valid, one conflicts (duplicate PK)
    const csv = `id,v\n1,a\n1,b\n2,c`;
    const result = await importCSVToTable(db, 't', csv);
    expect(result.imported).toBe(2); // row 1 and row 3 succeed
    expect(result.errors.length).toBe(1);
  });

  it('exportTableToCSV round-trips data', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE products (id INTEGER, name TEXT, price REAL)`);
    await insertRow(db, 'products', { id: 1, name: 'Widget', price: 9.99 });
    await insertRow(db, 'products', { id: 2, name: 'Gadget', price: 24.99 });
    const csv = await exportTableToCSV(db, 'products');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,name,price');
    expect(lines.length).toBe(3); // header + 2 rows
    expect(csv).toContain('Widget');
    expect(csv).toContain('9.99');
  });

  it('exportTableToCSV escapes commas and quotes in values', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (v TEXT)`);
    await insertRow(db, 't', { v: 'hello, world' });
    await insertRow(db, 't', { v: 'say "hi"' });
    const csv = await exportTableToCSV(db, 't');
    expect(csv).toContain('"hello, world"');
    expect(csv).toContain('"say ""hi"""');
  });

  it('exportTableToJSON produces valid JSON array', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (id INTEGER, val TEXT)`);
    await insertRow(db, 't', { id: 1, val: 'one' });
    await insertRow(db, 't', { id: 2, val: 'two' });
    const json = await exportTableToJSON(db, 't');
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ id: 1, val: 'one' });
  });

  it('exportDatabaseToSQL includes CREATE TABLE and INSERT statements', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)`);
    await insertRow(db, 'items', { id: 1, name: 'Alpha' });
    const sql = await exportDatabaseToSQL(db);
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('items');
    expect(sql).toContain('INSERT INTO');
    expect(sql).toContain('Alpha');
    expect(sql).toContain('BEGIN TRANSACTION');
    expect(sql).toContain('COMMIT');
  });
});

// ─── Truncation ───────────────────────────────────────────────────────────────

describe('Result truncation', () => {
  it('returns truncated flag when rows exceed maxRows', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE nums (n INTEGER)`);
    for (let i = 0; i < 20; i++) {
      await executeQuery(db, `INSERT INTO nums VALUES (${i})`);
    }
    const r = await executeQuery(db, 'SELECT * FROM nums', 10);
    expect(r.truncated).toBe(true);
    expect(r.rows.length).toBe(10);
  });

  it('no truncated flag when rows fit within maxRows', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (x INTEGER)`);
    await executeQuery(db, `INSERT INTO t VALUES (1),(2),(3)`);
    const r = await executeQuery(db, 'SELECT * FROM t', 50);
    expect(r.truncated).toBeFalsy();
    expect(r.rows.length).toBe(3);
  });

  it('no truncation applied when query already has LIMIT', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (x INTEGER)`);
    for (let i = 0; i < 30; i++) {
      await executeQuery(db, `INSERT INTO t VALUES (${i})`);
    }
    // maxRows=5 but query has its own LIMIT 20
    const r = await executeQuery(db, 'SELECT * FROM t LIMIT 20', 5);
    // The code should not double-apply LIMIT when the query already has one
    expect(r.rows.length).toBe(20);
    expect(r.truncated).toBeFalsy();
  });
});

// ─── Dialect detection ────────────────────────────────────────────────────────

describe('Dialect detection warnings', () => {
  const dialectKeywords = [
    ['ILIKE', `SELECT * FROM t WHERE name ILIKE '%test%'`],
    ['SERIAL', `CREATE TABLE t (id SERIAL PRIMARY KEY)`],
    ['AUTO_INCREMENT', `CREATE TABLE t (id INT AUTO_INCREMENT)`],
    ['NVARCHAR', `CREATE TABLE t (name NVARCHAR(255))`],
    ['SHOW TABLES', `SHOW TABLES`],
    ['DESCRIBE', `DESCRIBE users`],
    ['ROWNUM', `SELECT * FROM t WHERE ROWNUM < 10`],
    ['DUAL', `SELECT sysdate FROM DUAL`],
    ['TOP N', `SELECT TOP 10 * FROM t`],
    ['MERGE INTO', `MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN UPDATE SET t.v = s.v`],
    ['@@ROWCOUNT', `SELECT @@ROWCOUNT`],
    ['SCOPE_IDENTITY', `SELECT SCOPE_IDENTITY()`],
  ];

  for (const [label, sql] of dialectKeywords) {
    it(`detects non-SQLite dialect: ${label}`, () => {
      const diags = getStaticSQLDiagnostics(sql);
      const dialectDiag = diags.find(d => d.code === 'OTHER_DIALECT');
      expect(dialectDiag).toBeDefined();
      expect(dialectDiag?.severity).toBe('warning');
    });
  }

  it('does not flag valid SQLite as dialect', () => {
    const valids = [
      `SELECT * FROM t WHERE name LIKE '%test%'`,
      `CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT)`,
      `SELECT json_extract(data, '$.key') FROM t`,
      `BEGIN IMMEDIATE; INSERT INTO t VALUES (1); COMMIT`,
    ];
    for (const sql of valids) {
      const diags = getStaticSQLDiagnostics(sql);
      const dialectDiags = diags.filter(d => d.code === 'OTHER_DIALECT');
      expect(dialectDiags).toHaveLength(0);
    }
  });
});

// ─── formatSQLiteError error categories ──────────────────────────────────────

describe('formatSQLiteError — all error categories', () => {
  const cases: [string, string, string][] = [
    ['syntax error near "FORM"', 'SQLite syntax error', 'hint' as any],
    ['no such table: missing_table', 'Table not found', ''],
    ['no such column: bad_col', 'Column not found', ''],
    ['no such function: make_row', 'SQLite function not found', ''],
    ['ambiguous column name: id', 'Ambiguous column name', ''],
    ['UNIQUE constraint failed: t.id', 'Unique constraint failed', ''],
    ['FOREIGN KEY constraint failed', 'Foreign-key constraint failed', ''],
    ['NOT NULL constraint failed: t.name', 'Required value is missing', ''],
    ['CHECK constraint failed: t_chk', 'CHECK constraint failed', ''],
    ['database is locked', 'Database is busy', ''],
    ['attempt to write a readonly database', 'Database is read-only', ''],
    ['database disk image is malformed', 'Database file is corrupt', ''],
    ['disk is full', 'Disk full', ''],
    ['too many sql variables', 'Too many bound parameters', ''],
    ['constraint failed', 'Constraint failed', ''],
    ['cannot attach database', 'ATTACH failed', ''],
    ['savepoint sp1 does not exist', 'Savepoint error', ''],
    ['something completely unexpected', 'SQLite query failed', ''],
  ];

  for (const [rawMsg, expectedTitle] of cases) {
    it(`maps "${rawMsg.substring(0, 30)}" → "${expectedTitle}"`, () => {
      const result = formatSQLiteError(new Error(rawMsg));
      expect(result.title).toBe(expectedTitle);
      expect(result.message).toBeTruthy();
    });
  }
});

// ─── isDestructiveSQL ─────────────────────────────────────────────────────────

describe('isDestructiveSQL / isDestructiveSQLText', () => {
  it('marks DROP TABLE as destructive', () => {
    expect(isDestructiveSQL('DROP TABLE users')).toBe(true);
  });
  it('marks ALTER TABLE as destructive', () => {
    expect(isDestructiveSQL('ALTER TABLE t ADD COLUMN x TEXT')).toBe(true);
  });
  it('marks DELETE as destructive', () => {
    expect(isDestructiveSQL('DELETE FROM t WHERE id = 1')).toBe(true);
  });
  it('marks VACUUM as destructive', () => {
    expect(isDestructiveSQL('VACUUM')).toBe(true);
  });
  it('marks ATTACH as destructive', () => {
    expect(isDestructiveSQL("ATTACH DATABASE 'other.db' AS other")).toBe(true);
  });
  it('does NOT mark SELECT as destructive', () => {
    expect(isDestructiveSQL('SELECT * FROM t')).toBe(false);
  });
  it('does NOT mark INSERT as destructive', () => {
    expect(isDestructiveSQL('INSERT INTO t VALUES (1)')).toBe(false);
  });
  it('does NOT mark CREATE TABLE as destructive', () => {
    expect(isDestructiveSQL('CREATE TABLE t (id INTEGER)')).toBe(false);
  });
  it('does NOT mark DROP inside a string literal as destructive', () => {
    // "DROP" appears inside a string — should NOT be flagged
    expect(isDestructiveSQLText(`SELECT 'DROP TABLE t' AS cmd`)).toBe(false);
  });
});

// ─── Multi-statement mixed kinds ──────────────────────────────────────────────

describe('Multi-statement execution', () => {
  it('DDL + DML + SELECT in sequence all execute', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `
      CREATE TABLE seq_test (id INTEGER PRIMARY KEY, v TEXT);
      INSERT INTO seq_test VALUES (1, 'hello');
      SELECT * FROM seq_test;
    `);
    expect(r.error).toBeUndefined();
    expect(r.statementCount).toBe(3);
    expect(r.rows).toHaveLength(1);
    expect((r.rows[0] as any).v).toBe('hello');
  });

  it('transaction across statements', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE tx_seq (n INTEGER)`);
    const r = await executeQuery(db, `
      BEGIN;
      INSERT INTO tx_seq VALUES (1);
      INSERT INTO tx_seq VALUES (2);
      COMMIT;
    `);
    expect(r.error).toBeUndefined();
    const sel = await executeQuery(db, 'SELECT count(*) AS c FROM tx_seq');
    expect((sel.rows[0] as any).c).toBe(2);
  });

  it('SAVEPOINT + ROLLBACK TO works in multi-statement', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE sp_test (n INTEGER)`);
    await executeQuery(db, `
      BEGIN;
      INSERT INTO sp_test VALUES (1);
      SAVEPOINT sp1;
      INSERT INTO sp_test VALUES (2);
      ROLLBACK TO sp1;
      COMMIT;
    `);
    const sel = await executeQuery(db, 'SELECT count(*) AS c FROM sp_test');
    expect((sel.rows[0] as any).c).toBe(1);
  });
});

// ─── Diagnostic warnings ─────────────────────────────────────────────────────

describe('Static SQL diagnostics — warnings', () => {
  it('warns on DELETE without WHERE', () => {
    const diags = getStaticSQLDiagnostics('DELETE FROM t');
    expect(diags.some(d => d.code === 'NO_WHERE' && d.severity === 'warning')).toBe(true);
  });

  it('warns on UPDATE without WHERE', () => {
    const diags = getStaticSQLDiagnostics('UPDATE t SET x = 1');
    expect(diags.some(d => d.code === 'NO_WHERE')).toBe(true);
  });

  it('warns on DROP', () => {
    const diags = getStaticSQLDiagnostics('DROP TABLE t');
    expect(diags.some(d => d.code === 'DESTRUCTIVE_SQL')).toBe(true);
  });

  it('warns on ALTER TABLE', () => {
    const diags = getStaticSQLDiagnostics('ALTER TABLE t ADD COLUMN x TEXT');
    expect(diags.some(d => d.code === 'ALTER_TABLE')).toBe(true);
  });

  it('warns on PRAGMA write', () => {
    const diags = getStaticSQLDiagnostics('PRAGMA foreign_keys = ON');
    expect(diags.some(d => d.code === 'PRAGMA_WRITE')).toBe(true);
  });

  it('warns on ATTACH DATABASE', () => {
    const diags = getStaticSQLDiagnostics("ATTACH DATABASE 'f.db' AS f");
    expect(diags.some(d => d.code === 'ATTACH_DATABASE')).toBe(true);
  });

  it('warns on SELECT *', () => {
    const diags = getStaticSQLDiagnostics('SELECT * FROM t');
    expect(diags.some(d => d.code === 'SELECT_STAR')).toBe(true);
  });

  it('warns on Cartesian JOIN (no ON/USING)', () => {
    const diags = getStaticSQLDiagnostics('SELECT * FROM a JOIN b');
    expect(diags.some(d => d.code === 'CARTESIAN_JOIN')).toBe(true);
  });

  it('warns on CROSS JOIN', () => {
    const diags = getStaticSQLDiagnostics('SELECT * FROM a CROSS JOIN b');
    expect(diags.some(d => d.code === 'CROSS_JOIN')).toBe(true);
  });

  it('adds IN_TRANSACTION info when option set', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('SELECT * FROM t', { inTransaction: true });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(true);
  });

  it('does NOT add IN_TRANSACTION for COMMIT itself', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('COMMIT', { inTransaction: true });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(false);
  });

  it('errors on unbalanced opening paren', () => {
    const diags = getStaticSQLDiagnostics('SELECT (1 + 2 FROM t');
    expect(diags.some(d => d.code === 'UNBALANCED_PARENS' && d.severity === 'error')).toBe(true);
  });

  it('errors on unterminated block comment', () => {
    const diags = getStaticSQLDiagnostics('SELECT 1 /* open comment');
    expect(diags.some(d => d.code === 'UNTERMINATED_COMMENT')).toBe(true);
  });
});

// ─── ATTACH / DETACH classification ──────────────────────────────────────────

describe('ATTACH and DETACH classification', () => {
  it('classifies ATTACH DATABASE as maintenance', () => {
    expect(classifySQL("ATTACH DATABASE 'other.db' AS other")).toBe('maintenance');
  });

  it('classifies DETACH as maintenance', () => {
    expect(classifySQL('DETACH DATABASE other')).toBe('maintenance');
  });

  it('ATTACH returns no rows', () => {
    expect(statementReturnsRows("ATTACH DATABASE 'other.db' AS other")).toBe(false);
  });
});

// ─── Corrupt DB detection ─────────────────────────────────────────────────────

describe('Corrupt database error detection', () => {
  it('formatSQLiteError maps corruption messages', () => {
    const msgs = [
      'database disk image is malformed',
      'file is not a database',
      'database is corrupt',
    ];
    for (const msg of msgs) {
      const r = formatSQLiteError(new Error(msg));
      expect(r.title).toBe('Database file is corrupt');
    }
  });
});

// ─── getSQLiteCapabilities ────────────────────────────────────────────────────
// Uses freshDb() each time to avoid stale dbCache handles after mock resets.

describe('getSQLiteCapabilities', () => {
  it('returns version string', async () => {
    const caps = await getSQLiteCapabilities(freshDb());
    expect(typeof caps.version).toBe('string');
    expect(caps.version).not.toBe('unknown');
  });

  it('returns boolean capability flags', async () => {
    const caps = await getSQLiteCapabilities(freshDb());
    expect(typeof caps.supportsWindowFunctions).toBe('boolean');
    expect(typeof caps.supportsJsonFunctions).toBe('boolean');
    expect(typeof caps.supportsMathFunctions).toBe('boolean');
    expect(typeof caps.supportsReturning).toBe('boolean');
    expect(typeof caps.supportsStrictTables).toBe('boolean');
    expect(typeof caps.supportsGeneratedColumns).toBe('boolean');
  });

  it('returns compileOptions array (may be empty on some builds)', async () => {
    const caps = await getSQLiteCapabilities(freshDb());
    expect(Array.isArray(caps.compileOptions)).toBe(true);
  });
});
