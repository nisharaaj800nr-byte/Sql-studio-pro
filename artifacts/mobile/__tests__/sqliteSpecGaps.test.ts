/**
 * Spec gap coverage — items mandated by the SQLite spec that weren't in other test files:
 *  1. Incorrect parameter count error message
 *  2. Corrupt database recovery — DatabaseCorruptError class + checkIntegrity
 *  3. Offline persistence — dbFileExists utility
 *  4. formatSQLiteError "incorrect parameter count" branch
 */

const sqliteMock = require('expo-sqlite');
beforeEach(() => sqliteMock._reset());

import {
  executeQuery,
  checkIntegrity,
  dbFileExists,
  DatabaseCorruptError,
} from '../utils/sqliteManager';
import { formatSQLiteError } from '../utils/sqlDiagnostics';

let dbSeq = 0;
const freshDb = () => `gap_${++dbSeq}_${Date.now()}`;

// ─── Incorrect parameter count ────────────────────────────────────────────────

describe('Incorrect parameter count — formatSQLiteError', () => {
  it('maps "wrong number of arguments to function" → Incorrect parameter count', () => {
    const r = formatSQLiteError(new Error('wrong number of arguments to function substr()'));
    expect(r.title).toBe('Incorrect parameter count');
    expect(r.hint).toBeTruthy();
  });

  it('maps "wrong number of arguments to function round" → Incorrect parameter count', () => {
    const r = formatSQLiteError(new Error('wrong number of arguments to function round()'));
    expect(r.title).toBe('Incorrect parameter count');
  });

  it('calling a function with wrong arg count at runtime returns user-facing error', async () => {
    const db = freshDb();
    // substr() needs at least 2 args; calling with 0 triggers the error
    const r = await executeQuery(db, 'SELECT substr() AS v');
    expect(r.type).toBe('error');
    expect(r.error).toBeTruthy();
  });
});

// ─── Corrupt database recovery ────────────────────────────────────────────────

describe('Corrupt database recovery', () => {
  it('DatabaseCorruptError is a real Error subclass with correct name', () => {
    const cause = new Error('database disk image is malformed');
    const err = new DatabaseCorruptError('mydb', cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DatabaseCorruptError');
    expect(err.message).toContain('mydb');
    expect(err.message).toContain('corrupt');
  });

  it('DatabaseCorruptError message includes the database id', () => {
    const err = new DatabaseCorruptError('test_db', new Error('file is not a database'));
    expect(err.message).toContain('test_db');
  });

  it('checkIntegrity returns ok=true for a clean database', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE t (id INTEGER, name TEXT)');
    await executeQuery(db, "INSERT INTO t VALUES (1, 'Alice')");
    const { ok, issues } = await checkIntegrity(db);
    expect(ok).toBe(true);
    expect(issues).toHaveLength(0);
  });

  it('checkIntegrity returns ok=true for empty database', async () => {
    const db = freshDb();
    const { ok } = await checkIntegrity(db);
    expect(ok).toBe(true);
  });

  it('formatSQLiteError maps all corruption messages correctly', () => {
    const messages = [
      'database disk image is malformed',
      'file is not a database',
      'database is corrupt',
      'database corruption detected',
    ];
    for (const msg of messages) {
      const r = formatSQLiteError(new Error(msg));
      expect(r.title).toBe('Database file is corrupt');
      expect(r.hint).toBeTruthy();
    }
  });
});

// ─── Offline persistence — dbFileExists ───────────────────────────────────────

describe('Offline persistence — dbFileExists', () => {
  it('dbFileExists returns false for a database that has not been opened', async () => {
    // The FileSystem mock always returns { exists: false }
    const exists = await dbFileExists('nonexistent_db_xyz');
    expect(exists).toBe(false);
  });

  it('dbFileExists returns a boolean (not throws) for any db id', async () => {
    const result = await dbFileExists('any_db_id');
    expect(typeof result).toBe('boolean');
  });

  it('database opened with executeQuery is accessible across multiple queries', async () => {
    const db = freshDb();
    await executeQuery(db, 'CREATE TABLE persist_test (val INTEGER)');
    await executeQuery(db, 'INSERT INTO persist_test VALUES (42)');
    // Second query uses the same cached connection — simulates persistence
    const r = await executeQuery(db, 'SELECT val FROM persist_test');
    expect(r.rows[0]).toMatchObject({ val: 42 });
  });

  it('multiple databases are independently isolated', async () => {
    const db1 = freshDb();
    const db2 = freshDb();
    await executeQuery(db1, 'CREATE TABLE t (x INTEGER)');
    await executeQuery(db1, 'INSERT INTO t VALUES (1)');
    await executeQuery(db2, 'CREATE TABLE t (x INTEGER)');
    await executeQuery(db2, 'INSERT INTO t VALUES (99)');

    const r1 = await executeQuery(db1, 'SELECT x FROM t');
    const r2 = await executeQuery(db2, 'SELECT x FROM t');
    expect((r1.rows[0] as any).x).toBe(1);
    expect((r2.rows[0] as any).x).toBe(99);
  });
});
