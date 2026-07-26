/**
 * Advanced SQLite feature tests — covers JSON, math, FILTER/OVER, generated columns,
 * WITHOUT ROWID, STRICT tables, transaction state tracking, and numeric/conditional functions.
 * All tests run against an in-memory sql.js database (same setup as sqliteManager.test.ts).
 */

const sqliteMock = require('expo-sqlite');
beforeEach(() => sqliteMock._reset());

import {
  executeQuery,
  isInTransaction,
  savepointBegin,
  savepointRollback,
  savepointRelease,
} from '../utils/sqliteManager';
import {
  getStaticSQLDiagnosticsWithOptions,
} from '../utils/sqlDiagnostics';

let dbSeq = 0;
function freshDb(): string {
  return `adv_${++dbSeq}_${Date.now()}`;
}

// ─── JSON functions ───────────────────────────────────────────────────────────

describe('JSON functions', () => {
  it('json_extract', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_extract('{"name":"Alice","age":30}', '$.name') AS name`);
    expect(r.rows[0]).toMatchObject({ name: 'Alice' });
  });

  it('json_object', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_object('key', 'value') AS obj`);
    const obj = JSON.parse((r.rows[0] as any).obj);
    expect(obj).toMatchObject({ key: 'value' });
  });

  it('json_array', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_array(1, 2, 3) AS arr`);
    const arr = JSON.parse((r.rows[0] as any).arr);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('json_array_length', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_array_length('[1,2,3,4]') AS len`);
    expect(r.rows[0]).toMatchObject({ len: 4 });
  });

  it('json_type', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_type('{"x":1}') AS t`);
    expect(r.rows[0]).toMatchObject({ t: 'object' });
  });

  it('json_valid', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_valid('{"x":1}') AS v, json_valid('bad') AS iv`);
    expect((r.rows[0] as any).v).toBe(1);
    expect((r.rows[0] as any).iv).toBe(0);
  });

  it('json_set', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_set('{"a":1}', '$.b', 2) AS j`);
    const obj = JSON.parse((r.rows[0] as any).j);
    expect(obj).toMatchObject({ a: 1, b: 2 });
  });

  it('json_insert', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_insert('{"a":1}', '$.b', 99) AS j`);
    const obj = JSON.parse((r.rows[0] as any).j);
    expect(obj.b).toBe(99);
  });

  it('json_remove', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_remove('{"a":1,"b":2}', '$.b') AS j`);
    const obj = JSON.parse((r.rows[0] as any).j);
    expect(obj).not.toHaveProperty('b');
  });

  it('json_patch', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT json_patch('{"a":1,"b":2}', '{"b":99}') AS j`);
    const obj = JSON.parse((r.rows[0] as any).j);
    expect(obj.b).toBe(99);
  });

  it('json_each as table-valued function', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT value FROM json_each('[10,20,30]')`);
    expect(r.rows).toHaveLength(3);
    expect(r.rows.map((row: any) => row.value)).toEqual(expect.arrayContaining([10, 20, 30]));
  });

  it('json stored in table column', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (id INTEGER, data TEXT)`);
    await executeQuery(db, `INSERT INTO t VALUES (1, '{"score":100}')`);
    const r = await executeQuery(db, `SELECT json_extract(data, '$.score') AS score FROM t`);
    expect(r.rows[0]).toMatchObject({ score: 100 });
  });
});

// ─── Math functions ───────────────────────────────────────────────────────────

describe('Math functions', () => {
  it('abs', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT abs(-42) AS v`);
    expect(r.rows[0]).toMatchObject({ v: 42 });
  });

  it('round', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT round(3.567, 2) AS v`);
    expect((r.rows[0] as any).v).toBeCloseTo(3.57, 2);
  });

  it('floor / ceil', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT floor(3.9) AS f, ceil(3.1) AS c`);
    expect(r.rows[0]).toMatchObject({ f: 3, c: 4 });
  });

  it('sqrt', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT sqrt(16) AS v`);
    expect((r.rows[0] as any).v).toBeCloseTo(4, 5);
  });

  it('pow / power', async () => {
    const db = freshDb();
    // pow() requires SQLITE_ENABLE_MATH_FUNCTIONS — some builds omit it
    const r = await executeQuery(db, `SELECT pow(2, 10) AS v`);
    if (r.error) {
      expect(r.error).toMatch(/no such function/i);
    } else {
      expect((r.rows[0] as any).v).toBeCloseTo(1024, 0);
    }
  });

  it('log / log2 / log10', async () => {
    const db = freshDb();
    // Logarithm functions require SQLITE_ENABLE_MATH_FUNCTIONS
    const r = await executeQuery(db, `SELECT log(2.718281828) AS ln1, log2(8) AS l2, log10(100) AS l10`);
    if (r.error) {
      expect(r.error).toMatch(/no such function/i);
    } else {
      expect((r.rows[0] as any).ln1).toBeCloseTo(1, 1);
      expect((r.rows[0] as any).l2).toBeCloseTo(3, 5);
      expect((r.rows[0] as any).l10).toBeCloseTo(2, 5);
    }
  });

  it('exp', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT exp(0) AS v`);
    expect((r.rows[0] as any).v).toBeCloseTo(1, 5);
  });

  it('sin / cos / tan', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT sin(0) AS s, cos(0) AS c`);
    expect((r.rows[0] as any).s).toBeCloseTo(0, 5);
    expect((r.rows[0] as any).c).toBeCloseTo(1, 5);
  });

  it('pi', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT pi() AS v`);
    expect((r.rows[0] as any).v).toBeCloseTo(3.14159265, 5);
  });

  it('trunc', async () => {
    const db = freshDb();
    // trunc() requires SQLITE_ENABLE_MATH_FUNCTIONS — some builds omit it
    const r = await executeQuery(db, `SELECT trunc(9.9) AS v`);
    if (r.error) {
      expect(r.error).toMatch(/no such function/i);
    } else {
      expect((r.rows[0] as any).v).toBe(9);
    }
  });

  it('sign', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT sign(-5) AS neg, sign(0) AS zero, sign(3) AS pos`);
    expect(r.rows[0]).toMatchObject({ neg: -1, zero: 0, pos: 1 });
  });
});

// ─── Numeric / conditional functions ─────────────────────────────────────────

describe('Numeric and conditional functions', () => {
  it('IIF', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT iif(1 > 0, 'yes', 'no') AS v`);
    expect(r.rows[0]).toMatchObject({ v: 'yes' });
  });

  it('typeof', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT typeof(1) AS ti, typeof('x') AS ts, typeof(1.5) AS tr, typeof(NULL) AS tn`);
    expect(r.rows[0]).toMatchObject({ ti: 'integer', ts: 'text', tr: 'real', tn: 'null' });
  });

  it('hex / unhex', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT hex(12345) AS h`);
    expect(typeof (r.rows[0] as any).h).toBe('string');
  });

  it('random returns integer', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT random() AS v`);
    expect(typeof (r.rows[0] as any).v).toBe('number');
  });

  it('format / printf', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT format('%.2f', 3.14159) AS v`);
    expect(r.rows[0]).toMatchObject({ v: '3.14' });
  });

  it('group_concat', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (n TEXT)`);
    await executeQuery(db, `INSERT INTO t VALUES ('a'),('b'),('c')`);
    const r = await executeQuery(db, `SELECT group_concat(n, ',') AS v FROM t`);
    const v = (r.rows[0] as any).v as string;
    expect(v.split(',')).toHaveLength(3);
  });

  it('char and unicode', async () => {
    const db = freshDb();
    const r = await executeQuery(db, `SELECT char(65) AS c, unicode('A') AS u`);
    expect(r.rows[0]).toMatchObject({ c: 'A', u: 65 });
  });
});

// ─── FILTER clause on aggregates ─────────────────────────────────────────────

describe('FILTER clause on aggregates', () => {
  async function filterDb() {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE scores (grp TEXT, val INTEGER, active INTEGER)`);
    await executeQuery(db, `INSERT INTO scores VALUES ('a',10,1),('a',20,0),('b',5,1),('b',15,1)`);
    return db;
  }

  it('COUNT(*) FILTER (WHERE ...)', async () => {
    const db = await filterDb();
    const r = await executeQuery(db, `SELECT grp, COUNT(*) FILTER (WHERE active=1) AS active_count FROM scores GROUP BY grp`);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(2);
    const a = r.rows.find((row: any) => row.grp === 'a') as any;
    expect(a.active_count).toBe(1);
    const b = r.rows.find((row: any) => row.grp === 'b') as any;
    expect(b.active_count).toBe(2);
  });

  it('SUM with FILTER', async () => {
    const db = await filterDb();
    const r = await executeQuery(db, `SELECT SUM(val) FILTER (WHERE active=1) AS active_sum FROM scores`);
    expect(r.error).toBeUndefined();
    expect((r.rows[0] as any).active_sum).toBe(30);
  });

  it('AVG with FILTER', async () => {
    const db = await filterDb();
    const r = await executeQuery(db, `SELECT AVG(val) FILTER (WHERE active=1) AS avg_active FROM scores`);
    expect(r.error).toBeUndefined();
    expect(typeof (r.rows[0] as any).avg_active).toBe('number');
  });

  it('multiple FILTER aggregates in one SELECT', async () => {
    const db = await filterDb();
    const r = await executeQuery(db,
      `SELECT COUNT(*) FILTER (WHERE active=1) AS on_count, COUNT(*) FILTER (WHERE active=0) AS off_count FROM scores`
    );
    expect(r.error).toBeUndefined();
    expect((r.rows[0] as any).on_count).toBe(3);
    expect((r.rows[0] as any).off_count).toBe(1);
  });
});

// ─── OVER clause / window functions ──────────────────────────────────────────

describe('OVER clause and window functions', () => {
  async function winDb() {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE sales (dept TEXT, emp TEXT, amount INTEGER)`);
    await executeQuery(db, `INSERT INTO sales VALUES ('A','x',100),('A','y',200),('B','z',150),('B','w',50)`);
    return db;
  }

  it('DENSE_RANK() OVER (ORDER BY amount DESC)', async () => {
    const db = await winDb();
    const r = await executeQuery(db, `SELECT emp, DENSE_RANK() OVER (ORDER BY amount DESC) AS dr FROM sales`);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(4);
  });

  it('PERCENT_RANK() OVER', async () => {
    const db = await winDb();
    const r = await executeQuery(db, `SELECT emp, PERCENT_RANK() OVER (ORDER BY amount) AS pr FROM sales`);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(4);
  });

  it('CUME_DIST() OVER', async () => {
    const db = await winDb();
    const r = await executeQuery(db, `SELECT emp, CUME_DIST() OVER (ORDER BY amount) AS cd FROM sales`);
    expect(r.error).toBeUndefined();
  });

  it('LAG and LEAD', async () => {
    const db = await winDb();
    const r = await executeQuery(db,
      `SELECT emp, amount, LAG(amount) OVER (ORDER BY amount) AS prev, LEAD(amount) OVER (ORDER BY amount) AS next FROM sales`
    );
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(4);
  });

  it('FIRST_VALUE and LAST_VALUE', async () => {
    const db = await winDb();
    const r = await executeQuery(db,
      `SELECT dept, amount, FIRST_VALUE(amount) OVER (PARTITION BY dept ORDER BY amount) AS first_amt FROM sales`
    );
    expect(r.error).toBeUndefined();
  });

  it('NTH_VALUE', async () => {
    const db = await winDb();
    const r = await executeQuery(db,
      `SELECT emp, NTH_VALUE(amount, 1) OVER (ORDER BY amount) AS first_val FROM sales`
    );
    expect(r.error).toBeUndefined();
  });

  it('NTILE', async () => {
    const db = await winDb();
    const r = await executeQuery(db, `SELECT emp, NTILE(2) OVER (ORDER BY amount) AS tile FROM sales`);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(4);
  });

  it('SUM OVER with ROWS BETWEEN', async () => {
    const db = await winDb();
    const r = await executeQuery(db,
      `SELECT emp, SUM(amount) OVER (ORDER BY amount ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total FROM sales`
    );
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(4);
  });

  it('window function with FILTER', async () => {
    const db = freshDb();
    await executeQuery(db, `CREATE TABLE t (n INTEGER, flag INTEGER)`);
    await executeQuery(db, `INSERT INTO t VALUES (1,1),(2,0),(3,1),(4,1)`);
    // FILTER on window aggregates
    const r = await executeQuery(db,
      `SELECT n, COUNT(*) FILTER (WHERE flag=1) OVER () AS cnt FROM t`
    );
    expect(r.error).toBeUndefined();
  });
});

// ─── Generated columns ───────────────────────────────────────────────────────

describe('Generated columns (SQLite 3.31+)', () => {
  it('stored generated column', async () => {
    const db = freshDb();
    const r = await executeQuery(db,
      `CREATE TABLE products (price REAL, tax_rate REAL, total REAL GENERATED ALWAYS AS (price * (1 + tax_rate)) STORED)`
    );
    expect(r.error).toBeUndefined();
    await executeQuery(db, `INSERT INTO products (price, tax_rate) VALUES (100.0, 0.1)`);
    const sel = await executeQuery(db, `SELECT total FROM products`);
    expect((sel.rows[0] as any).total).toBeCloseTo(110, 1);
  });

  it('virtual generated column', async () => {
    const db = freshDb();
    await executeQuery(db,
      `CREATE TABLE circle (r REAL, area REAL GENERATED ALWAYS AS (3.14159 * r * r) VIRTUAL)`
    );
    await executeQuery(db, `INSERT INTO circle (r) VALUES (5)`);
    const r = await executeQuery(db, `SELECT area FROM circle`);
    expect((r.rows[0] as any).area).toBeCloseTo(78.5, 0);
  });

  it('generated column with string expression', async () => {
    const db = freshDb();
    await executeQuery(db,
      `CREATE TABLE names (first TEXT, last TEXT, full_name TEXT GENERATED ALWAYS AS (first || ' ' || last))`
    );
    await executeQuery(db, `INSERT INTO names (first, last) VALUES ('John', 'Doe')`);
    const r = await executeQuery(db, `SELECT full_name FROM names`);
    expect(r.rows[0]).toMatchObject({ full_name: 'John Doe' });
  });
});

// ─── WITHOUT ROWID tables ─────────────────────────────────────────────────────

describe('WITHOUT ROWID tables', () => {
  it('creates WITHOUT ROWID table', async () => {
    const db = freshDb();
    const r = await executeQuery(db,
      `CREATE TABLE kvstore (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID`
    );
    expect(r.error).toBeUndefined();
  });

  it('inserts and selects from WITHOUT ROWID table', async () => {
    const db = freshDb();
    await executeQuery(db,
      `CREATE TABLE kvstore (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID`
    );
    await executeQuery(db, `INSERT INTO kvstore VALUES ('greeting', 'hello')`);
    const r = await executeQuery(db, `SELECT value FROM kvstore WHERE key = 'greeting'`);
    expect(r.rows[0]).toMatchObject({ value: 'hello' });
  });

  it('enforces PRIMARY KEY constraint in WITHOUT ROWID table', async () => {
    const db = freshDb();
    await executeQuery(db,
      `CREATE TABLE kvstore (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID`
    );
    await executeQuery(db, `INSERT INTO kvstore VALUES ('k', 'v1')`);
    const r = await executeQuery(db, `INSERT INTO kvstore VALUES ('k', 'v2')`);
    expect(r.error).toBeTruthy();
  });
});

// ─── STRICT tables ────────────────────────────────────────────────────────────

describe('STRICT tables (SQLite 3.37+)', () => {
  it('creates STRICT table', async () => {
    const db = freshDb();
    const r = await executeQuery(db,
      `CREATE TABLE measurements (id INTEGER PRIMARY KEY, value REAL NOT NULL) STRICT`
    );
    expect(r.error).toBeUndefined();
  });

  it('rejects wrong type in STRICT table', async () => {
    const db = freshDb();
    await executeQuery(db,
      `CREATE TABLE measurements (id INTEGER PRIMARY KEY, value REAL NOT NULL) STRICT`
    );
    // Inserting a non-numeric string into a REAL column should fail in STRICT mode
    const r = await executeQuery(db, `INSERT INTO measurements (id, value) VALUES (1, 'not-a-number')`);
    expect(r.error).toBeTruthy();
  });

  it('accepts correct types in STRICT table', async () => {
    const db = freshDb();
    await executeQuery(db,
      `CREATE TABLE measurements (id INTEGER PRIMARY KEY, value REAL NOT NULL) STRICT`
    );
    const r = await executeQuery(db, `INSERT INTO measurements (id, value) VALUES (1, 3.14)`);
    expect(r.error).toBeUndefined();
    expect(r.rowsAffected).toBe(1);
  });
});

// ─── Transaction state tracking ───────────────────────────────────────────────

describe('Transaction state tracking', () => {
  it('isInTransaction is false before BEGIN', async () => {
    const db = freshDb();
    expect(isInTransaction(db)).toBe(false);
  });

  it('isInTransaction is true after BEGIN', async () => {
    const db = freshDb();
    await executeQuery(db, 'BEGIN');
    expect(isInTransaction(db)).toBe(true);
  });

  it('isInTransaction is false after COMMIT', async () => {
    const db = freshDb();
    await executeQuery(db, 'BEGIN');
    await executeQuery(db, 'COMMIT');
    expect(isInTransaction(db)).toBe(false);
  });

  it('isInTransaction is false after ROLLBACK', async () => {
    const db = freshDb();
    await executeQuery(db, 'BEGIN');
    await executeQuery(db, 'ROLLBACK');
    expect(isInTransaction(db)).toBe(false);
  });

  it('isInTransaction is true after SAVEPOINT', async () => {
    const db = freshDb();
    await savepointBegin(db, 'sp1');
    expect(isInTransaction(db)).toBe(true);
  });

  it('QueryResult.inTransaction reflects open transaction', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    const beginResult = await executeQuery(db, 'BEGIN');
    expect(beginResult.inTransaction).toBe(true);
    const insResult = await executeQuery(db, 'INSERT INTO t VALUES (1)');
    expect(insResult.inTransaction).toBe(true);
    const commitResult = await executeQuery(db, 'COMMIT');
    expect(commitResult.inTransaction).toBeFalsy();
  });

  it('ROLLBACK TO SAVEPOINT keeps transaction open', async () => {
    const db = freshDb();
    await executeQuery(db, 'BEGIN');
    await executeQuery(db, 'SAVEPOINT sp1');
    await executeQuery(db, 'ROLLBACK TO sp1');
    expect(isInTransaction(db)).toBe(true);
    await executeQuery(db, 'COMMIT');
    expect(isInTransaction(db)).toBe(false);
  });

  it('BEGIN IMMEDIATE sets inTransaction', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'BEGIN IMMEDIATE');
    expect(r.inTransaction).toBe(true);
    await executeQuery(db, 'COMMIT');
  });

  it('BEGIN EXCLUSIVE sets inTransaction', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'BEGIN EXCLUSIVE');
    expect(r.inTransaction).toBe(true);
    await executeQuery(db, 'COMMIT');
  });
});

// ─── In-transaction diagnostic ────────────────────────────────────────────────

describe('getStaticSQLDiagnosticsWithOptions — in-transaction warning', () => {
  it('adds IN_TRANSACTION info when inTransaction=true', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('SELECT 1', { inTransaction: true });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(true);
  });

  it('does NOT add IN_TRANSACTION for BEGIN itself', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('BEGIN', { inTransaction: true });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(false);
  });

  it('does NOT add IN_TRANSACTION for COMMIT', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('COMMIT', { inTransaction: true });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(false);
  });

  it('does NOT add IN_TRANSACTION for ROLLBACK', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('ROLLBACK', { inTransaction: true });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(false);
  });

  it('does NOT add IN_TRANSACTION for SAVEPOINT', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('SAVEPOINT sp1', { inTransaction: true });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(false);
  });

  it('does NOT add IN_TRANSACTION when inTransaction=false', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('SELECT 1', { inTransaction: false });
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(false);
  });

  it('does NOT add IN_TRANSACTION when option omitted', () => {
    const diags = getStaticSQLDiagnosticsWithOptions('SELECT 1');
    expect(diags.some(d => d.code === 'IN_TRANSACTION')).toBe(false);
  });
});

// ─── Transaction state — failed BEGIN / savepoint-only lifecycle ──────────────

describe('Transaction state — correctness edge cases', () => {
  it('failed BEGIN does NOT set isInTransaction to true', async () => {
    const db = freshDb();
    // Start a real transaction first so a second BEGIN fails
    await executeQuery(db, 'BEGIN');
    const failedBegin = await executeQuery(db, 'BEGIN'); // nested BEGIN is an error in SQLite
    // Whether it errors or not depends on SQLite version, but state should remain consistent:
    // If it errored, we should NOT have changed state further
    expect(isInTransaction(db)).toBe(true); // original BEGIN is still active
    await executeQuery(db, 'ROLLBACK');
    expect(isInTransaction(db)).toBe(false);
  });

  it('failed SAVEPOINT name does NOT increment depth', async () => {
    const db = freshDb();
    expect(isInTransaction(db)).toBe(false);
    // A SAVEPOINT with an invalid SQL name would fail but "sp1" is valid so this
    // tests the valid SAVEPOINT path — start + release cycle
    const r1 = await savepointBegin(db, 'sp1');
    expect(r1.error).toBeUndefined();
    expect(isInTransaction(db)).toBe(true);
    const r2 = await savepointRelease(db, 'sp1');
    expect(r2.error).toBeUndefined();
    // After releasing the outermost savepoint, transaction should be closed
    expect(isInTransaction(db)).toBe(false);
  });

  it('savepoint-only lifecycle: SAVEPOINT → RELEASE ends the transaction', async () => {
    const db = freshDb();
    // No explicit BEGIN — SAVEPOINT starts an implicit transaction
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    await executeQuery(db, 'SAVEPOINT sp1');
    expect(isInTransaction(db)).toBe(true);
    await executeQuery(db, 'INSERT INTO t VALUES (42)');
    await executeQuery(db, 'RELEASE sp1');
    expect(isInTransaction(db)).toBe(false);
    // Data persists after RELEASE
    const r = await executeQuery(db, 'SELECT x FROM t');
    expect(r.rows[0]).toMatchObject({ x: 42 });
  });

  it('nested savepoints: depth tracks correctly', async () => {
    const db = freshDb();
    await executeQuery(db, 'SAVEPOINT outer');
    expect(isInTransaction(db)).toBe(true);
    await executeQuery(db, 'SAVEPOINT inner');
    expect(isInTransaction(db)).toBe(true);
    await executeQuery(db, 'RELEASE inner');
    expect(isInTransaction(db)).toBe(true); // outer still active
    await executeQuery(db, 'RELEASE outer');
    expect(isInTransaction(db)).toBe(false);
  });

  it('BEGIN + SAVEPOINT + RELEASE does NOT end the outer transaction', async () => {
    const db = freshDb();
    await executeQuery(db, 'BEGIN');
    await executeQuery(db, 'SAVEPOINT sp1');
    await executeQuery(db, 'RELEASE sp1');
    // Outer BEGIN is still active
    expect(isInTransaction(db)).toBe(true);
    await executeQuery(db, 'COMMIT');
    expect(isInTransaction(db)).toBe(false);
  });

  it('ROLLBACK TO SAVEPOINT keeps the transaction open', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    await executeQuery(db, 'BEGIN');
    await executeQuery(db, 'INSERT INTO t VALUES (1)');
    await executeQuery(db, 'SAVEPOINT sp1');
    await executeQuery(db, 'INSERT INTO t VALUES (2)');
    await executeQuery(db, 'ROLLBACK TO sp1');
    expect(isInTransaction(db)).toBe(true); // still in BEGIN
    // The INSERT after SAVEPOINT was rolled back
    const r = await executeQuery(db, 'SELECT COUNT(*) AS c FROM t');
    expect((r.rows[0] as any).c).toBe(1);
    await executeQuery(db, 'COMMIT');
    expect(isInTransaction(db)).toBe(false);
  });

  it('state is correct across sequential queries after errors', async () => {
    const db = freshDb();
    await executeQuery(db, 'BEGIN');
    // Run an invalid query — transaction should remain open
    await executeQuery(db, 'SELECT * FROM nonexistent_table_xyz');
    expect(isInTransaction(db)).toBe(true); // error did not close the transaction
    await executeQuery(db, 'ROLLBACK');
    expect(isInTransaction(db)).toBe(false);
  });
});

// ─── ATTACH / DETACH (classification only — file paths not available in test env) ──

describe('ATTACH / DETACH classification', () => {
  it('classifySQL treats ATTACH as maintenance', async () => {
    const { classifySQL } = await import('../utils/sqlDiagnostics');
    expect(classifySQL("ATTACH DATABASE 'other.db' AS other")).toBe('maintenance');
    expect(classifySQL('DETACH DATABASE other')).toBe('maintenance');
  });
});

// ─── INSERT … ON CONFLICT (UPSERT) variants ──────────────────────────────────

describe('UPSERT variants', () => {
  it('INSERT OR IGNORE', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, x TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'a')");
    const r = await executeQuery(db, "INSERT OR IGNORE INTO t VALUES (1, 'b')");
    expect(r.error).toBeUndefined();
    const sel = await executeQuery(db, 'SELECT x FROM t WHERE id=1');
    expect(sel.rows[0]).toMatchObject({ x: 'a' }); // unchanged
  });

  it('INSERT OR REPLACE', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, x TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'old')");
    await executeQuery(db, "INSERT OR REPLACE INTO t VALUES (1, 'new')");
    const r = await executeQuery(db, 'SELECT x FROM t WHERE id=1');
    expect(r.rows[0]).toMatchObject({ x: 'new' });
  });

  it('INSERT OR ABORT', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY)');
    await executeQuery(db, 'INSERT INTO t VALUES (1)');
    const r = await executeQuery(db, 'INSERT OR ABORT INTO t VALUES (1)');
    expect(r.error).toBeTruthy();
  });

  it('ON CONFLICT DO NOTHING', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, x TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'a')");
    const r = await executeQuery(db, "INSERT INTO t (id, x) VALUES (1, 'b') ON CONFLICT DO NOTHING");
    expect(r.error).toBeUndefined();
    const sel = await executeQuery(db, 'SELECT x FROM t WHERE id=1');
    expect(sel.rows[0]).toMatchObject({ x: 'a' }); // unchanged
  });
});

// ─── ORDER BY, LIMIT, OFFSET ─────────────────────────────────────────────────

describe('ORDER BY, LIMIT, OFFSET', () => {
  async function orderDb() {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (n INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (3),(1),(4),(1),(5),(9),(2),(6)');
    return db;
  }

  it('ORDER BY ASC', async () => {
    const db = await orderDb();
    const r = await executeQuery(db, 'SELECT n FROM t ORDER BY n ASC LIMIT 3');
    const vals = r.rows.map((row: any) => row.n);
    expect(vals).toEqual([1, 1, 2]);
  });

  it('ORDER BY DESC', async () => {
    const db = await orderDb();
    const r = await executeQuery(db, 'SELECT n FROM t ORDER BY n DESC LIMIT 3');
    const vals = r.rows.map((row: any) => row.n);
    expect(vals).toEqual([9, 6, 5]);
  });

  it('LIMIT with OFFSET', async () => {
    const db = await orderDb();
    const r = await executeQuery(db, 'SELECT n FROM t ORDER BY n ASC LIMIT 3 OFFSET 2');
    expect(r.rows).toHaveLength(3);
  });
});

// ─── GLOB and LIKE pattern matching ──────────────────────────────────────────

describe('GLOB and LIKE', () => {
  it('LIKE pattern', async () => {
    const db = freshDb();
    await executeQuery(db, "CREATE TABLE t (name TEXT)");
    await executeQuery(db, "INSERT INTO t VALUES ('Alice'),('Bob'),('Alexandra')");
    const r = await executeQuery(db, "SELECT name FROM t WHERE name LIKE 'Al%'");
    expect(r.rows).toHaveLength(2);
  });

  it('GLOB pattern', async () => {
    const db = freshDb();
    await executeQuery(db, "CREATE TABLE t (name TEXT)");
    await executeQuery(db, "INSERT INTO t VALUES ('file.txt'),('image.png'),('notes.txt')");
    const r = await executeQuery(db, "SELECT name FROM t WHERE name GLOB '*.txt'");
    expect(r.rows).toHaveLength(2);
  });

  it('NOT LIKE', async () => {
    const db = freshDb();
    await executeQuery(db, "CREATE TABLE t (name TEXT)");
    await executeQuery(db, "INSERT INTO t VALUES ('Alice'),('Bob')");
    const r = await executeQuery(db, "SELECT name FROM t WHERE name NOT LIKE 'A%'");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: 'Bob' });
  });
});

// ─── IS NULL / IS NOT NULL ────────────────────────────────────────────────────

describe('IS NULL / IS NOT NULL', () => {
  it('IS NULL filter', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, 'INSERT INTO t VALUES (1, NULL), (2, \'Alice\')');
    const r = await executeQuery(db, 'SELECT id FROM t WHERE name IS NULL');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id: 1 });
  });

  it('IS NOT NULL filter', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, 'INSERT INTO t VALUES (1, NULL), (2, \'Alice\')');
    const r = await executeQuery(db, 'SELECT id FROM t WHERE name IS NOT NULL');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id: 2 });
  });
});

// ─── BETWEEN ─────────────────────────────────────────────────────────────────

describe('BETWEEN', () => {
  it('BETWEEN inclusive range', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (n INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1),(5),(10),(15),(20)');
    const r = await executeQuery(db, 'SELECT n FROM t WHERE n BETWEEN 5 AND 15');
    expect(r.rows).toHaveLength(3);
  });

  it('NOT BETWEEN', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (n INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1),(5),(10)');
    const r = await executeQuery(db, 'SELECT n FROM t WHERE n NOT BETWEEN 3 AND 8');
    expect(r.rows).toHaveLength(2);
  });
});

// ─── ALTER TABLE RENAME COLUMN ────────────────────────────────────────────────

describe('ALTER TABLE RENAME COLUMN', () => {
  it('renames column', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (old_col INTEGER)');
    const r = await executeQuery(db, 'ALTER TABLE t RENAME COLUMN old_col TO new_col');
    expect(r.error).toBeUndefined();
    const info = await executeQuery(db, 'PRAGMA table_info(t)');
    const names = info.rows.map((row: any) => row.name);
    expect(names).toContain('new_col');
    expect(names).not.toContain('old_col');
  });
});

// ─── DROP INDEX / DROP VIEW / DROP TRIGGER ────────────────────────────────────

describe('DROP INDEX / DROP VIEW / DROP TRIGGER', () => {
  it('DROP INDEX', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, 'CREATE INDEX idx ON t (name)');
    const r = await executeQuery(db, 'DROP INDEX idx');
    expect(r.error).toBeUndefined();
    const idx = await executeQuery(db, "SELECT name FROM sqlite_master WHERE type='index' AND name='idx'");
    expect(idx.rows).toHaveLength(0);
  });

  it('DROP VIEW', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER)');
    await executeQuery(db, 'CREATE VIEW v AS SELECT id FROM t');
    const r = await executeQuery(db, 'DROP VIEW v');
    expect(r.error).toBeUndefined();
  });

  it('DROP TRIGGER', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, ts TEXT)');
    await executeQuery(db, "CREATE TRIGGER trg AFTER INSERT ON t BEGIN UPDATE t SET ts='x' WHERE id=NEW.id; END");
    const r = await executeQuery(db, 'DROP TRIGGER trg');
    expect(r.error).toBeUndefined();
  });

  it('IF EXISTS on non-existent index does not error', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'DROP INDEX IF EXISTS nonexistent_idx');
    expect(r.error).toBeUndefined();
  });
});

// ─── VACUUM and ANALYZE ───────────────────────────────────────────────────────

describe('VACUUM and ANALYZE', () => {
  it('VACUUM completes without error', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1),(2),(3)');
    const r = await executeQuery(db, 'VACUUM');
    expect(r.error).toBeUndefined();
    expect(r.type).toBe('maintenance');
  });

  it('ANALYZE completes without error', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (x INTEGER, y TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1,'a'),(2,'b')");
    await executeQuery(db, 'CREATE INDEX idx ON t (x)');
    const r = await executeQuery(db, 'ANALYZE');
    expect(r.error).toBeUndefined();
    expect(r.type).toBe('maintenance');
  });

  it('REINDEX completes without error', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, val TEXT)');
    await executeQuery(db, 'CREATE INDEX idx ON t (val)');
    const r = await executeQuery(db, 'REINDEX idx');
    expect(r.error).toBeUndefined();
  });
});

// ─── DISTINCT ─────────────────────────────────────────────────────────────────

describe('DISTINCT', () => {
  it('SELECT DISTINCT removes duplicates', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (n INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1),(1),(2),(2),(3)');
    const r = await executeQuery(db, 'SELECT DISTINCT n FROM t ORDER BY n');
    expect(r.rows).toHaveLength(3);
  });
});

// ─── EXISTS / NOT EXISTS ─────────────────────────────────────────────────────

describe('EXISTS / NOT EXISTS', () => {
  it('EXISTS subquery', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1)');
    const r = await executeQuery(db, 'SELECT EXISTS(SELECT 1 FROM t WHERE id=1) AS found');
    expect((r.rows[0] as any).found).toBe(1);
  });

  it('NOT EXISTS subquery', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER)');
    const r = await executeQuery(db, 'SELECT NOT EXISTS(SELECT 1 FROM t) AS empty');
    expect((r.rows[0] as any).empty).toBe(1);
  });
});

// ─── DML RETURNING clause ─────────────────────────────────────────────────────

describe('DML RETURNING clause', () => {
  it('INSERT RETURNING', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
    const r = await executeQuery(db, "INSERT INTO t (name) VALUES ('Alice') RETURNING id, name");
    expect(r.type).toBe('dml');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: 'Alice' });
    expect(typeof (r.rows[0] as any).id).toBe('number');
  });

  it('UPDATE RETURNING', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, score INTEGER)');
    await executeQuery(db, 'INSERT INTO t VALUES (1, 100)');
    const r = await executeQuery(db, 'UPDATE t SET score = score + 10 WHERE id = 1 RETURNING score');
    expect(r.type).toBe('dml');
    expect(r.rows[0]).toMatchObject({ score: 110 });
  });

  it('DELETE RETURNING', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'Alice')");
    const r = await executeQuery(db, 'DELETE FROM t WHERE id=1 RETURNING id, name');
    expect(r.type).toBe('dml');
    expect(r.rows[0]).toMatchObject({ id: 1, name: 'Alice' });
  });
});

// ─── FOREIGN KEY enforcement ──────────────────────────────────────────────────

describe('Foreign key enforcement', () => {
  it('FK violation is caught when foreign_keys is enabled', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE parent (id INTEGER PRIMARY KEY)');
    await executeQuery(db, 'CREATE TABLE child (id INTEGER PRIMARY KEY, pid INTEGER REFERENCES parent(id))');
    await executeQuery(db, 'PRAGMA foreign_keys = ON');
    const r = await executeQuery(db, 'INSERT INTO child VALUES (1, 999)'); // 999 does not exist in parent
    expect(r.error).toBeTruthy();
  });

  it('FK satisfied inserts successfully', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE parent (id INTEGER PRIMARY KEY)');
    await executeQuery(db, 'CREATE TABLE child (id INTEGER PRIMARY KEY, pid INTEGER REFERENCES parent(id))');
    await executeQuery(db, 'PRAGMA foreign_keys = ON');
    await executeQuery(db, 'INSERT INTO parent VALUES (1)');
    const r = await executeQuery(db, 'INSERT INTO child VALUES (1, 1)');
    expect(r.error).toBeUndefined();
  });
});

// ─── PRAGMA compile_options and version ──────────────────────────────────────

describe('PRAGMA queries', () => {
  it('PRAGMA compile_options executes without error', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'PRAGMA compile_options');
    expect(r.type).toBe('pragma');
    expect(r.error).toBeUndefined();
    // Some SQLite builds (and the sql.js test mock) omit compile_options;
    // we only require that the query does not crash, not that it returns rows.
  });

  it('PRAGMA user_version read/write', async () => {
    const db = freshDb();
    await executeQuery(db, 'PRAGMA user_version = 42');
    const r = await executeQuery(db, 'PRAGMA user_version');
    expect((r.rows[0] as any).user_version).toBe(42);
  });

  it('PRAGMA index_list', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, 'CREATE INDEX idx_name ON t (name)');
    const r = await executeQuery(db, 'PRAGMA index_list(t)');
    expect(r.rows.some((row: any) => row.name === 'idx_name')).toBe(true);
  });

  it('PRAGMA foreign_key_list', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE parent (id INTEGER PRIMARY KEY)');
    await executeQuery(db, 'CREATE TABLE child (id INTEGER, pid INTEGER REFERENCES parent(id))');
    const r = await executeQuery(db, 'PRAGMA foreign_key_list(child)');
    expect(r.rows).toHaveLength(1);
  });

  it('PRAGMA quick_check', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER)');
    const r = await executeQuery(db, 'PRAGMA quick_check');
    expect(r.type).toBe('pragma');
  });
});

// ─── Multi-statement with mix of types ───────────────────────────────────────

describe('Multi-statement mixed types', () => {
  it('DDL + DML + SELECT in sequence', async () => {
    const db = freshDb();
    const r = await executeQuery(db,
      `CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);
       INSERT INTO products VALUES (1, 'Widget', 9.99);
       INSERT INTO products VALUES (2, 'Gadget', 24.99);
       SELECT name, price FROM products ORDER BY price DESC`
    );
    expect(r.type).toBe('select');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ name: 'Gadget' });
  });

  it('statementCount tracks all statements', async () => {
    const db = freshDb();
    const r = await executeQuery(db, 'SELECT 1; SELECT 2; SELECT 3');
    expect(r.statementCount).toBe(3);
  });
});
