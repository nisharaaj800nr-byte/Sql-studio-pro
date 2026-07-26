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
const TRANSACTIONS = new Set(['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT', 'RELEASE']);
const MAINTENANCE = new Set(['VACUUM', 'ANALYZE', 'REINDEX', 'ATTACH', 'DETACH']);

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
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
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
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
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
    return !findTopLevelKeyword(lex(sql), '=');
  }
  if (kind === 'dml') {
    return !!findTopLevelKeyword(lex(sql), 'RETURNING');
  }
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
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === quote) {
        if (next === quote) {
          i += 2;
        } else {
          quote = null;
          i++;
        }
      } else {
        i++;
      }
      continue;
    }
    if (ch === '-' && next === '-') {
      lineComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      i++;
      continue;
    }
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

  if (sql.includes('/*') && !sql.includes('*/')) {
    diagnostics.push(diagnostic(sql, sql.indexOf('/*'), 'error', 'UNTERMINATED_COMMENT', 'Block comment is not closed.'));
  }
  const openParens = (sql.match(/\(/g) ?? []).length;
  const closeParens = (sql.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    diagnostics.push(diagnostic(
      sql,
      sql.lastIndexOf(openParens > closeParens ? '(' : ')'),
      'error',
      'UNBALANCED_PARENS',
      openParens > closeParens ? 'A closing parenthesis is missing.' : 'There is an extra closing parenthesis.',
    ));
  }
  const statements = splitSQLStatements(sql);
  if (statements.length > 1) {
    diagnostics.push(diagnostic(sql, 0, 'info', 'MULTI_STATEMENT', `${statements.length} SQLite statements will run in order.`));
  }

  const kind = classifySQL(sql);
  if (kind === 'unknown') {
    diagnostics.push(diagnostic(sql, first.start, 'error', 'UNSUPPORTED_STATEMENT', `SQLite statement "${first.value}" is not recognized.`));
  }
  const upper = sql.toUpperCase();
  const where = findTopLevelKeyword(tokens, 'WHERE');
  if ((kind === 'dml') && (first.upper === 'DELETE' || first.upper === 'UPDATE') && !where) {
    diagnostics.push(diagnostic(sql, first.start, 'warning', 'NO_WHERE', `${first.upper} without WHERE affects every matching row.`));
  }
  if (kind === 'select' && /\bSELECT\s+\*/i.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'info', 'SELECT_STAR', 'SELECT * returns every column; select only the columns you need for large tables.'));
  }
  if (kind === 'select' && !/\bLIMIT\b/i.test(sql) && /\bFROM\b/i.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'info', 'NO_LIMIT', 'This query has no LIMIT. The result panel will still enforce your row limit.'));
  }
  if (/\b(CROSS\s+JOIN|JOIN\s+[^;]+\bJOIN\b)/i.test(sql) && !/\bON\b/i.test(sql) && !/\bUSING\b/i.test(sql)) {
    diagnostics.push(diagnostic(sql, upper.indexOf('JOIN'), 'warning', 'CARTESIAN_JOIN', 'This JOIN has no ON or USING clause and may create a Cartesian product.'));
  }
  if (/\b(ILIKE|SERIAL|AUTO_INCREMENT|TOP\s+\d+|NVARCHAR|GETDATE)\b/i.test(sql)) {
    const match = sql.match(/\b(ILIKE|SERIAL|AUTO_INCREMENT|TOP\s+\d+|NVARCHAR|GETDATE)\b/i);
    diagnostics.push(diagnostic(sql, match?.index ?? 0, 'warning', 'OTHER_DIALECT', 'This looks like PostgreSQL, MySQL, or SQL Server syntax. SQL Studio Pro executes SQLite SQL locally.'));
  }
  const destructiveToken = tokens.find(token =>
    !token.quoted && (token.upper === 'DELETE' || token.upper === 'DROP' ||
      token.upper === 'ALTER' || token.upper === 'VACUUM' ||
      token.upper === 'ATTACH' || token.upper === 'DETACH')
  );
  if (destructiveToken) {
    diagnostics.push(diagnostic(sql, destructiveToken.start, 'warning', 'DESTRUCTIVE_SQL', 'This statement can change or remove database data or structure. Review it before running.'));
  }
  if (kind === 'pragma' && /=/.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'warning', 'PRAGMA_WRITE', 'This PRAGMA changes database settings rather than returning rows.'));
  }
  if (kind === 'maintenance' && /\b(VACUUM|REINDEX|ANALYZE)\b/i.test(sql)) {
    diagnostics.push(diagnostic(sql, first.start, 'info', 'MAINTENANCE', 'Database maintenance may take longer on large local files.'));
  }

  return diagnostics;
}

export function isDestructiveSQLText(sql: string): boolean {
  return splitSQLStatements(sql).some(statement => {
    const tokens = lex(statement);
    return tokens.some(token =>
      !token.quoted && (token.upper === 'DELETE' || token.upper === 'DROP' ||
        token.upper === 'ALTER' || token.upper === 'VACUUM' ||
        token.upper === 'ATTACH' || token.upper === 'DETACH')
    );
  });
}

export function getSQLSuggestions(prefix: string): string[] {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'CREATE VIEW',
    'CREATE TRIGGER', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'ON', 'GROUP BY', 'HAVING',
    'ORDER BY', 'LIMIT', 'OFFSET', 'WITH', 'RETURNING', 'BEGIN', 'COMMIT', 'ROLLBACK',
    'SAVEPOINT', 'PRAGMA', 'EXPLAIN QUERY PLAN', 'VACUUM', 'ANALYZE',
  ];
  const normalized = prefix.trim().toUpperCase();
  if (!normalized) return keywords.slice(0, 8);
  return keywords.filter(keyword => keyword.startsWith(normalized)).slice(0, 8);
}

export function formatSQLiteError(error: unknown): SQLiteErrorDetails {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown SQLite error');
  const normalized = raw.toLowerCase();

  if (normalized.includes('syntax error') || normalized.includes('incomplete input')) {
    return {
      title: 'SQLite syntax error',
      message: raw,
      hint: 'Check commas, parentheses, quotes, and the order of SQLite clauses.',
    };
  }
  if (normalized.includes('no such table')) {
    return {
      title: 'Table not found',
      message: raw,
      hint: 'Check the table name or refresh the database schema.',
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
  if (normalized.includes('unique constraint')) {
    return {
      title: 'Unique constraint failed',
      message: raw,
      hint: 'Use a different value or use INSERT ... ON CONFLICT when that is the intended behavior.',
    };
  }
  if (normalized.includes('foreign key constraint')) {
    return {
      title: 'Foreign-key constraint failed',
      message: raw,
      hint: 'Insert the referenced parent row first or verify the foreign-key value.',
    };
  }
  if (normalized.includes('not null constraint')) {
    return {
      title: 'Required value is missing',
      message: raw,
      hint: 'Provide a value for every NOT NULL column without a default.',
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
  if (normalized.includes('too many sql variables')) {
    return {
      title: 'Too many bound parameters',
      message: raw,
      hint: 'Split this operation into smaller batches.',
    };
  }
  return { title: 'SQLite query failed', message: raw };
}