/**
 * Tests for pure functions in sqlDiagnostics.ts.
 * No expo-sqlite or device APIs needed — runs in plain Node / Jest.
 */
import {
  classifySQL,
  extractCTEAliases,
  extractTableAliases,
  formatSQLiteError,
  getStaticSQLDiagnostics,
  isDestructiveSQLText,
  splitSQLStatements,
  statementReturnsRows,
} from '../utils/sqlDiagnostics';

// ─── classifySQL ──────────────────────────────────────────────────────────────

describe('classifySQL', () => {
  // SELECT variants
  it('classifies SELECT', () => expect(classifySQL('SELECT 1')).toBe('select'));
  it('classifies SELECT with FROM', () => expect(classifySQL('SELECT id FROM users WHERE id = 1')).toBe('select'));
  it('classifies VALUES', () => expect(classifySQL('VALUES (1,2,3)')).toBe('select'));

  // WITH / CTE
  it('classifies WITH … SELECT as select', () =>
    expect(classifySQL('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe('select'));
  it('classifies WITH RECURSIVE as select', () =>
    expect(classifySQL('WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r')).toBe('select'));
  it('classifies WITH … INSERT as dml', () =>
    expect(classifySQL('WITH cte AS (SELECT 1 AS a) INSERT INTO t SELECT a FROM cte')).toBe('dml'));

  // DML
  it('classifies INSERT', () => expect(classifySQL('INSERT INTO t VALUES (1)')).toBe('dml'));
  it('classifies UPDATE', () => expect(classifySQL('UPDATE t SET x = 1 WHERE id = 1')).toBe('dml'));
  it('classifies DELETE', () => expect(classifySQL('DELETE FROM t WHERE id = 1')).toBe('dml'));
  it('classifies REPLACE', () => expect(classifySQL('REPLACE INTO t VALUES (1)')).toBe('dml'));

  // DDL
  it('classifies CREATE TABLE', () => expect(classifySQL('CREATE TABLE foo (id INTEGER)')).toBe('ddl'));
  it('classifies CREATE TABLE AS SELECT', () => expect(classifySQL('CREATE TABLE foo AS SELECT * FROM bar')).toBe('ddl'));
  it('classifies ALTER TABLE', () => expect(classifySQL('ALTER TABLE t ADD COLUMN x TEXT')).toBe('ddl'));
  it('classifies DROP TABLE', () => expect(classifySQL('DROP TABLE IF EXISTS t')).toBe('ddl'));
  it('classifies CREATE INDEX', () => expect(classifySQL('CREATE INDEX idx ON t (col)')).toBe('ddl'));
  it('classifies CREATE UNIQUE INDEX', () => expect(classifySQL('CREATE UNIQUE INDEX idx ON t (col)')).toBe('ddl'));
  it('classifies DROP INDEX', () => expect(classifySQL('DROP INDEX idx')).toBe('ddl'));
  it('classifies CREATE VIEW', () => expect(classifySQL('CREATE VIEW v AS SELECT 1')).toBe('ddl'));
  it('classifies DROP VIEW', () => expect(classifySQL('DROP VIEW v')).toBe('ddl'));
  it('classifies CREATE TRIGGER', () => expect(classifySQL('CREATE TRIGGER tr AFTER INSERT ON t BEGIN SELECT 1; END')).toBe('ddl'));
  it('classifies DROP TRIGGER', () => expect(classifySQL('DROP TRIGGER tr')).toBe('ddl'));

  // PRAGMA
  it('classifies PRAGMA read', () => expect(classifySQL('PRAGMA table_info(users)')).toBe('pragma'));
  it('classifies PRAGMA write', () => expect(classifySQL('PRAGMA foreign_keys = ON')).toBe('pragma'));
  it('classifies PRAGMA journal_mode', () => expect(classifySQL('PRAGMA journal_mode=WAL')).toBe('pragma'));

  // Transactions
  it('classifies BEGIN', () => expect(classifySQL('BEGIN')).toBe('transaction'));
  it('classifies BEGIN DEFERRED', () => expect(classifySQL('BEGIN DEFERRED')).toBe('transaction'));
  it('classifies BEGIN IMMEDIATE', () => expect(classifySQL('BEGIN IMMEDIATE')).toBe('transaction'));
  it('classifies BEGIN EXCLUSIVE', () => expect(classifySQL('BEGIN EXCLUSIVE')).toBe('transaction'));
  it('classifies COMMIT', () => expect(classifySQL('COMMIT')).toBe('transaction'));
  it('classifies ROLLBACK', () => expect(classifySQL('ROLLBACK')).toBe('transaction'));
  it('classifies SAVEPOINT', () => expect(classifySQL('SAVEPOINT sp1')).toBe('transaction'));
  it('classifies RELEASE', () => expect(classifySQL('RELEASE SAVEPOINT sp1')).toBe('transaction'));

  // EXPLAIN
  it('classifies EXPLAIN', () => expect(classifySQL('EXPLAIN SELECT 1')).toBe('explain'));
  it('classifies EXPLAIN QUERY PLAN', () => expect(classifySQL('EXPLAIN QUERY PLAN SELECT * FROM t')).toBe('explain'));

  // Maintenance
  it('classifies VACUUM', () => expect(classifySQL('VACUUM')).toBe('maintenance'));
  it('classifies ANALYZE', () => expect(classifySQL('ANALYZE')).toBe('maintenance'));
  it('classifies REINDEX', () => expect(classifySQL('REINDEX')).toBe('maintenance'));
  it('classifies ATTACH DATABASE', () => expect(classifySQL("ATTACH DATABASE 'file.db' AS other")).toBe('maintenance'));
  it('classifies DETACH DATABASE', () => expect(classifySQL('DETACH DATABASE other')).toBe('maintenance'));

  // Edge cases
  it('classifies empty as unknown', () => expect(classifySQL('')).toBe('unknown'));
  it('classifies comment-only as unknown', () => expect(classifySQL('-- hello')).toBe('unknown'));
  it('handles leading whitespace', () => expect(classifySQL('  SELECT 1')).toBe('select'));
  it('is case-insensitive', () => expect(classifySQL('select * from t')).toBe('select'));
});

// ─── statementReturnsRows ─────────────────────────────────────────────────────

describe('statementReturnsRows', () => {
  it('SELECT returns rows', () => expect(statementReturnsRows('SELECT 1')).toBe(true));
  it('EXPLAIN returns rows', () => expect(statementReturnsRows('EXPLAIN SELECT 1')).toBe(true));
  it('EXPLAIN QUERY PLAN returns rows', () => expect(statementReturnsRows('EXPLAIN QUERY PLAN SELECT 1')).toBe(true));
  it('PRAGMA read returns rows', () => expect(statementReturnsRows('PRAGMA table_info(t)')).toBe(true));
  it('PRAGMA write returns no rows', () => expect(statementReturnsRows('PRAGMA foreign_keys = ON')).toBe(false));
  it('INSERT returns no rows', () => expect(statementReturnsRows('INSERT INTO t VALUES (1)')).toBe(false));
  it('INSERT RETURNING returns rows', () =>
    expect(statementReturnsRows('INSERT INTO t VALUES (1) RETURNING id')).toBe(true));
  it('UPDATE returns no rows', () => expect(statementReturnsRows('UPDATE t SET x=1')).toBe(false));
  it('UPDATE RETURNING returns rows', () =>
    expect(statementReturnsRows('UPDATE t SET x=1 RETURNING *')).toBe(true));
  it('DELETE returns no rows', () => expect(statementReturnsRows('DELETE FROM t')).toBe(false));
  it('DELETE RETURNING returns rows', () =>
    expect(statementReturnsRows('DELETE FROM t WHERE id=1 RETURNING id')).toBe(true));
  it('CREATE TABLE returns no rows', () => expect(statementReturnsRows('CREATE TABLE t (id INT)')).toBe(false));
  it('VACUUM returns no rows', () => expect(statementReturnsRows('VACUUM')).toBe(false));
  it('BEGIN returns no rows', () => expect(statementReturnsRows('BEGIN')).toBe(false));
});

// ─── splitSQLStatements ───────────────────────────────────────────────────────

describe('splitSQLStatements', () => {
  it('splits two simple statements', () =>
    expect(splitSQLStatements('SELECT 1; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']));

  it('ignores semicolons inside single-quoted strings', () =>
    expect(splitSQLStatements("SELECT 'a;b' FROM t")).toEqual(["SELECT 'a;b' FROM t"]));

  it('ignores semicolons inside double-quoted identifiers', () =>
    expect(splitSQLStatements('SELECT "a;b" FROM t')).toEqual(['SELECT "a;b" FROM t']));

  it('ignores semicolons inside backtick identifiers', () =>
    expect(splitSQLStatements('SELECT `a;b` FROM t')).toEqual(['SELECT `a;b` FROM t']));

  it('ignores semicolons inside line comments', () =>
    expect(splitSQLStatements('SELECT 1 -- ; ignore\n, 2')).toHaveLength(1));

  it('ignores semicolons inside block comments', () =>
    expect(splitSQLStatements('SELECT /* ; */ 1')).toHaveLength(1));

  it('ignores semicolons inside parentheses', () =>
    expect(splitSQLStatements('SELECT (SELECT 1; SELECT 2)')).toHaveLength(1));

  it('does not split trigger body BEGIN…END', () => {
    const sql = `CREATE TRIGGER tr AFTER INSERT ON t BEGIN
      SELECT 1;
      SELECT 2;
    END`;
    expect(splitSQLStatements(sql)).toHaveLength(1);
  });

  it('splits after trigger correctly when followed by another statement', () => {
    const sql = `CREATE TRIGGER tr AFTER INSERT ON t BEGIN SELECT 1; END; SELECT 2`;
    const parts = splitSQLStatements(sql);
    expect(parts).toHaveLength(2);
    expect(parts[1]).toBe('SELECT 2');
  });

  it('returns empty array for empty input', () =>
    expect(splitSQLStatements('')).toEqual([]));

  it('handles trailing semicolon without extra empty statement', () =>
    expect(splitSQLStatements('SELECT 1;')).toEqual(['SELECT 1']));

  it('trims whitespace from each statement', () =>
    expect(splitSQLStatements('  SELECT 1  ;  SELECT 2  ')).toEqual(['SELECT 1', 'SELECT 2']));

  it('splits INSERT OR REPLACE correctly', () =>
    expect(splitSQLStatements('INSERT OR REPLACE INTO t VALUES (1); SELECT 1')).toHaveLength(2));

  it('handles escaped single quotes inside strings', () =>
    expect(splitSQLStatements("SELECT 'it''s;here'")).toHaveLength(1));

  it('handles bracket identifiers [col;name]', () =>
    expect(splitSQLStatements('SELECT [col;name] FROM t')).toHaveLength(1));
});

// ─── getStaticSQLDiagnostics ──────────────────────────────────────────────────

describe('getStaticSQLDiagnostics', () => {
  it('returns no diagnostics for valid SELECT', () =>
    expect(getStaticSQLDiagnostics('SELECT 1').filter(d => d.severity === 'error')).toHaveLength(0));

  it('returns error for unrecognised statement', () => {
    const diags = getStaticSQLDiagnostics('FROBNICATE thing');
    expect(diags.some(d => d.code === 'UNSUPPORTED_STATEMENT')).toBe(true);
  });

  it('returns error for unterminated block comment', () => {
    const diags = getStaticSQLDiagnostics('SELECT /* oops');
    expect(diags.some(d => d.code === 'UNTERMINATED_COMMENT')).toBe(true);
  });

  it('returns error for unbalanced open paren', () => {
    const diags = getStaticSQLDiagnostics('SELECT (1 + 2');
    expect(diags.some(d => d.code === 'UNBALANCED_PARENS')).toBe(true);
  });

  it('returns error for unbalanced close paren', () => {
    const diags = getStaticSQLDiagnostics('SELECT 1 + 2)');
    expect(diags.some(d => d.code === 'UNBALANCED_PARENS')).toBe(true);
  });

  it('warns DELETE without WHERE', () => {
    const diags = getStaticSQLDiagnostics('DELETE FROM t');
    expect(diags.some(d => d.code === 'NO_WHERE')).toBe(true);
  });

  it('warns UPDATE without WHERE', () => {
    const diags = getStaticSQLDiagnostics('UPDATE t SET x = 1');
    expect(diags.some(d => d.code === 'NO_WHERE')).toBe(true);
  });

  it('does NOT warn DELETE with WHERE', () =>
    expect(getStaticSQLDiagnostics('DELETE FROM t WHERE id = 1').some(d => d.code === 'NO_WHERE')).toBe(false));

  it('flags SELECT *', () => {
    const diags = getStaticSQLDiagnostics('SELECT * FROM t');
    expect(diags.some(d => d.code === 'SELECT_STAR')).toBe(true);
  });

  it('flags SELECT without LIMIT', () => {
    const diags = getStaticSQLDiagnostics('SELECT id FROM t');
    expect(diags.some(d => d.code === 'NO_LIMIT')).toBe(true);
  });

  it('does NOT flag SELECT with LIMIT', () =>
    expect(getStaticSQLDiagnostics('SELECT id FROM t LIMIT 10').some(d => d.code === 'NO_LIMIT')).toBe(false));

  it('flags Cartesian JOIN', () => {
    const diags = getStaticSQLDiagnostics('SELECT * FROM a JOIN b');
    expect(diags.some(d => d.code === 'CARTESIAN_JOIN')).toBe(true);
  });

  it('does NOT flag JOIN with ON clause', () =>
    expect(getStaticSQLDiagnostics('SELECT * FROM a JOIN b ON a.id = b.id').some(d => d.code === 'CARTESIAN_JOIN')).toBe(false));

  it('flags PostgreSQL ILIKE syntax', () => {
    const diags = getStaticSQLDiagnostics("SELECT * FROM t WHERE name ILIKE '%foo%'");
    expect(diags.some(d => d.code === 'OTHER_DIALECT')).toBe(true);
  });

  it('flags MySQL AUTO_INCREMENT', () => {
    const diags = getStaticSQLDiagnostics('CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY)');
    expect(diags.some(d => d.code === 'OTHER_DIALECT')).toBe(true);
  });

  it('flags SHOW TABLES', () => {
    const diags = getStaticSQLDiagnostics('SHOW TABLES');
    expect(diags.some(d => d.code === 'OTHER_DIALECT')).toBe(true);
  });

  it('flags DESCRIBE', () => {
    const diags = getStaticSQLDiagnostics('DESCRIBE users');
    expect(diags.some(d => d.code === 'OTHER_DIALECT')).toBe(true);
  });

  it('flags DROP as destructive', () => {
    const diags = getStaticSQLDiagnostics('DROP TABLE t');
    expect(diags.some(d => d.code === 'DESTRUCTIVE_SQL')).toBe(true);
  });

  it('flags PRAGMA write', () => {
    const diags = getStaticSQLDiagnostics('PRAGMA foreign_keys = ON');
    expect(diags.some(d => d.code === 'PRAGMA_WRITE')).toBe(true);
  });

  it('reports line/column for first token', () => {
    const diags = getStaticSQLDiagnostics('DELETE FROM t');
    const noWhere = diags.find(d => d.code === 'NO_WHERE');
    expect(noWhere?.line).toBe(1);
    expect(noWhere?.column).toBeGreaterThan(0);
  });

  it('returns empty array for empty input', () =>
    expect(getStaticSQLDiagnostics('')).toHaveLength(0));

  it('info diagnostic for multi-statement', () => {
    const diags = getStaticSQLDiagnostics('SELECT 1; SELECT 2');
    expect(diags.some(d => d.code === 'MULTI_STATEMENT')).toBe(true);
  });
});

// ─── extractCTEAliases ────────────────────────────────────────────────────────

describe('extractCTEAliases', () => {
  it('extracts single CTE alias', () =>
    expect(extractCTEAliases('WITH foo AS (SELECT 1) SELECT * FROM foo')).toContain('foo'));

  it('extracts multiple CTE aliases', () => {
    const sql = 'WITH foo AS (SELECT 1), bar AS (SELECT 2) SELECT * FROM foo, bar';
    const aliases = extractCTEAliases(sql);
    expect(aliases).toContain('foo');
    expect(aliases).toContain('bar');
  });

  it('handles RECURSIVE keyword', () => {
    const sql = 'WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n<10) SELECT * FROM r';
    expect(extractCTEAliases(sql)).toContain('r');
  });

  it('returns empty array for non-WITH query', () =>
    expect(extractCTEAliases('SELECT * FROM t')).toHaveLength(0));

  it('returns no duplicates', () => {
    const aliases = extractCTEAliases('WITH foo AS (SELECT 1) SELECT * FROM foo');
    expect(aliases.filter(a => a === 'foo')).toHaveLength(1);
  });
});

// ─── extractTableAliases ──────────────────────────────────────────────────────

describe('extractTableAliases', () => {
  it('extracts alias with AS keyword', () =>
    expect(extractTableAliases('SELECT u.id FROM users AS u')).toContain('u'));

  it('extracts alias without AS keyword', () =>
    expect(extractTableAliases('SELECT u.id FROM users u')).toContain('u'));

  it('extracts alias from JOIN', () => {
    const aliases = extractTableAliases('SELECT * FROM users u JOIN orders o ON u.id = o.user_id');
    expect(aliases).toContain('u');
    expect(aliases).toContain('o');
  });

  it('extracts alias from LEFT JOIN', () =>
    expect(extractTableAliases('SELECT * FROM t1 a LEFT JOIN t2 b ON a.id = b.id')).toContain('b'));

  it('returns empty array when no aliases', () =>
    expect(extractTableAliases('SELECT * FROM users')).toHaveLength(0));
});

// ─── isDestructiveSQLText ─────────────────────────────────────────────────────

describe('isDestructiveSQLText', () => {
  it('DROP TABLE is destructive', () => expect(isDestructiveSQLText('DROP TABLE t')).toBe(true));
  it('DELETE is destructive', () => expect(isDestructiveSQLText('DELETE FROM t WHERE id=1')).toBe(true));
  it('ALTER TABLE is destructive', () => expect(isDestructiveSQLText('ALTER TABLE t ADD COLUMN x TEXT')).toBe(true));
  it('VACUUM is destructive', () => expect(isDestructiveSQLText('VACUUM')).toBe(true));
  it('ATTACH is destructive', () => expect(isDestructiveSQLText("ATTACH DATABASE 'f.db' AS x")).toBe(true));
  it('SELECT is NOT destructive', () => expect(isDestructiveSQLText('SELECT * FROM t')).toBe(false));
  it('INSERT is NOT destructive', () => expect(isDestructiveSQLText('INSERT INTO t VALUES (1)')).toBe(false));
});

// ─── formatSQLiteError ────────────────────────────────────────────────────────

describe('formatSQLiteError', () => {
  it('formats syntax error', () => {
    const r = formatSQLiteError(new Error('near "SELEC": syntax error'));
    expect(r.title).toMatch(/syntax/i);
    expect(r.hint).toBeTruthy();
  });

  it('formats no such table', () => {
    const r = formatSQLiteError(new Error('no such table: foo'));
    expect(r.title).toMatch(/table/i);
  });

  it('formats no such column', () => {
    const r = formatSQLiteError(new Error('no such column: bar'));
    expect(r.title).toMatch(/column/i);
  });

  it('formats unique constraint', () => {
    const r = formatSQLiteError(new Error('UNIQUE constraint failed: t.id'));
    expect(r.title).toMatch(/unique/i);
  });

  it('formats foreign key constraint', () => {
    const r = formatSQLiteError(new Error('FOREIGN KEY constraint failed'));
    expect(r.title).toMatch(/foreign/i);
  });

  it('formats not null constraint', () => {
    const r = formatSQLiteError(new Error('NOT NULL constraint failed: t.name'));
    expect(r.title).toMatch(/required|missing/i);
  });

  it('formats check constraint', () => {
    const r = formatSQLiteError(new Error('CHECK constraint failed: t'));
    expect(r.title).toMatch(/check/i);
  });

  it('formats database locked', () => {
    const r = formatSQLiteError(new Error('database is locked'));
    expect(r.title).toMatch(/busy|locked/i);
  });

  it('formats read-only database', () => {
    const r = formatSQLiteError(new Error('attempt to write a readonly database'));
    expect(r.title).toMatch(/read.only/i);
  });

  it('formats corrupt database', () => {
    const r = formatSQLiteError(new Error('database disk image is malformed'));
    expect(r.title).toMatch(/corrupt/i);
  });

  it('formats ambiguous column', () => {
    const r = formatSQLiteError(new Error('ambiguous column name: id'));
    expect(r.title).toMatch(/ambiguous/i);
  });

  it('handles non-Error value', () => {
    const r = formatSQLiteError('something went wrong');
    expect(r.title).toBeTruthy();
    expect(r.message).toBe('something went wrong');
  });

  it('handles null', () => {
    const r = formatSQLiteError(null);
    expect(r.title).toBeTruthy();
  });
});
