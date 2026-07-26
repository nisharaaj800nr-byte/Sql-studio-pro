export type TokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'operator'
  | 'identifier'
  | 'whitespace'
  | 'punctuation'
  | 'parameter';

export interface Token {
  type: TokenType;
  value: string;
}

// ─── SQLite 3 keyword set ────────────────────────────────────────────────────
// Covers all keywords from https://www.sqlite.org/lang_keywords.html
const SQL_KEYWORDS = new Set([
  // DML
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'REPLACE', 'UPSERT',
  // DDL
  'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'VIEW', 'TRIGGER',
  'RENAME', 'TO',
  // Constraints / table options
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT', 'NOT',
  'NULL', 'AUTOINCREMENT', 'WITHOUT', 'ROWID', 'STRICT', 'GENERATED', 'ALWAYS',
  'STORED', 'VIRTUAL', 'CONSTRAINT',
  // Types (common SQLite affinity names)
  'INTEGER', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'INT2', 'INT8',
  'TEXT', 'CLOB', 'REAL', 'DOUBLE', 'FLOAT', 'NUMERIC', 'DECIMAL',
  'BLOB', 'BOOLEAN', 'VARCHAR', 'CHAR', 'NCHAR', 'NVARCHAR',
  'DATETIME', 'DATE', 'TIME',
  // Joins
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL',
  'ON', 'USING',
  // Boolean & comparison
  'AND', 'OR', 'IS', 'IN', 'LIKE', 'GLOB', 'REGEXP', 'MATCH',
  'BETWEEN', 'EXISTS', 'ANY', 'ALL',
  // Sorting / grouping
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
  // Aliases
  'AS',
  // Set operations
  'UNION', 'INTERSECT', 'EXCEPT',
  // CASE
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  // CTEs
  'WITH', 'RECURSIVE', 'MATERIALIZED',
  // Window functions
  'OVER', 'PARTITION', 'WINDOW', 'RANGE', 'ROWS', 'GROUPS',
  'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT', 'ROW',
  'TIES', 'EXCLUDE', 'OTHERS', 'NO',
  // Aggregate filter
  'FILTER',
  // DML extras
  'RETURNING', 'CONFLICT', 'IGNORE', 'ABORT', 'FAIL', 'ROLLBACK',
  'NOTHING', 'EXCLUDED', 'DO',
  // Transactions
  'BEGIN', 'COMMIT', 'TRANSACTION', 'DEFERRED', 'IMMEDIATE', 'EXCLUSIVE',
  'SAVEPOINT', 'RELEASE', 'END',
  // Temp
  'TEMPORARY', 'TEMP',
  // Attach / detach
  'ATTACH', 'DETACH', 'DATABASE',
  // Maintenance
  'REINDEX', 'VACUUM', 'ANALYZE',
  // Special
  'EXPLAIN', 'QUERY', 'PLAN', 'PRAGMA',
  // Conditions
  'IF',
  // Subquery
  'LATERAL',
  // Trigger
  'FOR', 'EACH', 'NEW', 'OLD', 'RAISE', 'BEFORE', 'AFTER', 'INSTEAD', 'OF',
  'STATEMENT',
  // CAST / COLLATE
  'CAST', 'COLLATE',
  // Literals
  'TRUE', 'FALSE',
  // Type conversion
  'NOTNULL',
  // Index hints
  'INDEXED', 'UNINDEXED', 'BETWEEN',
]);

// ─── SQLite 3 built-in functions ─────────────────────────────────────────────
const SQL_FUNCTIONS = new Set([
  // Aggregate
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL', 'GROUP_CONCAT',
  // Core scalar
  'ABS', 'CHAR', 'COALESCE', 'GLOB', 'HEX', 'IFNULL', 'IIF', 'INSTR',
  'LAST_INSERT_ROWID', 'LENGTH', 'LIKE', 'LIKELIHOOD', 'LIKELY', 'LOWER', 'LTRIM',
  'MAX', 'MIN', 'NULLIF', 'OCTET_LENGTH', 'PRINTF', 'FORMAT', 'QUOTE', 'RANDOM',
  'RANDOMBLOB', 'REPLACE', 'ROUND', 'RTRIM', 'SIGN', 'SOUNDEX', 'SQLITE_COMPILEOPTION_GET',
  'SQLITE_COMPILEOPTION_USED', 'SQLITE_OFFSET', 'SQLITE_SOURCE_ID', 'SQLITE_VERSION',
  'SUBSTR', 'SUBSTRING', 'TRIM', 'TYPEOF', 'UNICODE', 'UNHEX', 'UNLIKELY', 'UPPER',
  'ZEROBLOB', 'CHANGES', 'TOTAL_CHANGES', 'CODEPOINT', 'CHAR',
  // Math (3.35+)
  'ACOS', 'ACOSH', 'ASIN', 'ASINH', 'ATAN', 'ATAN2', 'ATANH',
  'CEIL', 'CEILING', 'COS', 'COSH', 'DEGREES', 'EXP', 'FLOOR',
  'LN', 'LOG', 'LOG2', 'LOG10', 'MOD', 'PI', 'POW', 'POWER',
  'RADIANS', 'SIN', 'SINH', 'SQRT', 'TAN', 'TANH', 'TRUNC',
  // Date / time
  'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME', 'UNIXEPOCH', 'TIMEDIFF',
  // Window
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'PERCENT_RANK', 'CUME_DIST', 'NTILE',
  'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
  // JSON (may require ENABLE_JSON1)
  'JSON', 'JSON_ARRAY', 'JSON_ARRAY_LENGTH', 'JSON_EACH', 'JSON_ERROR_POSITION',
  'JSON_EXTRACT', 'JSON_INSERT', 'JSON_OBJECT', 'JSON_PATCH', 'JSON_PRETTY',
  'JSON_QUOTE', 'JSON_REMOVE', 'JSON_REPLACE', 'JSON_SET', 'JSON_TREE',
  'JSON_TYPE', 'JSON_VALID',
  // FTS helpers (when FTS is compiled in)
  'BM25', 'HIGHLIGHT', 'SNIPPET',
  // BLOB / hex helpers
  'ZEROBLOB', 'RANDOMBLOB',
]);

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    // Whitespace
    if (/\s/.test(ch)) {
      let j = i;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      tokens.push({ type: 'whitespace', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Line comment --
    if (ch === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Block comment /* */
    if (ch === '/' && sql[i + 1] === '*') {
      let j = i + 2;
      while (j < sql.length - 1 && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
      tokens.push({ type: 'comment', value: sql.slice(i, j + 2) });
      i = j + 2;
      continue;
    }

    // Single-quoted string
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") break;
        j++;
      }
      tokens.push({ type: 'string', value: sql.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Blob literal X'...'
    if ((ch === 'X' || ch === 'x') && sql[i + 1] === "'") {
      let j = i + 2;
      while (j < sql.length && sql[j] !== "'") j++;
      tokens.push({ type: 'string', value: sql.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Double-quoted identifier (escapes included)
    if (ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') { j += 2; continue; }
        if (sql[j] === '"') break;
        j++;
      }
      tokens.push({ type: 'identifier', value: sql.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Backtick identifier
    if (ch === '`') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '`') j++;
      tokens.push({ type: 'identifier', value: sql.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Bracket identifier [...]
    if (ch === '[') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== ']') j++;
      tokens.push({ type: 'identifier', value: sql.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Hex integer literal 0x...
    if (ch === '0' && (sql[i + 1] === 'x' || sql[i + 1] === 'X')) {
      let j = i + 2;
      while (j < sql.length && /[0-9a-fA-F]/.test(sql[j])) j++;
      tokens.push({ type: 'number', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers (integer, float, scientific notation)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      let j = i;
      while (j < sql.length && /[0-9]/.test(sql[j])) j++;
      if (sql[j] === '.') {
        j++;
        while (j < sql.length && /[0-9]/.test(sql[j])) j++;
      }
      if (sql[j] === 'e' || sql[j] === 'E') {
        j++;
        if (sql[j] === '+' || sql[j] === '-') j++;
        while (j < sql.length && /[0-9]/.test(sql[j])) j++;
      }
      tokens.push({ type: 'number', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Bound parameters: ?, ?1, :name, @name, $name
    if (ch === '?') {
      let j = i + 1;
      while (j < sql.length && /[0-9]/.test(sql[j])) j++;
      tokens.push({ type: 'parameter', value: sql.slice(i, j) });
      i = j;
      continue;
    }
    if ((ch === ':' || ch === '@' || ch === '$') && /[a-zA-Z_]/.test(sql[i + 1] ?? '')) {
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
      tokens.push({ type: 'parameter', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers / keywords / functions
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      const upper = word.toUpperCase();
      if (SQL_KEYWORDS.has(upper)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (SQL_FUNCTIONS.has(upper)) {
        tokens.push({ type: 'function', value: word });
      } else {
        tokens.push({ type: 'identifier', value: word });
      }
      i = j;
      continue;
    }

    // Operators (multi-char: <>, <=, >=, !=, ||, ->>, ->)
    if (/[=<>!+\-*/%&|^~]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[=<>!+\-*/%&|^~]/.test(sql[j])) j++;
      tokens.push({ type: 'operator', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Punctuation
    tokens.push({ type: 'punctuation', value: ch });
    i++;
  }

  return tokens;
}

export function formatSQL(sql: string): string {
  // Phrases that get a newline inserted before them (order matters — longer first)
  const BREAK_BEFORE = [
    'INSERT OR REPLACE INTO', 'INSERT OR IGNORE INTO', 'INSERT OR ABORT INTO',
    'INSERT OR FAIL INTO',
    'ON CONFLICT DO UPDATE SET', 'ON CONFLICT DO NOTHING',
    'EXPLAIN QUERY PLAN', 'EXPLAIN',
    'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN',
    'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
    'INNER JOIN', 'CROSS JOIN', 'NATURAL JOIN',
    'JOIN',
    'ORDER BY', 'GROUP BY', 'PARTITION BY',
    'HAVING', 'LIMIT', 'OFFSET',
    'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
    'SELECT', 'FROM', 'WHERE',
    'INSERT INTO', 'VALUES',
    'UPDATE', 'SET',
    'DELETE FROM',
    'CREATE TABLE', 'CREATE TEMP TABLE', 'CREATE TEMPORARY TABLE',
    'CREATE INDEX', 'CREATE UNIQUE INDEX',
    'CREATE VIEW', 'CREATE TRIGGER',
    'DROP TABLE', 'DROP INDEX', 'DROP VIEW', 'DROP TRIGGER',
    'ALTER TABLE',
    'WITH',
    'ON', 'USING',
    'AND', 'OR',
    'RETURNING',
  ];

  let result = sql.trim().replace(/\s+/g, ' ');

  for (const clause of BREAK_BEFORE) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${clause.replace(/\s+/g, '\\s+')}(?![A-Za-z0-9_])`, 'gi');
    result = result.replace(re, `\n${clause.toUpperCase()}`);
  }

  // Uppercase all keywords
  const tokens = tokenize(result);
  return tokens
    .map(t => (t.type === 'keyword' ? t.value.toUpperCase() : t.value))
    .join('')
    .trim();
}
