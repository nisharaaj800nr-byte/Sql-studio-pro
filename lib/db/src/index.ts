import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export * from "./schema";

const { Pool } = pg;

/**
 * Lazy DB initialisation — the pool is only created when first accessed.
 * This allows the API server to start and serve non-DB routes (health check,
 * AI endpoint) even when DATABASE_URL is not yet configured.
 */
let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set before accessing the database. " +
        "Did you forget to provision a Replit PostgreSQL database?"
    );
  }

  _pool = new Pool({ connectionString: url });
  _db = drizzle(_pool, { schema });
  return _db;
}

/**
 * Gracefully close the DB pool (use in shutdown hooks).
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

/**
 * Backwards-compat: eagerly-resolved db export for code that imports `db`
 * directly. Use `getDb()` in new code so DATABASE_URL errors are deferred.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    if (!_pool) getDb(); // trigger init & error if not configured
    return (_pool as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});
