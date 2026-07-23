import { Router } from "express";
import { rateLimit } from "../middlewares/auth";

const router = Router();
router.use(rateLimit);

/**
 * GET /api/queries
 * List saved queries.
 */
router.get("/", (_req, res) => {
  res.json({ queries: [] });
});

/**
 * POST /api/queries
 * Save a new query.
 */
router.post("/", (req, res) => {
  const { name, sql, description, tags } = req.body as {
    name?: string;
    sql?: string;
    description?: string;
    tags?: string[];
  };

  if (!name || !sql) {
    res.status(400).json({ error: "name and sql are required." });
    return;
  }

  res.status(201).json({
    id: `sq_${Date.now()}`,
    name,
    sql,
    description: description ?? null,
    tags: tags ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

/**
 * DELETE /api/queries/:id
 * Delete a saved query.
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Missing query id." });
    return;
  }
  res.status(200).json({ deleted: id });
});

export default router;
