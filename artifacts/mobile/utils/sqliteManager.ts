import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  insertId?: number;
  executionTime: number;
  error?: string;
  type: 'select' | 'dml' | 'ddl' | 'error';
  /** true when the result was clipped to maxRows — more rows exist in DB */
  truncated?: boolean;
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

const dbCache: Record<string, SQLite.SQLiteDatabase> = {};

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

// ─── Task 1.7: Corrupt DB detection ────────────────────────────────────────

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

// ─── READ-ONLY keyword set ───────────────────────────────────────────────────

/**
 * READ-ONLY keywords: queries that return rows and must use getAllAsync.
 * Everything else (INSERT/UPDATE/DELETE/CREATE/DROP…) uses runAsync.
 */
const READ_ONLY_KEYWORDS = new Set([
  'SELECT', 'WITH', 'EXPLAIN', 'PRAGMA', 'SHOW', 'VALUES',
]);

/**
 * Strip leading SQL comments and whitespace, then check the first keyword.
 * Handles:
 *   -- single-line comments
 *   /* multi-line block comments *\/
 *   mixed leading whitespace
 * This avoids false negatives like "-- get users\nSELECT ..." being
 * classified as a DML statement.
 */
function isSelectStatement(sql: string): boolean {
  let s = sql;

  // Repeatedly strip leading whitespace and comments until the real SQL starts
  while (true) {
    s = s.trimStart();
    if (s.startsWith('--')) {
      // single-line comment: skip to end of line
      const nl = s.indexOf('\n');
      s = nl === -1 ? '' : s.slice(nl + 1);
    } else if (s.startsWith('/*')) {
      // block comment: skip to closing */
      const end = s.indexOf('*/');
      s = end === -1 ? '' : s.slice(end + 2);
    } else {
      break;
    }
  }

  // Extract the first word (the SQL verb)
  const match = s.match(/^([A-Za-z_]+)/);
  if (!match) return false;
  return READ_ONLY_KEYWORDS.has(match[1].toUpperCase());
}

/**
 * Execute a SQL statement.
 * @param maxRows  When set, SELECT queries fetch at most maxRows+1 rows so we
 *                 can detect truncation without loading the full result set.
 *                 Ignored for DML/DDL.
 */
export async function executeQuery(
  dbId: string,
  sql: string,
  maxRows?: number
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const db = await openDb(dbId);

    if (isSelectStatement(sql)) {
      // Task 1.6: cap rows at the DB level so we never load millions into memory.
      // We fetch maxRows+1; if we get that many we know the result was truncated.
      let querySql = sql;
      let cap: number | undefined;
      if (maxRows && maxRows > 0 && !/\bLIMIT\b/i.test(sql)) {
        cap = maxRows;
        querySql = `${sql.trimEnd().replace(/;$/, '')} LIMIT ${maxRows + 1}`;
      }

      const allRows = await db.getAllAsync<Record<string, unknown>>(querySql);
      const truncated = cap !== undefined && allRows.length > cap;
      const rows = truncated ? allRows.slice(0, cap) : allRows;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        columns,
        rows,
        rowsAffected: 0,
        executionTime: Date.now() - start,
        type: 'select',
        truncated,
      };
    } else {
      const result = await db.runAsync(sql);
      return {
        columns: [],
        rows: [],
        rowsAffected: result.changes,
        insertId: result.lastInsertRowId ?? undefined,
        executionTime: Date.now() - start,
        type: 'dml',
      };
    }
  } catch (e) {
    // Re-throw corruption errors so callers can offer targeted recovery.
    if (e instanceof DatabaseCorruptError) throw e;
    if (isCorruptionError(e)) throw new DatabaseCorruptError(dbId, e as Error);
    return {
      columns: [],
      rows: [],
      rowsAffected: 0,
      executionTime: Date.now() - start,
      error: (e as Error).message,
      type: 'error',
    };
  }
}

export async function executeMultipleStatements(dbId: string, sql: string): Promise<QueryResult> {
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    await db.execAsync(sql);
    return {
      columns: [],
      rows: [],
      rowsAffected: 0,
      executionTime: Date.now() - start,
      type: 'ddl',
    };
  } catch (e) {
    return {
      columns: [],
      rows: [],
      rowsAffected: 0,
      executionTime: Date.now() - start,
      error: (e as Error).message,
      type: 'error',
    };
  }
}

export async function getTables(dbId: string): Promise<TableInfo[]> {
  const db = await openDb(dbId);
  const items = await db.getAllAsync<{ name: string; type: string; sql: string }>(
    `SELECT name, type, sql FROM sqlite_master
     WHERE type IN ('table', 'view', 'index', 'trigger')
       AND name NOT LIKE 'sqlite_%'
     ORDER BY type, name`
  );

  const result: TableInfo[] = [];
  for (const item of items) {
    let rowCount: number | undefined;
    if (item.type === 'table') {
      try {
        const countResult = await db.getAllAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM "${escapeIdentifier(item.name)}"`
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
  offset = 0
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const db = await openDb(dbId);
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM "${escapeIdentifier(tableName)}" LIMIT ${limit} OFFSET ${offset}`
  );
  if (rows.length > 0) {
    return { columns: Object.keys(rows[0]), rows };
  }
  const colInfo = await getColumns(dbId, tableName);
  return { columns: colInfo.map(c => c.name), rows: [] };
}

export async function getTableRowCount(dbId: string, tableName: string): Promise<number> {
  try {
    const db = await openDb(dbId);
    const result = await db.getAllAsync<{ count: number }>(`SELECT COUNT(*) as count FROM "${escapeIdentifier(tableName)}"`);
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
}

export async function getDatabaseStats(dbId: string): Promise<{ pageSize: number; pageCount: number; sizeBytes: number }> {
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

/**
 * Rows fetched per DB round-trip during exports.
 * Keeps peak JS heap usage bounded on large tables.
 */
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

  // Fetch rows in chunks so we never hold the full table in memory at once
  while (true) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM "${escaped}" LIMIT ${EXPORT_CHUNK_SIZE} OFFSET ${offset}`
    );
    if (rows.length === 0) break;

    if (!headers) {
      headers = Object.keys(rows[0]);
      chunks.push(headers.join(','));
    }
    for (const row of rows) {
      chunks.push(headers.map(h => csvEscape(row[h])).join(','));
    }
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

  // Stream JSON array row-by-row in chunks to avoid one giant array in memory
  while (true) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM "${escaped}" LIMIT ${EXPORT_CHUNK_SIZE} OFFSET ${offset}`
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
    const issues = rows.map(r => `Table "${r['table']}" row ${r['rowid']}: FK violation → "${r['parent']}"`);
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
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  );
  const ps = await db.getAllAsync<{ page_size: number }>('PRAGMA page_size');
  const pageSize = ps[0]?.page_size ?? 4096;

  const stats: TableStats[] = [];
  for (const t of tables) {
    try {
      const countRes = await db.getAllAsync<{ count: number }>(`SELECT COUNT(*) as count FROM "${escapeIdentifier(t.name)}"`);
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

/**
 * Returns true when the physical SQLite file exists on disk.
 * Use this to detect databases that were registered in AsyncStorage
 * but whose files were deleted or never created (e.g. after a reinstall
 * of app data without clearing AsyncStorage).
 */
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

/**
 * Close the in-memory connection and delete the physical .db file.
 * Called by DatabaseContext.deleteDatabase so the file doesn't linger.
 */
export async function deleteDbFile(dbId: string): Promise<void> {
  await closeDatabase(dbId); // flush cache first
  try {
    const dir = (FileSystem as any).documentDirectory ?? '';
    const path = `${dir}SQLite/sqlstudio_${dbId}.db`;
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // best-effort — ignore if file is already gone
  }
}

// ─── Task 2.8: Row CRUD ──────────────────────────────────────────────────────

/** Insert a new row. values is a column→value map. */
export async function insertRow(
  dbId: string,
  tableName: string,
  values: Record<string, unknown>
): Promise<QueryResult> {
  const cols = Object.keys(values).map(c => `"${escapeIdentifier(c)}"`).join(', ');
  const placeholders = Object.keys(values).map(() => '?').join(', ');
  // Cast to any to satisfy expo-sqlite's strict SQLiteBindParams type
  const params = Object.values(values) as any;
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    const r = await db.runAsync(
      `INSERT INTO "${escapeIdentifier(tableName)}" (${cols}) VALUES (${placeholders})`,
      params
    );
    return { columns: [], rows: [], rowsAffected: r.changes, insertId: r.lastInsertRowId ?? undefined, executionTime: Date.now() - start, type: 'dml' };
  } catch (e) {
    return { columns: [], rows: [], rowsAffected: 0, executionTime: Date.now() - start, error: (e as Error).message, type: 'error' };
  }
}

/** Update a row identified by primary key. values is a column→value map. */
export async function updateRow(
  dbId: string,
  tableName: string,
  pkCol: string,
  pkVal: unknown,
  values: Record<string, unknown>
): Promise<QueryResult> {
  const setClauses = Object.keys(values).map(c => `"${escapeIdentifier(c)}" = ?`).join(', ');
  const params = [...Object.values(values), pkVal] as any;
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    const r = await db.runAsync(
      `UPDATE "${escapeIdentifier(tableName)}" SET ${setClauses} WHERE "${escapeIdentifier(pkCol)}" = ?`,
      params
    );
    return { columns: [], rows: [], rowsAffected: r.changes, executionTime: Date.now() - start, type: 'dml' };
  } catch (e) {
    return { columns: [], rows: [], rowsAffected: 0, executionTime: Date.now() - start, error: (e as Error).message, type: 'error' };
  }
}

/** Delete a row by primary key value. */
export async function deleteRow(
  dbId: string,
  tableName: string,
  pkCol: string,
  pkVal: unknown
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const db = await openDb(dbId);
    const r = await db.runAsync(
      `DELETE FROM "${escapeIdentifier(tableName)}" WHERE "${escapeIdentifier(pkCol)}" = ?`,
      [pkVal] as any
    );
    return { columns: [], rows: [], rowsAffected: r.changes, executionTime: Date.now() - start, type: 'dml' };
  } catch (e) {
    return { columns: [], rows: [], rowsAffected: 0, executionTime: Date.now() - start, error: (e as Error).message, type: 'error' };
  }
}

// ─── Task 2.10: CSV import ───────────────────────────────────────────────────

/** Parse a CSV string and insert rows into an existing table. */
export async function importCSVToTable(
  dbId: string,
  tableName: string,
  csv: string
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
      } else {
        cur += ch;
      }
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

/** Execute raw SQL statements (for SQL file import). */
export async function importSQLFile(dbId: string, sql: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await openDb(dbId);
    await db.execAsync(sql);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Task 2.14/2.16: Schema + Foreign Keys ──────────────────────────────────

export interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;   // referenced table
  from: string;    // column in this table
  to: string;      // column in referenced table
  on_update: string;
  on_delete: string;
}

/** Get foreign keys declared on a table. */
export async function getForeignKeys(dbId: string, tableName: string): Promise<ForeignKeyInfo[]> {
  try {
    const db = await openDb(dbId);
    return db.getAllAsync<ForeignKeyInfo>(`PRAGMA foreign_key_list("${escapeIdentifier(tableName)}")`);
  } catch {
    return [];
  }
}

/** Get the full schema (tables, columns, FKs) for building an ER diagram. */
export interface ERTable {
  name: string;
  sql: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export async function getERSchema(dbId: string): Promise<ERTable[]> {
  const db = await openDb(dbId);
  const tables = await db.getAllAsync<{ name: string; sql: string }>(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
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

// ─── Task 2.18: Transaction helpers ──────────────────────────────────────────

export async function beginTransaction(dbId: string): Promise<QueryResult> {
  return executeQuery(dbId, 'BEGIN');
}

export async function commitTransaction(dbId: string): Promise<QueryResult> {
  return executeQuery(dbId, 'COMMIT');
}

export async function rollbackTransaction(dbId: string): Promise<QueryResult> {
  return executeQuery(dbId, 'ROLLBACK');
}

// ─── Task 2.19: EXPLAIN QUERY PLAN ──────────────────────────────────────────

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

// ─── Task 2.20: Detect destructive SQL ──────────────────────────────────────

const DESTRUCTIVE_KEYWORDS = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER'];

/**
 * Returns true when the SQL contains a destructive statement that warrants
 * an automatic backup before execution.
 */
export function isDestructiveSQL(sql: string): boolean {
  const upper = sql.toUpperCase();
  return DESTRUCTIVE_KEYWORDS.some(kw => {
    const re = new RegExp(`\\b${kw}\\b`);
    return re.test(upper);
  });
}

export async function exportDatabaseToSQL(dbId: string): Promise<string> {
  const db = await openDb(dbId);
  const tables = await db.getAllAsync<{ name: string; type: string; sql: string }>(
    `SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view','index','trigger') AND name NOT LIKE 'sqlite_%'`
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

        // Fetch rows in chunks — prevents holding the entire table in memory
        while (true) {
          const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT * FROM "${escaped}" LIMIT ${EXPORT_CHUNK_SIZE} OFFSET ${offset}`
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
      } catch { /* skip corrupt / unreadable tables */ }
    }
  }

  parts.push('COMMIT;\nPRAGMA foreign_keys=ON;\n');
  return parts.join('');
}
