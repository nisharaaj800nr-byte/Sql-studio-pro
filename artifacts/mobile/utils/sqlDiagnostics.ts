export type SQLStatementKind =
  | 'select'
  | 'dml'
  | 'ddl'
  | 'pragma'
  | 'transaction'
  | 'explain'
  | 'maintenance'
  | 'unknown';

export type SQLDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface SQLDiagnostic {
  severity: SQLDiagnosticSeverity;
  message: string;
  line: number;
  column: number;
  code: string;
}

export interface SQLiteErrorDetails {
  title: string;
  message: string;
  hint?: string;
}

interface LexToken {
  value: string;
  upper: string;
  start: number;
  end: number;
  depth: number;
  quoted: boolean;
}

const DML = new Set(['INSERT', 'UPDATE', 'DELETE', 'REPLACE']);
const DDL = new Set(['CREATE', 'ALTER', 'DROP']);
const TRANSACTIONS = new Set([
  'BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT', 'RELEASE',
]);
const MAINTENANCE = new Set(['VACUUM', 'ANALYZE', 'REINDEX', 'ATTACH', 'DETACH']);

// Keywords that signal non-SQLite dialects (PostgreSQL, MySQL, SQL Server, Oracle).
// NOTE: @@ROWCOUNT and @@IDENTITY start with '@' (non-word chars), so they are placed
// OUTSIDE the leading \b(...) group to avoid the word-boundary mismatch.
const OTHER_DIALECT_RE =
  /\b(ILIKE|SERIAL|AUTO_INCREMENT|NVARCHAR|GETDATE\s*\(|SHOW\s+(?:TABLES|DATABASES|COLUMNS|CREATE|STATUS|INDEX)\b|DESCRIBE\s+\w+|EXPLAIN\s+ANALYZE|ROWNUM\b|SYSDATE\b|NVL\s*\(|DECODE\s*\(|DUAL\b|NEXTVAL\b|CURRVAL\b|TRUNCATE\s+TABLE\b|IDENTITY\s*\(|CHARINDEX\s*\(|PATINDEX\s*\(|DATEPART\s*\(|DATEDIFF\s*\(|DATEADD\s*\(|STUFF\s*\(|ISNULL\s*\(|CONVERT\s*\(|TRY_CAST\s*\(|TRY_CONVERT\s*\(|NEWID\s*\(|SCOPE_IDENTITY\s*\(|OUTPUT\s+INSERTED\b|MERGE\s+INTO\b|TOP\s+\d+\b)|@@(?:ROWCOUNT|IDENTITY)\b/i;

function isWordStart(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z_]/.test(ch);
}

function isWordPart(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_$]/.test(ch);
}

function skipQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) { i += 2; continue; }
      return i + 1;
    }
    i++;
  }
  return sql.length;
}

function lex(sql: string): LexToken[] {
  const tokens: LexToken[] = [];
  let i = 0;
  let depth = 0;

  while (i < sql.length) {
    const ch = sql[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i + 2);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipQuoted(sql, i, ch);
      tokens.push({ value: sql.slice(i, end), upper: '', start: i, end, depth, quoted: true });
      i = end;
      continue;
    }
    if (ch === '[') {
      const end = sql.indexOf(']', i + 1);
      const finalEnd = end === -1 ? sql.length : end + 1;
      tokens.push({ value: sql.slice(i, finalEnd), upper: '', start: i, end: finalEnd, depth, quoted: true });
      i = finalEnd;
      continue;
    }
    if (isWordStart(ch)) {
      let end = i + 1;
      while (isWordPart(sql[end])) end++;
      const value = sql.slice(i, end);
      tokens.push({ value, upper: value.toUpperCase(), start: i, end, depth, quoted: false });
      i = end;
      continue;
    }
    if (ch === '(') {
      tokens.push({ value: ch, upper: ch, start: i, end: i + 1, depth, quoted: false });
      depth++;
      i++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      tokens.push({ value: ch, upper: ch, start: i, end: i + 1, depth, quoted: false });
      i++;
      continue;
    }
    tokens.push({ value: ch, upper: ch, start: i, end: i + 1, depth, quoted: false });
    i++;
  }

  return tokens;
}

function firstKeyword(tokens: LexToken[]): LexToken | undefined {
  return tokens.find(token => !token.quoted && /^[A-Za-z_]/.test(token.value));
}

function findTopLevelKeyword(tokens: LexToken[], keyword: string): LexToken | undefined {
  return tokens.find(token => token.depth === 0 && token.upper === keyword && !token.quoted);
}

function kindAfterWith(tokens: LexToken[]): SQLStatementKind {
  const topLevel = tokens.filter(token => token.depth === 0 && !token.quoted);
  const keyword = topLevel.find(token =>
    DML.has(token.upper) || token.upper === 'SELECT' || token.upper === 'VALUES' ||
    DDL.has(token.upper)
  );
  if (!keyword) return 'unknown';
  return classifyKeyword(keyword.upper);
}

function classifyKeyword(keyword: string): SQLStatementKind {
  if (keyword === 'SELECT' || keyword === 'VALUES') return 'select';
  if (keyword === 'EXPLAIN') return 'explain';
  if (keyword === 'PRAGMA') return 'pragma';
  if (DML.has(keyword)) return 'dml';
  if (DDL.has(keyword)) return 'ddl';
  if (TRANSACTIONS.has(keyword)) return 'transaction';
  if (MAINTENANCE.has(keyword)) return 'maintenance';
  return 'unknown';
}

export function classifySQL(sql: string): SQLStatementKind {
  const tokens = lex(sql);
  const first = firstKeyword(tokens);
  if (!first) return 'unknown';
  if (first.upper === 'WITH') return kindAfterWith(tokens);
  return classifyKeyword(first.upper);
}

export function statementReturnsRows(sql: string, kind = classifySQL(sql)): boolean {
  if (kind === 'select' || kind === 'explain') return true;
  if (kind === 'pragma') {
    // PRAGMA name=value writes; PRAGMA name reads (returns rows)
    return !findTopLevelKeyword(lex(sql), '=');
  }
  if (kind === 'dml') {
    return !!findTopLevelKeyword(lex(sql), 'RETURNING');
  }
  // ATTACH DATABASE returns no rows; same for other maintenance
  return false;
}

/**
 * Split SQL without splitting semicolons inside strings, quoted identifiers,
 * line comments, block comments, or nested trigger bodies.
 */
export function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  let quote: string | null = null;
  let blockComment = false;
  let lineComment = false;
  let depth = 0;
  let currentWords: string[] = [];
  let triggerBodyDepth = 0;
  let isCreateTrigger = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      i++;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 2; }
      else i++;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        if (next === quote) { i += 2; }
        else { quote = null; i++; }
      } else { i++; }
      continue;
    }
    if (ch === '-' && next === '-') { lineComment = true; i += 2; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 2; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; i++; continue; }
    if (ch === '[') {
      const end = sql.indexOf(']', i + 1);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }
    if (isWordStart(ch)) {
      let end = i + 1;
      while (isWordPart(sql[end])) end++;
      const word = sql.slice(i, end).toUpperCase();
      currentWords.push(word);
      if (currentWords[0] === 'CREATE' && currentWords.includes('TRIGGER')) {
        isCreateTrigger = true;
      }
      if (isCreateTrigger && word === 'BEGIN') triggerBodyDepth++;
      if (isCreateTrigger && word === 'END' && triggerBodyDepth > 0) triggerBodyDepth--;
      i = end;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0 && triggerBodyDepth === 0) {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
      currentWords = [];
      isCreateTrigger = false;
    }
    i++;
  }

  const finalStatement = sql.slice(start).trim();
  if (finalStatement) statements.push(finalStatement);
  return statements;
}

function positionAt(sql: string, offset: number): { line: number; column: number } {
  const before = sql.slice(0, Math.max(0, offset));
  const lines = before.split('\n');
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

function diagnostic(
  sql: string,
  offset: number,
  severity: SQLDiagnosticSeverity,
  code: string,
  message: string,
): SQLDiagnostic {
  return { severity, code, message, ...positionAt(sql, offset) };
}

export function getStaticSQLDiagnostics(sql: string): SQLDiagnostic[] {
  const diagnostics: SQLDiagnostic[] = [];
  const trimmed = sql.trim();
  if (!trimmed) return diagnostics;

  const tokens = lex(sql);
  const first = firstKeyword(tokens);
  if (!first) {
    diagnostics.push(diagnostic(sql, 0, 'error', 'EMPTY_SQL', 'Enter a SQLite statement to run.'));
    return diagnostics;
  }

  // Unterminated block comment
  if (sql.includes('/*') && !sql.includes('*/')) {
    diagnostics.push(diagnostic(sql, sql.indexOf('/*'), 'error', 'UNTERMINATED_COMMENT', 'Block comment is not closed.'));
  }

  // Unbalanced parens (rough check, excludes content inside strings/comments)
  let parenDepth = 0;
  let firstUnbalanced = -1;
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '(') { parenDepth++; }
    else if (sql[i] === ')') {
      parenDepth--;
      if (parenDepth < 0 && firstUnbalanced === -1) firstUnbalanced = i;
    }
  }
  if (parenDepth !== 0 || firstUnbalanced !== -1) {
    const pos = firstUnbalanced !== -1 ? firstUnbalanced : sql.lastIndexOf('(');
    diagnostics.push(diagnostic(
      sql, pos, 'error', 'UNBALANCED_PARENS',
      parenDepth > 0 ? 'A closing parenthesis is missing.' : 'There is an extra closing parenthesis.',
    ));
  }

  const statements = splitSQLStatements(sql);
  if (statements.length > 1) {
    diagnostics.push(diagnostic(sql, 0, 'info', 'MULTI_STATEMENT',
      `${statements.length} SQLite statements will run in order.`));
  }

  const kind = classifySQL(sql);
  if (kind === 'unknown') {
    diagnostics.push(diagnostic(sql, first.start, 'error', 'UNSUPPORTED_STATEMENT',
      `"${first.value}" is not a recognised SQLite statement.`));
  }

  const where = findTopLevelKeyword(tokens, 'WHERE');

  // DELETE / UPDATE without WHERE
  if (kind === 'dml' && (first.upper === 'DELETE' || first.upper === 'UPDATE') && !where) {
    diagnostics.push(diagnostic(sql, first.start, 'warning', 'NO_WHERE',
      `${first.upper} without WHERE will affect every row in the table.`));
  }

  // SELECT *
  if (kind === 'select' && /\bSELECT\s+\*/i.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'info', 'SELECT_STAR',
      'SELECT * returns every column. Specify columns explicitly for large tables.'));
  }

  // SELECT without LIMIT
  if (kind === 'select' && !/\bLIMIT\b/i.test(sql) && /\bFROM\b/i.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'info', 'NO_LIMIT',
      'No LIMIT clause — the result panel will still enforce your row cap.'));
  }

  // Cartesian JOIN (JOIN without ON / USING)
  if (/\bJOIN\b/i.test(sql) && !/\b(ON|USING)\b/i.test(sql)) {
    const joinIdx = sql.toUpperCase().indexOf('JOIN');
    diagnostics.push(diagnostic(sql, joinIdx, 'warning', 'CARTESIAN_JOIN',
      'This JOIN has no ON or USING clause and may produce a Cartesian product.'));
  }

  // CROSS JOIN always flagged as cartesian
  if (/\bCROSS\s+JOIN\b/i.test(sql)) {
    const idx = sql.toUpperCase().indexOf('CROSS');
    diagnostics.push(diagnostic(sql, idx, 'info', 'CROSS_JOIN',
      'CROSS JOIN produces a Cartesian product — every row × every row.'));
  }

  // Non-SQLite dialect detection
  const dialectMatch = OTHER_DIALECT_RE.exec(sql);
  if (dialectMatch) {
    diagnostics.push(diagnostic(sql, dialectMatch.index, 'warning', 'OTHER_DIALECT',
      `"${dialectMatch[0].split(/\s/)[0]}" looks like PostgreSQL, MySQL, SQL Server, or Oracle syntax. SQL Studio Pro executes SQLite locally.`));
  }

  // Destructive operations — warn (not block)
  const destructiveToken = tokens.find(t =>
    !t.quoted && (t.upper === 'DROP' || t.upper === 'TRUNCATE')
  );
  if (destructiveToken) {
    diagnostics.push(diagnostic(sql, destructiveToken.start, 'warning', 'DESTRUCTIVE_SQL',
      `${destructiveToken.upper} permanently removes data or schema objects. Review before running.`));
  }

  // ALTER TABLE
  if (kind === 'ddl' && first.upper === 'ALTER') {
    diagnostics.push(diagnostic(sql, first.start, 'warning', 'ALTER_TABLE',
      'ALTER TABLE modifies schema structure. Back up your data first.'));
  }

  // VACUUM / REINDEX / ANALYZE
  if (kind === 'maintenance' && /\b(VACUUM|REINDEX|ANALYZE)\b/i.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'info', 'MAINTENANCE',
      'Maintenance commands can take longer on large database files.'));
  }

  // Destructive PRAGMA (write PRAGMA)
  if (kind === 'pragma' && /=/.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'warning', 'PRAGMA_WRITE',
      'This PRAGMA changes a database setting rather than reading one.'));
  }

  // ATTACH DATABASE
  if (kind === 'maintenance' && first.upper === 'ATTACH') {
    diagnostics.push(diagnostic(sql, first.start, 'warning', 'ATTACH_DATABASE',
      'ATTACH DATABASE opens an additional database file. Queries can then span both databases.'));
  }

  return diagnostics;
}

/**
 * Extended overload: accepts options to enable in-transaction warning.
 * Pass { inTransaction: true } when the user has an open BEGIN.
 */
export function getStaticSQLDiagnosticsWithOptions(
  sql: string,
  options?: { inTransaction?: boolean },
): SQLDiagnostic[] {
  const diagnostics = getStaticSQLDiagnostics(sql);
  if (!options?.inTransaction) return diagnostics;

  const trimmed = sql.trim().toUpperCase();
  // Don't warn about the transaction control statements themselves
  const isTransactionControl = /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|END)\b/.test(trimmed);
  if (!isTransactionControl) {
    diagnostics.push({
      severity: 'info',
      code: 'IN_TRANSACTION',
      message: 'A transaction is open. This query will run inside the active BEGIN block.',
      line: 1,
      column: 1,
    });
  }
  return diagnostics;
}

export function isDestructiveSQLText(sql: string): boolean {
  return splitSQLStatements(sql).some(statement => {
    const tokens = lex(statement);
    return tokens.some(token =>
      !token.quoted && (
        token.upper === 'DELETE' || token.upper === 'DROP' ||
        token.upper === 'ALTER' || token.upper === 'VACUUM' ||
        token.upper === 'ATTACH' || token.upper === 'DETACH' ||
        token.upper === 'TRUNCATE'
      )
    );
  });
}

/**
 * Extract CTE alias names from a WITH clause.
 * e.g. WITH foo AS (...), bar AS (...) → ['foo', 'bar']
 */
export function extractCTEAliases(sql: string): string[] {
  const aliases: string[] = [];
  const tokens = lex(sql);
  let seenWith = false;

  const SKIP = new Set([
    'WITH', 'RECURSIVE', 'MATERIALIZED', 'NOT',
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE',
    'CREATE', 'ALTER', 'DROP', 'AS',
  ]);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.quoted && t.upper === 'WITH' && t.depth === 0) {
      seenWith = true;
      continue;
    }
    if (!seenWith) continue;
    if (t.depth !== 0) continue;
    if (t.quoted) continue;

    // Once we hit a DML/SELECT keyword at top level (after the CTEs), stop
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(t.upper)) break;

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.value) && !SKIP.has(t.upper)) {
      // Peek ahead for AS or (
      let j = i + 1;
      while (j < tokens.length && (tokens[j].depth !== 0 || /^[\s,]$/.test(tokens[j].value))) j++;
      const next = tokens[j];
      if (next && (next.upper === 'AS' || next.value === '(')) {
        aliases.push(t.value);
      }
    }
  }
  return [...new Set(aliases)];
}

/**
 * Extract table aliases from FROM and JOIN clauses.
 * e.g. FROM users u JOIN orders o ON ... → ['u', 'o']
 */
export function extractTableAliases(sql: string): string[] {
  const aliases: string[] = [];
  const tokens = lex(sql);

  const JOIN_LIKE = new Set(['FROM', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS', 'NATURAL', 'FULL', 'OUTER']);
  const CLAUSE_STARTS = new Set([
    'WHERE', 'ON', 'SET', 'USING', 'GROUP', 'ORDER', 'HAVING', 'LIMIT',
    'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT', 'SELECT', 'INSERT', 'UPDATE',
    'DELETE', 'WITH',
  ]);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.quoted || t.depth !== 0) continue;
    if (!JOIN_LIKE.has(t.upper)) continue;

    // Skip JOIN qualifiers (LEFT, RIGHT, INNER, OUTER, etc.) until we reach JOIN or FROM
    let k = i + 1;
    while (k < tokens.length && JOIN_LIKE.has(tokens[k].upper) && !tokens[k].quoted) k++;
    if (k >= tokens.length) continue;

    const tableTok = tokens[k];
    // Table name must be an identifier, not a subquery
    if (tableTok.quoted || !(/^[A-Za-z_]/.test(tableTok.value)) || CLAUSE_STARTS.has(tableTok.upper)) continue;
    k++;

    // Skip optional AS
    if (k < tokens.length && !tokens[k].quoted && tokens[k].upper === 'AS') k++;

    // Next identifier is the alias
    if (k < tokens.length && !tokens[k].quoted && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tokens[k].value) &&
        !CLAUSE_STARTS.has(tokens[k].upper) &&
        !JOIN_LIKE.has(tokens[k].upper) &&
        tokens[k].value.toUpperCase() !== tableTok.value.toUpperCase()) {
      aliases.push(tokens[k].value);
    }
  }
  return [...new Set(aliases)];
}

export function getSQLSuggestions(prefix: string): string[] {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'CREATE UNIQUE INDEX',
    'CREATE VIEW', 'CREATE TRIGGER', 'DROP VIEW', 'DROP INDEX', 'DROP TRIGGER',
    'JOIN', 'LEFT JOIN', 'INNER JOIN', 'CROSS JOIN',
    'ON', 'USING', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
    'WITH', 'RECURSIVE', 'RETURNING',
    'BEGIN', 'BEGIN DEFERRED', 'BEGIN IMMEDIATE', 'BEGIN EXCLUSIVE',
    'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'ROLLBACK TO',
    'PRAGMA', 'EXPLAIN', 'EXPLAIN QUERY PLAN',
    'VACUUM', 'ANALYZE', 'REINDEX', 'ATTACH DATABASE', 'DETACH DATABASE',
    'INSERT OR REPLACE', 'INSERT OR IGNORE', 'INSERT OR ABORT', 'INSERT OR FAIL',
    'ON CONFLICT', 'DO NOTHING', 'DO UPDATE SET',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'CAST', 'COLLATE', 'OVER', 'PARTITION BY', 'FILTER',
    'IS NULL', 'IS NOT NULL', 'NOT IN', 'NOT EXISTS', 'NOT LIKE',
    'BETWEEN', 'LIKE', 'GLOB', 'REGEXP',
    'ASC', 'DESC', 'DISTINCT', 'ALL',
    'WITHOUT ROWID', 'STRICT',
  ];
  const normalized = prefix.trim().toUpperCase();
  if (!normalized) return keywords.slice(0, 8);
  return keywords.filter(k => k.startsWith(normalized)).slice(0, 10);
}

export function formatSQLiteError(error: unknown): SQLiteErrorDetails {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown SQLite error');
  const normalized = raw.toLowerCase();

  if (normalized.includes('syntax error') || normalized.includes('incomplete input')) {
    return {
      title: 'SQLite syntax error',
      message: raw,
      hint: 'Check commas, parentheses, quotes, and the order of clauses.',
    };
  }
  if (normalized.includes('no such table')) {
    return {
      title: 'Table not found',
      message: raw,
      hint: 'Check the table name or run the schema view to see available tables.',
    };
  }
  if (normalized.includes('no such column')) {
    return {
      title: 'Column not found',
      message: raw,
      hint: 'Check the column name and table alias. Use autocomplete to inspect the current schema.',
    };
  }
  if (normalized.includes('no such function')) {
    return {
      title: 'SQLite function not found',
      message: raw,
      hint: 'This function may not be compiled into the SQLite version on this device.',
    };
  }
  if (normalized.includes('no such index')) {
    return { title: 'Index not found', message: raw };
  }
  if (normalized.includes('no such trigger')) {
    return { title: 'Trigger not found', message: raw };
  }
  if (normalized.includes('no such view')) {
    return { title: 'View not found', message: raw };
  }
  if (normalized.includes('ambiguous column')) {
    return {
      title: 'Ambiguous column name',
      message: raw,
      hint: 'Prefix the column with its table name or alias (e.g. table.column).',
    };
  }
  if (normalized.includes('unique constraint')) {
    return {
      title: 'Unique constraint failed',
      message: raw,
      hint: 'Use a different value or INSERT … ON CONFLICT DO NOTHING / DO UPDATE.',
    };
  }
  if (normalized.includes('foreign key constraint')) {
    return {
      title: 'Foreign-key constraint failed',
      message: raw,
      hint: 'Insert the referenced parent row first, or check the foreign-key value.',
    };
  }
  if (normalized.includes('not null constraint')) {
    return {
      title: 'Required value is missing',
      message: raw,
      hint: 'Provide a value for every NOT NULL column that has no DEFAULT.',
    };
  }
  if (normalized.includes('check constraint')) {
    return {
      title: 'CHECK constraint failed',
      message: raw,
      hint: 'Review the CHECK expression defined on the table.',
    };
  }
  if (normalized.includes('database is locked') || normalized.includes('database table is locked')) {
    return {
      title: 'Database is busy',
      message: raw,
      hint: 'Finish or roll back the active transaction, then try again.',
    };
  }
  if (normalized.includes('readonly') || normalized.includes('read-only')) {
    return {
      title: 'Database is read-only',
      message: raw,
      hint: 'Open a writable local database file before running a write query.',
    };
  }
  if (
    normalized.includes('disk image is malformed') ||
    normalized.includes('file is not a database') ||
    normalized.includes('database is corrupt') ||
    normalized.includes('database corruption')
  ) {
    return {
      title: 'Database file is corrupt',
      message: raw,
      hint: 'Use the integrity check tool to diagnose the file, or restore from a backup.',
    };
  }
  if (normalized.includes('disk') && normalized.includes('full')) {
    return {
      title: 'Disk full',
      message: raw,
      hint: 'Free up device storage space and try again.',
    };
  }
  if (normalized.includes('wrong number of arguments') || normalized.includes('incorrect number of bindings') || normalized.includes('expected') && normalized.includes('arguments')) {
    return {
      title: 'Incorrect parameter count',
      message: raw,
      hint: 'Check the number of arguments passed to this SQLite function or the number of bound parameters (?)',
    };
  }
  if (normalized.includes('too many sql variables') || normalized.includes('too many variables')) {
    return {
      title: 'Too many bound parameters',
      message: raw,
      hint: 'Split this operation into smaller batches.',
    };
  }
  if (normalized.includes('constraint failed')) {
    return {
      title: 'Constraint failed',
      message: raw,
      hint: 'A table constraint was violated. Check NOT NULL, UNIQUE, CHECK, and FK constraints.',
    };
  }
  if (normalized.includes('cannot attach')) {
    return {
      title: 'ATTACH failed',
      message: raw,
      hint: 'Check that the database path is correct and the file is accessible.',
    };
  }
  if (normalized.includes('savepoint')) {
    return {
      title: 'Savepoint error',
      message: raw,
      hint: 'Use SAVEPOINT name / RELEASE name / ROLLBACK TO name.',
    };
  }
  return { title: 'SQLite query failed', message: raw };
}
