import * as SQLite from 'expo-sqlite';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  insertId?: number;
  executionTime: number;
  error?: string;
  type: 'select' | 'dml' | 'ddl' | 'error';
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
    dbCache[dbId] = await SQLite.openDatabaseAsync(`sqlstudio_${dbId}.db`);
  }
  return dbCache[dbId];
}

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

export async function executeQuery(dbId: string, sql: string): Promise<QueryResult> {
  const start = Date.now();
  try {
    const db = await openDb(dbId);

    if (isSelectStatement(sql)) {
      const rows = await db.getAllAsync<Record<string, unknown>>(sql);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      // If no rows, try to get column names via a prepared statement approach
      return {
        columns,
        rows,
        rowsAffected: 0,
        executionTime: Date.now() - start,
        type: 'select',
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
