/**
 * Times the catalog aggregate reads over PostgREST (anon key, like the site).
 * "server ≈" = fastest run minus the fastest round trip of a trivial indexed query
 * (min-of-N filters network jitter), which isolates database time from this
 * machine's network latency. Medians are shown for context.
 *
 *   npm run db:bench
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / publishable key missing");
const db = createClient<Database>(url, key, { auth: { persistSession: false } });

const RUNS = 12;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function time(label: string, run: () => PromiseLike<{ error: { message: string } | null }>) {
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    const { error } = await run();
    if (error) return { label, min: NaN, med: NaN, error: error.message };
    samples.push(performance.now() - t);
  }
  return { label, min: Math.min(...samples), med: median(samples), error: null };
}

async function main() {
  await db.from("products").select("id").limit(1); // warm the connection
  const baseline = await time("baseline (select id limit 1)", () => db.from("products").select("id").limit(1));
  const results = [
    await time("live: category counts", () =>
      db.from("categories").select("id, parent_id, products(count)").eq("products.status", "active"),
    ),
    await time("live: search_facets() unfiltered", () => db.rpc("search_facets", {})),
    await time("live: catalog_stats()", () => db.rpc("catalog_stats", {})),
    await time("summary: catalog_summary row", () =>
      db.from("catalog_summary").select("category_counts, facets, stats, refreshed_at").eq("id", 1).maybeSingle(),
    ),
  ];
  console.log(`round trip baseline: min ${baseline.min.toFixed(0)} ms, median ${baseline.med.toFixed(0)} ms (${RUNS} runs)\n`);
  for (const r of results) {
    if (r.error) console.log(`${r.label.padEnd(36)} error: ${r.error}`);
    else
      console.log(
        `${r.label.padEnd(36)} median ${r.med.toFixed(0).padStart(5)} ms   min ${r.min.toFixed(0).padStart(5)} ms   server ≈ ${Math.max(0, r.min - baseline.min).toFixed(0).padStart(5)} ms`,
      );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
