'use strict';

/**
 * Jest mock for expo-sqlite backed by sql.js (already a project dependency).
 * Mirrors the expo-sqlite New API used by sqliteManager.ts:
 *   - openDatabaseAsync(name)  → { getAllAsync, runAsync, closeAsync }
 *
 * Each test file should call `require('expo-sqlite')._reset()` in beforeEach
 * to start with a fresh in-memory database.
 */

const SQL_JS_MODULE = 'sql.js';

// sql.js initialisation is async; cache the promise so we only load WASM once.
let sqlJsPromise = null;

async function getSqlJs() {
  if (!sqlJsPromise) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const initSqlJs = require(SQL_JS_MODULE);
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

// In-memory database map: name → sql.js Database instance
const dbMap = {};

// PRAGMAs that sql.js does not support but real SQLite does —
// return a safe empty result instead of crashing with "out of memory".
const UNSUPPORTED_PRAGMA_RE = /^\s*PRAGMA\s+compile_options\s*$/i;

function makeDriverFor(db) {
  return {
    execAsync: async (sql) => {
      db.run(sql);
    },

    getAllAsync: async (sql, params) => {
      // Guard: sql.js cannot execute PRAGMA compile_options — return [] gracefully.
      if (UNSUPPORTED_PRAGMA_RE.test(sql)) return [];
      try {
        const stmt = db.prepare(sql);
        if (params && params.length > 0) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      } catch (err) {
        throw err;
      }
    },

    runAsync: async (sql, params) => {
      try {
        db.run(sql, params || []);
        const changes = db.getRowsModified();
        // last_insert_rowid() is a special SQLite function
        const idResult = db.exec('SELECT last_insert_rowid() AS id');
        const lastInsertRowId =
          idResult.length > 0 && idResult[0].values.length > 0
            ? idResult[0].values[0][0]
            : 0;
        return { changes, lastInsertRowId };
      } catch (err) {
        throw err;
      }
    },

    closeAsync: async () => {
      // Remove from map so the next open() creates a fresh instance
      const key = Object.keys(dbMap).find(k => dbMap[k] === db);
      if (key) {
        db.close();
        delete dbMap[key];
      }
    },
  };
}

module.exports = {
  openDatabaseAsync: async (name) => {
    if (!dbMap[name]) {
      const SQL = await getSqlJs();
      dbMap[name] = new SQL.Database();
    }
    return makeDriverFor(dbMap[name]);
  },

  /**
   * Drop all in-memory databases — call in beforeEach to isolate tests.
   */
  _reset: () => {
    Object.values(dbMap).forEach(d => { try { d.close(); } catch { /* ignore */ } });
    Object.keys(dbMap).forEach(k => delete dbMap[k]);
  },
};
