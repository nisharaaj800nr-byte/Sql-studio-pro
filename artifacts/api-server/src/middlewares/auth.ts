import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";

const SESSION_SECRET = process.env["SESSION_SECRET"];

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set.");
}

/**
 * Simple HMAC-based API key auth middleware.
 * Clients send: Authorization: Bearer <token>
 * Token = HMAC-SHA256(payload, SESSION_SECRET) where payload is a stable string.
 *
 * For a production app you'd use a proper JWT/OAuth library. This is a
 * minimal, dependency-free implementation that is still cryptographically sound.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header." });
    return;
  }

  const token = header.slice(7);

  try {
    const expected = signToken(token.split(".")[0] ?? "");
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(token);

    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      res.status(401).json({ error: "Invalid token." });
      return;
    }
  } catch {
    res.status(401).json({ error: "Token verification failed." });
    return;
  }

  next();
}

/**
 * Generate an API token for a given payload string.
 * Usage: signToken("client-id") → "client-id.<hmac>"
 */
export function signToken(payload: string): string {
  const mac = createHmac("sha256", SESSION_SECRET!)
    .update(payload)
    .digest("hex");
  return `${payload}.${mac}`;
}

/**
 * Optional: rate limiting by IP using a simple in-memory sliding window.
 * Max 60 requests per minute per IP.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT) {
    res.status(429).json({ error: "Too many requests. Retry after 1 minute." });
    return;
  }

  entry.count++;
  next();
}
