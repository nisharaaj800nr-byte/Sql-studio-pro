import { Router } from "express";
import { rateLimit } from "../middlewares/auth";

const router = Router();
router.use(rateLimit);

/**
 * POST /api/ai/sql
 * Convert a natural-language prompt to SQL.
 *
 * When OPENAI_API_KEY is set, uses GPT to generate SQL.
 * Otherwise returns a helpful error so the client can degrade gracefully.
 */
router.post("/sql", async (req, res) => {
  const { prompt, schema, dialect = "sqlite" } = req.body as {
    prompt?: string;
    schema?: string;
    dialect?: string;
  };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required." });
    return;
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    res.status(503).json({
      error: "AI features require OPENAI_API_KEY to be configured.",
      code: "NO_API_KEY",
    });
    return;
  }

  try {
    const systemPrompt = [
      `You are an expert SQL assistant. Convert natural language to ${dialect.toUpperCase()} SQL.`,
      "Return ONLY the SQL query — no explanation, no markdown, no backticks.",
      "Write clean, well-formatted SQL with proper indentation.",
      schema ? `\nDatabase schema:\n${schema}` : "",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.status(502).json({ error: `OpenAI error: ${response.status}`, detail: err });
      return;
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const sql = data.choices[0]?.message?.content?.trim() ?? "";
    res.json({ sql, dialect });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate SQL.", detail: String(e) });
  }
});

export default router;
