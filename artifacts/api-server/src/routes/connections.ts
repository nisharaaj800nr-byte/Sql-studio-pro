import { Router } from "express";
import { rateLimit } from "../middlewares/auth";

const router = Router();

// Apply rate limiting to all connection routes
router.use(rateLimit);

/**
 * GET /api/connections
 * List all saved remote connections (metadata only — no passwords).
 */
router.get("/", (_req, res) => {
  // In a full implementation, fetch from @workspace/db.
  // Returning empty array until DATABASE_URL is configured.
  res.json({ connections: [] });
});

/**
 * POST /api/connections
 * Create a new remote connection entry.
 */
router.post("/", (req, res) => {
  const { name, type, host, port, database, username, ssl, color } = req.body as {
    name?: string;
    type?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    ssl?: boolean;
    color?: string;
  };

  if (!name || !type) {
    res.status(400).json({ error: "name and type are required." });
    return;
  }

  const allowed = ["postgresql", "mysql", "sqlite"];
  if (!allowed.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${allowed.join(", ")}` });
    return;
  }

  // Stub: persist to DB when DATABASE_URL is available
  res.status(201).json({
    id: `conn_${Date.now()}`,
    name,
    type,
    host: host ?? null,
    port: port ?? null,
    database: database ?? null,
    username: username ?? null,
    ssl: ssl ?? false,
    color: color ?? "#58A6FF",
    createdAt: new Date().toISOString(),
  });
});

/**
 * DELETE /api/connections/:id
 * Remove a connection by ID.
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Missing connection id." });
    return;
  }
  // Stub: delete from DB when DATABASE_URL is available
  res.status(200).json({ deleted: id });
});

export default router;
