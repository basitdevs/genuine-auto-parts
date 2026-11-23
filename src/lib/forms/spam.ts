import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Layered spam protection for public lead forms:
 *  1. Honeypot: a hidden "website" field humans never fill.
 *  2. Time trap: submissions faster than MIN_FILL_MS after the form mounted are bots.
 *  3. Rate limit: 5 submissions per 10 minutes per form per visitor (configurable per form), stored in Postgres
 *     under a salted SHA-256 hash of the IP (raw IPs are never stored).
 * Bots tripping 1 or 2 get a fake success so they don't adapt.
 */
const MIN_FILL_MS = 2500;

export type SpamVerdict = "ok" | "bot" | "rate-limited";

async function visitorKey(form: string): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  if (!ip) return null;
  const salt = process.env.FORM_RATE_LIMIT_SALT ?? "genuine-auto-parts";
  return createHash("sha256").update(`${salt}:${form}:${ip}`).digest("hex");
}

export async function checkSpam(
  form: string,
  fields: { website?: string; startedAt?: string },
  limit: { max?: number; windowSeconds?: number } = {},
): Promise<SpamVerdict> {
  if (fields.website) return "bot";
  const started = Number(fields.startedAt);
  if (!Number.isFinite(started) || started <= 0 || Date.now() - started < MIN_FILL_MS) return "bot";

  const key = await visitorKey(form);
  const db = createPublicClient();
  if (!key || !db) return "ok";
  const { data, error } = await db.rpc("check_form_rate_limit", { p_key: key, p_max: limit.max ?? 5, p_window_seconds: limit.windowSeconds ?? 600 });
  if (error) {
    // Fail open: a missing migration or DB blip must not block real customers.
    console.error(`[forms] rate limit check failed: ${error.message}`);
    return "ok";
  }
  return data === false ? "rate-limited" : "ok";
}
