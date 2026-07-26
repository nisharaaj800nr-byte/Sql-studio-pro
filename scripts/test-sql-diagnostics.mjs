import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const output = `/tmp/sqlstudio-sql-diagnostics-${process.pid}.mjs`;
const source = resolve(process.cwd(), "artifacts/mobile/utils/sqlDiagnostics.ts");
execFileSync(
  "pnpm",
  [
    "--filter",
    "@workspace/api-server",
    "exec",
    "esbuild",
    source,
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${output}`,
  ],
  { stdio: "inherit" },
);

const diagnostics = await import(`${pathToFileURL(output).href}?test=${Date.now()}`);
const {
  classifySQL,
  getStaticSQLDiagnostics,
  splitSQLStatements,
  statementReturnsRows,
} = diagnostics;

assert.equal(classifySQL("  -- comment\n SELECT 1;"), "select");
assert.equal(classifySQL("WITH rows AS (SELECT 1) SELECT * FROM rows"), "select");
assert.equal(
  classifySQL("WITH rows AS (SELECT 'Ada' AS name) INSERT INTO users(name) SELECT name FROM rows RETURNING id"),
  "dml",
);
assert.equal(classifySQL("PRAGMA table_info(users)"), "pragma");
assert.equal(classifySQL("BEGIN IMMEDIATE"), "transaction");
assert.equal(statementReturnsRows("INSERT INTO users(name) VALUES ('Ada') RETURNING id"), true);
assert.equal(statementReturnsRows("PRAGMA foreign_keys = ON"), false);
assert.equal(splitSQLStatements("SELECT 'one;two'; SELECT 2;").length, 2);
assert.equal(
  splitSQLStatements(
    "CREATE TRIGGER audit AFTER INSERT ON users BEGIN INSERT INTO logs VALUES ('a;b'); UPDATE users SET touched = 1; END;",
  ).length,
  1,
);

const deleteDiagnostics = getStaticSQLDiagnostics("DELETE FROM users");
assert.ok(deleteDiagnostics.some(item => item.code === "NO_WHERE"));
assert.ok(deleteDiagnostics.some(item => item.code === "DESTRUCTIVE_SQL"));
assert.ok(getStaticSQLDiagnostics("SELECT (1").some(item => item.code === "UNBALANCED_PARENS"));
assert.ok(getStaticSQLDiagnostics("SELECT * FROM users").some(item => item.code === "SELECT_STAR"));
assert.ok(getStaticSQLDiagnostics("SELECT * FROM users WHERE name ILIKE '%a%'").some(item => item.code === "OTHER_DIALECT"));

unlinkSync(output);
console.log("SQLite SQL diagnostics tests passed");