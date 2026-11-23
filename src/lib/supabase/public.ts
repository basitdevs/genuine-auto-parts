import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "./database.types";

const RETRIES = 2;
const TIMEOUT_MS = 8_000;
/** Read-only RPCs that are safe to repeat. Writes (inserts, rate-limit counters) are never retried. */
const READ_RPCS = ["search_products", "search_facets", "fitment_years", "fitment_makes", "fitment_models"];

function isRetryable(input: Parameters<typeof fetch>[0], init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD") return true;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return READ_RPCS.some((name) => url.includes(`/rest/v1/rpc/${name}`));
}

/**
 * fetch with a per-attempt timeout and retries on network-level failures only
 * ("fetch failed", resets, timeouts), and only for reads. HTTP error responses are
 * returned as-is, so real query errors still surface immediately.
 */
const resilientFetch: typeof fetch = async (input, init) => {
  const retries = isRetryable(input, init) ? RETRIES : 0;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (init?.signal?.aborted) throw init.signal.reason;
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      return await fetch(input, { ...init, signal });
    } catch (error) {
      lastError = error;
      if (init?.signal?.aborted || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw lastError;
};

/**
 * Cookie-less, anonymous client for public catalog reads.
 * Safe to call inside `"use cache"` functions (no request-time APIs), and RLS
 * still restricts it to active/sold products. Transient network failures are retried.
 */
export function createPublicClient() {
  if (!isSupabaseConfigured) return null;
  return createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: resilientFetch },
  });
}
