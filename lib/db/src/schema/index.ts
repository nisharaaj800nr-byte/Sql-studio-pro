import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ─── Remote Connections ────────────────────────────────────────────────────────
// Stores metadata for remote DB connections (PostgreSQL, MySQL, etc.)
export const remoteConnections = pgTable("remote_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'postgresql' | 'mysql' | 'sqlite'
  host: text("host"),
  port: integer("port"),
  database: text("database"),
  username: text("username"),
  // NOTE: Do NOT store plaintext passwords here. Use a secret manager or
  // environment variables. This field is intentionally omitted.
  ssl: boolean("ssl").default(false),
  color: text("color").default("#58A6FF"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

export const insertRemoteConnectionSchema = createInsertSchema(remoteConnections);
export const selectRemoteConnectionSchema = createSelectSchema(remoteConnections);
export type RemoteConnection = typeof remoteConnections.$inferSelect;
export type NewRemoteConnection = typeof remoteConnections.$inferInsert;

// ─── Saved Queries ─────────────────────────────────────────────────────────────
// Cloud-synced saved queries (augments AsyncStorage-based local saved queries)
export const savedQueries = pgTable("saved_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sql: text("sql").notNull(),
  description: text("description"),
  connectionId: uuid("connection_id").references(() => remoteConnections.id, {
    onDelete: "set null",
  }),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSavedQuerySchema = createInsertSchema(savedQueries);
export const selectSavedQuerySchema = createSelectSchema(savedQueries);
export type SavedQuery = typeof savedQueries.$inferSelect;
export type NewSavedQuery = typeof savedQueries.$inferInsert;

// ─── Query History ─────────────────────────────────────────────────────────────
// Server-side query audit log (complements local AsyncStorage history)
export const queryHistory = pgTable("query_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  sql: text("sql").notNull(),
  connectionId: uuid("connection_id").references(() => remoteConnections.id, {
    onDelete: "cascade",
  }),
  success: boolean("success").notNull().default(true),
  rowCount: integer("row_count").default(0),
  executionTimeMs: integer("execution_time_ms").default(0),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export const insertQueryHistorySchema = createInsertSchema(queryHistory);
export const selectQueryHistorySchema = createSelectSchema(queryHistory);
export type QueryHistoryEntry = typeof queryHistory.$inferSelect;
export type NewQueryHistoryEntry = typeof queryHistory.$inferInsert;
