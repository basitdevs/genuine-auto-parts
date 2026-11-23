/**
 * Fast existence checks used by Proxy to return real 404 statuses.
 *
 * With Cache Components the page shell streams first (status 200), so notFound()
 * inside a page can't change the status. Proxy runs before rendering, so it checks
 * the slug here.
 *
 * Fail-open contract: Proxy waits at most PROXY_LOOKUP_TIMEOUT_MS (default 800ms).
 * Errors and timeouts resolve to "unknown" and the request goes through, so a slow
 * or failing database never produces a 404. A timed-out lookup keeps running in
 * the background (up to 8s) and warms the cache for the next request.
 *
 * "Exists" means visible to the public API (RLS: active or sold). Sold parts
 * therefore return 200 and render their Sold state; drafts, archived and unknown
 * slugs 404.
 *
 * The memo (found: 10 min, missing: 2 min) lives on globalThis so Proxy and route
 * handlers in the same server process share it; /api/revalidate and admin edits
 * call clearExistsCache(). Other server instances converge within the TTLs.
 */
type Kind = "product" | "vehicle";
type Entry = { exists: boolean; expires: number };
type Store = { cache: Map<string, Entry>; inflight: Map<string, Promise<boolean | "unknown">> };

const TABLE: Record<Kind, string> = { product: "products", vehicle: "donor_vehicles" };
const FOUND_TTL = 10 * 60_000;
const MISSING_TTL = 2 * 60_000;
const MAX_ENTRIES = 20_000;
const BACKGROUND_TIMEOUT = 8_000;

const globalStore = globalThis as typeof globalThis & { __gatpExists?: Store };
const store: Store = (globalStore.__gatpExists ??= { cache: new Map(), inflight: new Map() });

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,200}$/;

function answerBudget(): number {
  const ms = Number(process.env.PROXY_LOOKUP_TIMEOUT_MS);
  return Number.isFinite(ms) && ms > 0 ? ms : 800;
}

/** Drops every memoized answer (call after imports, status changes and deletes). */
export function clearExistsCache(): void {
  store.cache.clear();
}

async function lookup(kind: Kind, slug: string, key: string): Promise<boolean | "unknown"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !apiKey) return "unknown";
  try {
    const res = await fetch(`${url}/rest/v1/${TABLE[kind]}?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
      headers: { apikey: apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(BACKGROUND_TIMEOUT),
    });
    if (!res.ok) return "unknown";
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return "unknown";
    const exists = rows.length > 0;
    if (store.cache.size >= MAX_ENTRIES) store.cache.delete(store.cache.keys().next().value as string);
    store.cache.set(key, { exists, expires: Date.now() + (exists ? FOUND_TTL : MISSING_TTL) });
    return exists;
  } catch {
    return "unknown";
  }
}

export async function recordExists(kind: Kind, slug: string): Promise<boolean | "unknown"> {
  if (!SLUG_RE.test(slug)) return false;
  const key = `${kind}:${slug}`;
  const hit = store.cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.exists;

  let pending = store.inflight.get(key);
  if (!pending) {
    pending = lookup(kind, slug, key).finally(() => store.inflight.delete(key));
    store.inflight.set(key, pending);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<"unknown">((resolve) => {
    timer = setTimeout(() => resolve("unknown"), answerBudget());
  });
  try {
    return await Promise.race([pending, budget]);
  } finally {
    clearTimeout(timer);
  }
}
