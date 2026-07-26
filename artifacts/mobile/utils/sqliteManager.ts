import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import {
  classifySQL,
  extractCTEAliases,
  extractTableAliases,
  formatSQLiteError,
  isDestructiveSQLText,
  splitSQLStatements,
  statementReturnsRows,
  type SQLStatementKind,
} from './sqlDiagnostics';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  insertId?: number;
  executionTime: number;
  error?: string;
  errorTitle?: string;
  errorHint?: string;
  type: 'select' | 'dml' | 'ddl' | 'pragma' | 'transaction' | 'explain' | 'maintenance' | 'error';
  statementCount?: number;
  statementKinds?: SQLStatementKind[];
  /** true when the result was clipped to maxRows — more rows exist in DB */
  truncated?: boolean;
  /** true when an explicit user transaction is open after this query executes */
  inTransaction?: boolean;
}

export interface TableInfo {
  name: string;
  type: 'table' | 'view' | 'index' | 'trigger';
  sql: string;
  rowCount?: number;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

// ─── All known PRAGMA names for autocomplete ─────────────────────────────────
export const SQLITE_PRAGMAS: readonly string[] = [
  'analysis_limit', 'application_id', 'auto_vacuum', 'automatic_index',
  'busy_timeout', 'cache_size', 'cache_spill', 'case_sensitive_like',
  'cell_size_check', 'checkpoint_fullfsync', 'collation_list',
  'compile_options', 'count_changes', 'data_store_directory',
  'data_version', 'database_list', 'defer_foreign_keys', 'empty_result_callbacks',
  'encoding', 'foreign_key_check', 'foreign_key_list', 'foreign_keys',
  'freelist_count', 'full_column_names', 'fullfsync', 'function_list',
  'hard_heap_limit', 'ignore_check_constraints', 'incremental_vacuum',
  'index_info', 'index_list', 'index_xinfo', 'integrity_check',
  'journal_mode', 'journal_size_limit', 'legacy_alter_table',
  'legacy_file_format', 'locking_mode', 'max_page_count', 'mmap_size',
  'module_list', 'optimize', 'page_count', 'page_size', 'pragma_list',
  'query_only', 'quick_check', 'read_uncommitted', 'recursive_triggers',
  'reverse_unordered_selects', 'schema_version', 'secure_delete',
  'short_column_names', 'shrink_memory', 'soft_heap_limit', 'stats',
  'synchronous', 'table_info', 'table_list', 'table_xinfo', 'temp_store',
  'temp_store_directory', 'threads', 'trusted_schema', 'user_version',
  'wal_autocheckpoint', 'wal_checkpoint', 'writable_schema',
];

// ─── All SQLite 3 built-in functions for autocomplete ────────────────────────
export const SQLITE_FUNCTIONS: readonly string[] = [
  // Aggregate
  'count', 'sum', 'avg', 'min', 'max', 'total', 'group_concat',
  // Core scalar
  'abs', 'char', 'coalesce', 'glob', 'hex', 'ifnull', 'iif', 'instr',
  'last_insert_rowid', 'length', 'like', 'likelihood', 'likely', 'lower', 'ltrim',
  'nullif', 'octet_length', 'printf', 'format', 'quote', 'random', 'randomblob',
  'replace', 'round', 'rtrim', 'sign', 'soundex', 'sqlite_compileoption_get',
  'sqlite_compileoption_used', 'sqlite_offset', 'sqlite_source_id', 'sqlite_version',
  'substr', 'substring', 'trim', 'typeof', 'unicode', 'unhex', 'unlikely', 'upper',
  'zeroblob', 'changes', 'total_changes', 'codepoint',
  // Math (SQLite 3.35+)
  'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
  'ceil', 'ceiling', 'cos', 'cosh', 'degrees', 'exp', 'floor',
  'ln', 'log', 'log2', 'log10', 'mod', 'pi', 'pow', 'power',
  'radians', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc',
  // Date / time
  'date', 'time', 'datetime', 'julianday', 'strftime', 'unixepoch', 'timediff',
  // Window
  'row_number', 'rank', 'dense_rank', 'percent_rank', 'cume_dist', 'ntile',
  'lag', 'lead', 'first_value', 'last_value', 'nth_value',
  // JSON
  'json', 'json_array', 'json_array_length', 'json_each', 'json_error_position',
  'json_extract', 'json_insert', 'json_object', 'json_patch', 'json_pretty',
  'json_quote', 'json_remove', 'json_replace', 'json_set', 'json_tree',
  'json_type', 'json_valid',
  // FTS
  'bm25', 'highlight', 'snippet',
];

const dbCache: Record<string, SQLite.SQLiteDatabase> = {};

/**
 * Per-database transaction state.
 *
 * beginActive  — an explicit BEGIN was executed and has not yet been COMMIT/ROLLBACKed.
 * savepointDepth — number of active SAVEPOINTs (can be > 0 even without a prior BEGIN,
 *                  because SAVEPOINT outside a transaction implicitly starts one).
 *
 * isInTransaction = beginActive || savepointDepth > 0
 *
 * State is updated ONLY after the statement executes successfully so a failed
 * BEGIN/SAVEPOINT never incorrectly marks the DB as in-transaction.
 */
interface TxState {
  beginActive: boolean;
  savepointDepth: number;
}
const txStateMap: Record<string, TxState> = {};

function getTxState(dbId: string): TxState {
  if (!txStateMap[dbId]) txStateMap[dbId] = { beginActive: false, savepointDepth: 0 };
  return txStateMap[dbId];
}

function applyTransactionStatement(dbId: string, statement: string): void {
  const upper = statement.trim().toUpperCase();
  const state = getTxState(dbId);
  if (/^BEGIN\b/i.test(upper)) {
    state.beginActive = true;
    // Do not reset savepointDepth — nested BEGIN is an error in SQLite, but keep safe
  } else if (/^(COMMIT|END)\b/i.test(upper)) {
    state.beginActive = false;
    state.savepointDepth = 0;
  } else if (/^ROLLBACK\b/i.test(upper)) {
    if (/^ROLLBACK\s+TO\b/i.test(upper)) {
      // ROLLBACK TO SAVEPOINT: stays in transaction, depth unchanged
    } else {
      // Bare ROLLBACK: ends everything
      state.beginActive = false;
      state.savepointDepth = 0;
    }
  } else if (/^SAVEPOINT\b/i.test(upper)) {
    state.savepointDepth++;
  } else if (/^RELEASE\b/i.test(upper)) {
    // RELEASE collapses one savepoint level; if savepointDepth reaches 0 and there
    // was no explicit BEGIN, the implicit transaction ends.
    state.savepointDepth = Math.max(0, state.savepointDepth - 1);
  }
}

/**
 * Safely escape a SQL identifier (table name, column name, index name).
 * Doubles any embedded double-quotes per SQLite spec so they cannot
 * break out of the quoted identifier and inject arbitrary SQL.
 * Usage: `"${escapeIdentifier(name)}"`
 */
function escapeIdentifier(name: string): string {
  return name.replace(/"/g, '""');
}

async function openDb(dbId: string): Promise<SQLite.SQLiteDatabase> {
  if (!dbCache[dbId]) {
    try {
      dbCache[dbId] = await SQLite.openDatabaseAsync(`sqlstudio_${dbId}.db`);
    } catch (e) {
      if (isCorruptionError(e)) throw new DatabaseCorruptError(dbId, e as Error);
      throw e;
    }
  }
  return dbCache[dbId];
}

// ─── Corrupt DB detection ────────────────────────────────────────────────────

/** Thrown when SQLite reports the database file is irrecoverably damaged. */
export class DatabaseCorruptError extends Error {
  constructor(dbId: string, cause: Error) {
    super(`Database "${dbId}" is corrupt: ${cause.message}`);
    this.name = 'DatabaseCorruptError';
  }
}

const CORRUPT_PATTERNS = [
  'database disk image is malformed',
  'file is not a database',
  'database is corrupt',
  'database corruption',
];

function isCorruptionError(e: unknown): boolean {
  const msg = ((e as Error)?.message ?? '').toLowerCase();
  return CORRUPT_PATTERNS.some(p => msg.includes(p));
}

function resultTypeForKind(
  kind: SQLStatementKind,
): Exclude<QueryResult['type'], 'error' | 'select'> | 'select' {
  if (kind === 'select') return 'select';
  if (kind === 'dml') return 'dml';
  if (kind === 'ddl') return 'ddl';
  if (kind === 'pragma') return 'pragma';
  if (kind === 'transaction') return 'transaction';
  if (kind === 'explain') return 'explain';
  if (kind === 'maintenance') return 'maintenance';
  return 'ddl';
}

/**
 * Execute one or more SQL statements against a local database.
 *
 * - Statements are split with a SQL-aware tokenizer (not a simple semicolon split).
 * - Each statement is classified so the correct expo-sqlite API is used.
 * - Read statements (SELECT, EXPLAIN, read PRAGMA) use getAllAsync.
 * - Write statements (DML, DDL, write PRAGMA, maintenance) use runAsync.
 * - DML with RETURNING is treated as a read statement.
 * - maxRows: when set, SELECT/EXPLAIN queries fetch at most maxRows+1 rows so
 *   truncation can be detected without loading the full result set into memory.
 */
export async function executeQuery(
  dbId: string,
  sql: string,
  maxRows?: number,
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    const statements = splitSQLStatements(sql);
    if (statements.length === 0) {
      return {
        columns: [], rows: [], rowsAffected: 0,
        executionTime: Date.now() - start,
        error: 'Enter a SQLite statement to run.',
        type: 'error',
      };
    }

    let finalColumns: string[] = [];
    let finalRows: Record<string, unknown>[] = [];
    let finalType: QueryResult['type'] = 'ddl';
    let finalInsertId: number | undefined;
    let truncated = false;
    let rowsAffected = 0;
    const statementKinds: SQLStatementKind[] = [];

    for (const statement of statements) {
      const kind = classifySQL(statement);
      statementKinds.push(kind);
      if (kind === 'ddl') invalidateCompletionCache(dbId);

      const returnsRows = statementReturnsRows(statement, kind);
      const isLimited = kind === 'select' || kind === 'explain';
      const cap =
        maxRows && maxRows > 0 && isLimited && !/\bLIMIT\b/i.test(statement)
          ? maxRows
          : undefined;
      const querySql = cap
        ? `${statement.trim().replace(/;$/, '')} LIMIT ${cap + 1}`
        : statement;

      if (returnsRows) {
        const allRows = await db.getAllAsync<Record<string, unknown>>(querySql);
        const clipped = cap !== undefined && allRows.length > cap;
        truncated = truncated || clipped;
        finalRows = clipped ? allRows.slice(0, cap) : allRows;
        finalColumns = finalRows.length > 0
          ? Object.keys(finalRows[0])
          : [];
      } else {
        const result = await db.runAsync(statement);
        rowsAffected += result.changes;
        finalInsertId = result.lastInsertRowId ?? finalInsertId;
      }

      // Update transaction state AFTER successful execution.
      // A failed statement throws before reaching here, so state is never
      // updated for commands that did not actually execute.
      if (kind === 'transaction') {
        applyTransactionStatement(dbId, statement);
      }

      finalType = resultTypeForKind(kind);
    }

    return {
      columns: finalColumns,
      rows: finalRows,
      rowsAffected,
      insertId: finalInsertId,
      executionTime: Date.now() - start,
      type: finalType,
      statementCount: statements.length,
      statementKinds,
      truncated: truncated || undefined,
      inTransaction: isInTransaction(dbId) || undefined,
    };
  } catch (e) {
    if (e instanceof DatabaseCorruptError) throw e;
    if (isCorruptionError(e)) throw new DatabaseCorruptError(dbId, e as Error);
    const details = formatSQLiteError(e);
    return {
      columns: [], rows: [], rowsAffected: 0,
      executionTime: Date.now() - start,
      error: details.message,
      errorTitle: details.title,
      errorHint: details.hint,
      type: 'error',
      statementCount: splitSQLStatements(sql).length,
    };
  }
}

// ─── Schema-aware autocomplete ────────────────────────────────────────────────

export interface SQLCompletionItems {
  tables: string[];
  views: string[];
  columns: string[];
  indexes: string[];
  triggers: string[];
  /** PRAGMA names for the PRAGMA keyword context */
  pragmas: string[];
  /** Built-in function names */
  functions: string[];
  /** CTE aliases extracted from the current SQL */
  cteAliases: string[];
  /** Table aliases extracted from the current SQL */
  tableAliases: string[];
}

const completionCache: Record<string, Omit<SQLCompletionItems, 'cteAliases' | 'tableAliases'>> = {};

/**
 * Fetch schema-aware completion items.
 * @param dbId      The open database identifier.
 * @param currentSql  Optional: the SQL currently in the editor, used to
 *                    extract CTE aliases and table aliases for context-sensitive suggestions.
 */
export async function getSQLCompletionItems(
  dbId: string,
  currentSql?: string,
): Promise<SQLCompletionItems> {
  if (!completionCache[dbId]) {
    const db = await openDb(dbId);
    const objects = await db.getAllAsync<{ name: string; type: string }>(
      `SELECT name, type FROM sqlite_master
       WHERE type IN ('table', 'view', 'index', 'trigger')
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    );
    const tables = objects.filter(item => item.type === 'table').map(item => item.name);
    const views = objects.filter(item => item.type === 'view').map(item => item.name);
    const indexes = objects.filter(item => item.type === 'index').map(item => item.name);
    const triggers = objects.filter(item => item.type === 'trigger').map(item => item.name);
    const columnSets = await Promise.all(
      [...tables, ...views].map(async name => {
        try {
          return await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${escapeIdentifier(name)}")`);
        } catch {
          return [];
        }
      }),
    );
    const columns = Array.from(new Set(columnSets.flat().map(item => item.name))).sort();
    completionCache[dbId] = {
      tables, views, columns, indexes, triggers,
      pragmas: [...SQLITE_PRAGMAS],
      functions: [...SQLITE_FUNCTIONS],
    };
  }

  const cached = completionCache[dbId];
  const cteAliases = currentSql ? extractCTEAliases(currentSql) : [];
  const tableAliases = currentSql ? extractTableAliases(currentSql) : [];

  return { ...cached, cteAliases, tableAliases };
}

function invalidateCompletionCache(dbId: string): void {
  delete completionCache[dbId];
}

export async function executeMultipleStatements(dbId: string, sql: string): Promise<QueryResult> {
  return executeQuery(dbId, sql);
}

export async function getTables(dbId: string): Promise<TableInfo[]> {
  const db = await openDb(dbId);
  const items = await db.getAllAsync<{ name: string; type: string; sql: string }>(
    `SELECT name, type, sql FROM sqlite_master
     WHERE type IN ('table', 'view', 'index', 'trigger')
       AND name NOT LIKE 'sqlite_%'
     ORDER BY type, name`,
  );

  const result: TableInfo[] = [];
  for (const item of items) {
    let rowCount: number | undefined;
    if (item.type === 'table') {
      try {
        const countResult = await db.getAllAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM "${escapeIdentifier(item.name)}"`,
        );
        rowCount = countResult[0]?.count ?? 0;
      } catch {
        rowCount = 0;
      }
    }
    result.push({
      name: item.name,
      type: item.type as TableInfo['type'],
      sql: item.sql || '',
      rowCount,
    });
  }
  return result;
}

export async function getColumns(dbId: string, tableName: string): Promise<ColumnInfo[]> {
  const db = await openDb(dbId);
  return db.getAllAsync<ColumnInfo>(`PRAGMA table_info("${escapeIdentifier(tableName)}")`);
}

export async function getTableData(
  dbId: string,
  tableName: string,
  limit = 100,
  offset = 0,
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const db = await openDb(dbId);
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM "${escapeIdentifier(tableName)}" LIMIT ${limit} OFFSET ${offset}`,
  );
  if (rows.length > 0) return { columns: Object.keys(rows[0]), rows };
  const colInfo = await getColumns(dbId, tableName);
  return { columns: colInfo.map(c => c.name), rows: [] };
}

export async function getTableRowCount(dbId: string, tableName: string): Promise<number> {
  try {
    const db = await openDb(dbId);
    const result = await db.getAllAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM "${escapeIdentifier(tableName)}"`,
    );
    return result[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getIndexes(dbId: string, tableName: string): Promise<IndexInfo[]> {
  const db = await openDb(dbId);
  return db.getAllAsync<IndexInfo>(`PRAGMA index_list("${escapeIdentifier(tableName)}")`);
}

export async function initDatabase(dbId: string): Promise<void> {
  await openDb(dbId);
}

export async function closeDatabase(dbId: string): Promise<void> {
  if (dbCache[dbId]) {
    await dbCache[dbId].closeAsync();
    delete dbCache[dbId];
  }
  invalidateCompletionCache(dbId);
  delete txStateMap[dbId];
}

/**
 * Returns true when an explicit user transaction (or any open SAVEPOINT) is active
 * for this database — i.e. there is uncommitted work the user needs to COMMIT or ROLLBACK.
 */
export function isInTransaction(dbId: string): boolean {
  const state = txStateMap[dbId];
  if (!state) return false;
  return state.beginActive || state.savepointDepth > 0;
}

export async function getDatabaseStats(
  dbId: string,
): Promise<{ pageSize: number; pageCount: number; sizeBytes: number }> {
  try {
    const db = await openDb(dbId);
    const ps = await db.getAllAsync<{ page_size: number }>('PRAGMA page_size');
    const pc = await db.getAllAsync<{ page_count: number }>('PRAGMA page_count');
    const pageSize = ps[0]?.page_size ?? 4096;
    const pageCount = pc[0]?.page_count ?? 1;
    return { pageSize, pageCount, sizeBytes: pageSize * pageCount };
  } catch {
    return { pageSize: 4096, pageCount: 1, sizeBytes: 4096 };
  }
}

// ─── SQLite engine capabilities ──────────────────────────────────────────────

export interface SQLiteCapabilities {
  version: string;
  compileOptions: string[];
  supportsReturning: boolean;
  supportsWindowFunctions: boolean;
  supportsJsonFunctions: boolean;
  supportsStrictTables: boolean;
  supportsGeneratedColumns: boolean;
  supportsMathFunctions: boolean;
}

/**
 * Reports the capabilities of the SQLite engine actually running on this
 * device. SQLite features vary by OS/runtime build, so UI should use this
 * rather than claiming every optional extension is always available.
 */
export async function getSQLiteCapabilities(dbId: string): Promise<SQLiteCapabilities> {
  const db = await openDb(dbId);
  const versionRows = await db.getAllAsync<{ version: string }>('SELECT sqlite_version() AS version');
  let compileOptions: string[] = [];
  try {
    const rows = await db.getAllAsync<{ compile_options: string }>('PRAGMA compile_options');
    compileOptions = rows.map(row => row.compile_options);
  } catch {
    // Some SQLite builds omit compile_options; the core version remains useful.
  }
  const version = versionRows[0]?.version ?? 'unknown';
  const parts = version.split('.').map(p => Number(p) || 0);
  const atLeast = (major: number, minor: number, patch: number) =>
    parts[0] > major ||
    (parts[0] === major && (parts[1] > minor || (parts[1] === minor && parts[2] >= patch)));

  return {
    version,
    compileOptions,
    supportsReturning: atLeast(3, 35, 0),
    supportsWindowFunctions: atLeast(3, 25, 0),
    supportsJsonFunctions: !compileOptions.some(o => o === 'OMIT_JSON'),
    supportsStrictTables: atLeast(3, 37, 0),
    supportsGeneratedColumns: atLeast(3, 31, 0),
    supportsMathFunctions: atLeast(3, 35, 0),
  };
}

/** Convenience shortcut to just get the SQLite version string. */
export async function getSQLiteVersion(dbId: string): Promise<string> {
  try {
    const db = await openDb(dbId);
    const rows = await db.getAllAsync<{ version: string }>('SELECT sqlite_version() AS version');
    return rows[0]?.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Chunked export ───────────────────────────────────────────────────────────

const EXPORT_CHUNK_SIZE = 500;

export async function exportTableToCSV(dbId: string, tableName: string): Promise<string> {
  const db = await openDb(dbId);
  const escaped = escapeIdentifier(tableName);

  const csvEscape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  let headers: string[] | null = null;
  const chunks: string[] = [];
  let offset = 0;

  while (true) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM "${escaped}" LIMIT ${EXPORT_CHUNK_SIZE} OFFSET ${offset}`,
    );
    if (rows.length === 0) break;
    if (!headers) {
      headers = Object.keys(rows[0]);
      chunks.push(headers.join(','));
    }
    for (const row of rows) chunks.push(headers.map(h => csvEscape(row[h])).join(','));
    offset += rows.length;
    if (rows.length < EXPORT_CHUNK_SIZE) break;
  }
  return chunks.join('\n');
}

export async function exportTableToJSON(dbId: string, tableName: string): Promise<string> {
  const db = await openDb(dbId);
  const escaped = escapeIdentifier(tableName);

  const parts: string[] = ['[\n'];
  let offset = 0;
  let firstRow = true;

  while (true) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM "${escaped}" LIMIT ${EXPORT_CHUNK_SIZE} OFFSET ${offset}`,
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      parts.push(`${firstRow ? '' : ',\n'}  ${JSON.stringify(row)}`);
      firstRow = false;
    }
    offset += rows.length;
    if (rows.length < EXPORT_CHUNK_SIZE) break;
  }

  parts.push('\n]');
  return parts.join('');
}

export async function exportDatabaseToSQL(dbId: string): Promise<string> {
  const db = await openDb(dbId);
  const tables = await db.getAllAsync<{ name: string; type: string; sql: string }>(
    `SELECT name, type, sql FROM sqlite_master
     WHERE type IN ('table','view','index','trigger')
       AND name NOT LIKE 'sqlite_%'`,
  );

  const parts: string[] = [
    '-- SQL Studio Pro Export\n',
    `-- Generated: ${new Date().toISOString()}\n\n`,
    'PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n\n',
  ];

  const sqlVal = (v: unknown) =>
    v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

  for (const t of tables) {
    if (t.sql) parts.push(`${t.sql};\n\n`);
    if (t.type === 'table') {
      try {
        const escaped = escapeIdentifier(t.name);
        let offset = 0;
        let cols: string[] | null = null;

        while (true) {
          const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT * FROM "${escaped}" LIMIT ${EXPORT_CHUNK_SIZE} OFFSET ${offset}`,
          );
          if (rows.length === 0) break;
          if (!cols) {
            cols = Object.keys(rows[0]).map(c => `"${escapeIdentifier(c)}"`);
          }
          const colStr = cols.join(', ');
          for (const row of rows) {
            const vals = Object.values(row).map(sqlVal).join(', ');
            parts.push(`INSERT INTO "${escaped}" (${colStr}) VALUES (${vals});\n`);
          }
          offset += rows.length;
          if (rows.length < EXPORT_CHUNK_SIZE) break;
        }
        parts.push('\n');
      } catch { /* skip unreadable tables */ }
    }
  }

  parts.push('COMMIT;\nPRAGMA foreign_keys=ON;\n');
  return parts.join('');
}

// ─── Integrity checks ─────────────────────────────────────────────────────────

export async function checkIntegrity(dbId: string): Promise<{ ok: boolean; issues: string[] }> {
  try {
    const db = await openDb(dbId);
    const rows = await db.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    const issues = rows.map(r => r.integrity_check).filter(s => s !== 'ok');
    return { ok: issues.length === 0, issues };
  } catch (e) {
    return { ok: false, issues: [(e as Error).message] };
  }
}

export async function getForeignKeyCheck(dbId: string): Promise<{ ok: boolean; issues: string[] }> {
  try {
    const db = await openDb(dbId);
    const rows = await db.getAllAsync<Record<string, unknown>>('PRAGMA foreign_key_check');
    if (rows.length === 0) return { ok: true, issues: [] };
    const issues = rows.map(r =>
      `Table "${r['table']}" row ${r['rowid']}: FK violation → "${r['parent']}"`,
    );
    return { ok: false, issues };
  } catch (e) {
    return { ok: false, issues: [(e as Error).message] };
  }
}

export interface TableStats {
  name: string;
  rowCount: number;
  sizeEstimateBytes: number;
}

export async function getAllTableStats(dbId: string): Promise<TableStats[]> {
  const db = await openDb(dbId);
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  );
  const ps = await db.getAllAsync<{ page_size: number }>('PRAGMA page_size');
  const pageSize = ps[0]?.page_size ?? 4096;

  const stats: TableStats[] = [];
  for (const t of tables) {
    try {
      const countRes = await db.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM "${escapeIdentifier(t.name)}"`,
      );
      const rowCount = countRes[0]?.count ?? 0;
      stats.push({ name: t.name, rowCount, sizeEstimateBytes: rowCount * pageSize * 0.1 });
    } catch {
      stats.push({ name: t.name, rowCount: 0, sizeEstimateBytes: 0 });
    }
  }
  return stats;
}

export async function getIndexDetail(dbId: string, indexName: string): Promise<Record<string, unknown>[]> {
  const db = await openDb(dbId);
  return db.getAllAsync<Record<string, unknown>>(`PRAGMA index_info("${escapeIdentifier(indexName)}")`);
}

export async function dropIndex(dbId: string, indexName: string): Promise<QueryResult> {
  return executeQuery(dbId, `DROP INDEX IF EXISTS "${escapeIdentifier(indexName)}"`);
}

export function getDatabaseFilename(dbId: string): string {
  return `sqlstudio_${dbId}.db`;
}

export async function dbFileExists(dbId: string): Promise<boolean> {
  try {
    const dir = (FileSystem as any).documentDirectory ?? '';
    const path = `${dir}SQLite/sqlstudio_${dbId}.db`;
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

export async function deleteDbFile(dbId: string): Promise<void> {
  await closeDatabase(dbId);
  try {
    const dir = (FileSystem as any).documentDirectory ?? '';
    const path = `${dir}SQLite/sqlstudio_${dbId}.db`;
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // best-effort — ignore if file is already gone
  }
}

// ─── Row CRUD ─────────────────────────────────────────────────────────────────

export async function insertRow(
  dbId: string,
  tableName: string,
  values: Record<string, unknown>,
): Promise<QueryResult> {
  const cols = Object.keys(values).map(c => `"${escapeIdentifier(c)}"`).join(', ');
  const placeholders = Object.keys(values).map(() => '?').join(', ');
  const params = Object.values(values) as any;
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    const r = await db.runAsync(
      `INSERT INTO "${escapeIdentifier(tableName)}" (${cols}) VALUES (${placeholders})`,
      params,
    );
    return { columns: [], rows: [], rowsAffected: r.changes, insertId: r.lastInsertRowId ?? undefined, executionTime: Date.now() - start, type: 'dml' };
  } catch (e) {
    return { columns: [], rows: [], rowsAffected: 0, executionTime: Date.now() - start, error: (e as Error).message, type: 'error' };
  }
}

export async function updateRow(
  dbId: string,
  tableName: string,
  pkCol: string,
  pkVal: unknown,
  values: Record<string, unknown>,
): Promise<QueryResult> {
  const setClauses = Object.keys(values).map(c => `"${escapeIdentifier(c)}" = ?`).join(', ');
  const params = [...Object.values(values), pkVal] as any;
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    const r = await db.runAsync(
      `UPDATE "${escapeIdentifier(tableName)}" SET ${setClauses} WHERE "${escapeIdentifier(pkCol)}" = ?`,
      params,
    );
    return { columns: [], rows: [], rowsAffected: r.changes, executionTime: Date.now() - start, type: 'dml' };
  } catch (e) {
    return { columns: [], rows: [], rowsAffected: 0, executionTime: Date.now() - start, error: (e as Error).message, type: 'error' };
  }
}

export async function deleteRow(
  dbId: string,
  tableName: string,
  pkCol: string,
  pkVal: unknown,
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    const r = await db.runAsync(
      `DELETE FROM "${escapeIdentifier(tableName)}" WHERE "${escapeIdentifier(pkCol)}" = ?`,
      [pkVal] as any,
    );
    return { columns: [], rows: [], rowsAffected: r.changes, executionTime: Date.now() - start, type: 'dml' };
  } catch (e) {
    return { columns: [], rows: [], rowsAffected: 0, executionTime: Date.now() - start, error: (e as Error).message, type: 'error' };
  }
}

// ─── CSV / SQL import ─────────────────────────────────────────────────────────

export async function importCSVToTable(
  dbId: string,
  tableName: string,
  csv: string,
): Promise<{ imported: number; errors: string[] }> {
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return { imported: 0, errors: ['CSV must have a header row and at least one data row.'] };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let inQuotes = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur); cur = '';
      } else { cur += ch; }
    }
    result.push(cur);
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  const errors: string[] = [];
  let imported = 0;

  const db = await openDb(dbId);
  const colList = headers.map(h => `"${escapeIdentifier(h.trim())}"`).join(', ');
  const placeholders = headers.map(() => '?').join(', ');
  const stmt = `INSERT INTO "${escapeIdentifier(tableName)}" (${colList}) VALUES (${placeholders})`;

  for (let i = 1; i < lines.length; i++) {
    try {
      const vals = parseCSVLine(lines[i]);
      await db.runAsync(stmt, vals);
      imported++;
    } catch (e) {
      errors.push(`Row ${i}: ${(e as Error).message}`);
    }
  }
  return { imported, errors };
}

export async function importSQLFile(dbId: string, sql: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await executeQuery(dbId, sql);
    if (result.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatSQLiteError(e).message };
  }
}

// ─── Schema / ER diagram ─────────────────────────────────────────────────────

export interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

export async function getForeignKeys(dbId: string, tableName: string): Promise<ForeignKeyInfo[]> {
  try {
    const db = await openDb(dbId);
    return db.getAllAsync<ForeignKeyInfo>(`PRAGMA foreign_key_list("${escapeIdentifier(tableName)}")`);
  } catch {
    return [];
  }
}

export interface ERTable {
  name: string;
  sql: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export async function getERSchema(dbId: string): Promise<ERTable[]> {
  const db = await openDb(dbId);
  const tables = await db.getAllAsync<{ name: string; sql: string }>(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  );
  const result: ERTable[] = [];
  for (const t of tables) {
    const [columns, foreignKeys] = await Promise.all([
      getColumns(dbId, t.name),
      getForeignKeys(dbId, t.name),
    ]);
    result.push({ name: t.name, sql: t.sql, columns, foreignKeys });
  }
  return result;
}

// ─── Transaction helpers ──────────────────────────────────────────────────────

export async function beginTransaction(dbId: string, mode: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE' = 'DEFERRED'): Promise<QueryResult> {
  return executeQuery(dbId, `BEGIN ${mode}`);
}

export async function commitTransaction(dbId: string): Promise<QueryResult> {
  return executeQuery(dbId, 'COMMIT');
}

export async function rollbackTransaction(dbId: string): Promise<QueryResult> {
  return executeQuery(dbId, 'ROLLBACK');
}

// ─── SAVEPOINT helpers ────────────────────────────────────────────────────────

/**
 * Create a savepoint. Name must be a valid SQL identifier.
 * Usage: SAVEPOINT sp1 → RELEASE sp1 (commit) or ROLLBACK TO sp1 (undo).
 */
export async function savepointBegin(dbId: string, name: string): Promise<QueryResult> {
  // Validate: name should be a simple identifier
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return {
      columns: [], rows: [], rowsAffected: 0, executionTime: 0,
      error: `Invalid savepoint name: "${name}". Use letters, digits, and underscores only.`,
      type: 'error',
    };
  }
  return executeQuery(dbId, `SAVEPOINT "${escapeIdentifier(name)}"`);
}

/** Commit all changes made since the savepoint was established. */
export async function savepointRelease(dbId: string, name: string): Promise<QueryResult> {
  return executeQuery(dbId, `RELEASE SAVEPOINT "${escapeIdentifier(name)}"`);
}

/** Roll back changes to the state at the savepoint (savepoint itself remains active). */
export async function savepointRollback(dbId: string, name: string): Promise<QueryResult> {
  return executeQuery(dbId, `ROLLBACK TO SAVEPOINT "${escapeIdentifier(name)}"`);
}

// ─── EXPLAIN QUERY PLAN ───────────────────────────────────────────────────────

export interface ExplainRow {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export async function explainQueryPlan(dbId: string, sql: string): Promise<ExplainRow[]> {
  try {
    const db = await openDb(dbId);
    return db.getAllAsync<ExplainRow>(`EXPLAIN QUERY PLAN ${sql}`);
  } catch {
    return [];
  }
}

// ─── Destructive SQL detection ────────────────────────────────────────────────

export function isDestructiveSQL(sql: string): boolean {
  return isDestructiveSQLText(sql);
}
