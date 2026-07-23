export type TokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'operator'
  | 'identifier'
  | 'whitespace'
  | 'punctuation';

export interface Token {
  type: TokenType;
  value: string;
}

const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE',
  'CREATE','TABLE','DROP','ALTER','ADD','COLUMN','INDEX','VIEW','TRIGGER',
  'JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','NATURAL','ON',
  'AND','OR','NOT','NULL','IS','IN','LIKE','GLOB','BETWEEN','EXISTS',
  'ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','DISTINCT','ALL','ANY',
  'AS','CASE','WHEN','THEN','ELSE','END','UNION','INTERSECT','EXCEPT',
  'PRIMARY','KEY','FOREIGN','REFERENCES','UNIQUE','CHECK','DEFAULT',
  'INTEGER','INT','TEXT','REAL','BLOB','NUMERIC','BOOLEAN','VARCHAR','CHAR',
  'DATETIME','DATE','TIME','FLOAT','DOUBLE','DECIMAL','BIGINT','SMALLINT',
  'TRANSACTION','BEGIN','COMMIT','ROLLBACK','SAVEPOINT','RELEASE','DEFERRED',
  'IMMEDIATE','EXCLUSIVE','AUTOINCREMENT','WITHOUT','ROWID','VIRTUAL',
  'EXPLAIN','PRAGMA','WITH','RECURSIVE','RETURNING','CONFLICT','REPLACE',
  'IGNORE','ABORT','FAIL','IF','ASC','DESC','CONSTRAINT','GENERATED',
  'ALWAYS','STORED','TEMPORARY','TEMP','ATTACH','DETACH','DATABASE',
  'REINDEX','VACUUM','ANALYZE','TRUE','FALSE',
]);

const SQL_FUNCTIONS = new Set([
  'COUNT','SUM','AVG','MIN','MAX','TOTAL','GROUP_CONCAT',
  'COALESCE','IFNULL','NULLIF','CAST','TYPEOF','LAST_INSERT_ROWID',
  'LENGTH','SUBSTR','SUBSTRING','UPPER','LOWER','TRIM','LTRIM','RTRIM',
  'REPLACE','INSTR','PRINTF','FORMAT','LIKE','GLOB','HEX','UNHEX','QUOTE',
  'DATE','TIME','DATETIME','JULIANDAY','STRFTIME','UNIXEPOCH',
  'ABS','ROUND','FLOOR','CEIL','CEILING','MOD','POW','POWER','SIGN',
  'RANDOM','RANDOMBLOB','ZEROBLOB','CHANGES','TOTAL_CHANGES','ROW_NUMBER',
  'RANK','DENSE_RANK','PERCENT_RANK','CUME_DIST','NTILE','LAG','LEAD',
  'FIRST_VALUE','LAST_VALUE','NTH_VALUE','OVER','PARTITION','FILTER',
  'IIF','CHAR','UNICODE','RTRIM','LTRIM','TRIM','SOUNDEX',
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

    // Double-quoted identifier
    if (ch === '"') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '"') j++;
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

    // Numbers
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      let j = i;
      while (j < sql.length && /[0-9.eExX_]/.test(sql[j])) j++;
      tokens.push({ type: 'number', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Named parameter :param / @param / $param
    if ((ch === ':' || ch === '@' || ch === '$') && /[a-zA-Z_]/.test(sql[i + 1] ?? '')) {
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
      tokens.push({ type: 'identifier', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Identifier / keyword / function
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

    // Operators
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
  const BREAK_BEFORE = [
    'SELECT', 'FROM', 'WHERE', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'FULL JOIN', 'CROSS JOIN', 'JOIN', 'ON', 'AND', 'OR', 'ORDER BY',
    'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION',
    'INTERSECT', 'EXCEPT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'WITH',
  ];

  let result = sql.trim();
  // Normalize whitespace
  result = result.replace(/\s+/g, ' ');

  // Break before clauses
  for (const clause of BREAK_BEFORE) {
    const re = new RegExp(`\\b${clause}\\b`, 'gi');
    result = result.replace(re, `\n${clause.toUpperCase()}`);
  }

  // Uppercase SQL keywords
  const tokens = tokenize(result);
  return tokens
    .map(t => (t.type === 'keyword' ? t.value.toUpperCase() : t.value))
    .join('')
    .trim();
}
