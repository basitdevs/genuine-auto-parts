/**
 * eBay CSV importer.
 *
 *   npm run import:ebay -- data/imports/<file>.csv                 # dry run: validate + parse, print report
 *   npm run import:ebay -- data/imports/<file>.csv --commit        # write to Supabase (service role)
 *   npm run import:ebay -- <file> --commit --mark-missing-sold     # eBay items missing from the file -> sold
 *   npm run import:ebay -- <file> --limit 50 --verbose             # first 50 rows, print each parse
 *
 * Upserts products by SKU, rebuilds product_fitments from the parsed title, creates
 * categories from eBay leaf categories, and logs every row to import_jobs / import_rows.
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import Papa from "papaparse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_GROUPS, FALLBACK_CATEGORY_GROUP } from "../src/lib/import/category-groups";
import {
  activeListingRowSchema,
  detectEbayFormat,
  mapActiveListingRow,
  slugify,
  type ProductImport,
} from "../src/lib/import/ebay-mapping";
import { VEHICLE_REFERENCE } from "../src/lib/import/vehicle-reference";

config({ path: [".env.local", ".env"], quiet: true });

type Args = { file: string; commit: boolean; markMissingSold: boolean; limit: number | null; verbose: boolean };

function parseArgs(argv: string[]): Args {
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: npm run import:ebay -- <file.csv> [--commit] [--mark-missing-sold] [--limit N] [--verbose]");
    process.exit(1);
  }
  const limitIndex = argv.indexOf("--limit");
  return {
    file: resolve(file),
    commit: argv.includes("--commit"),
    markMissingSold: argv.includes("--mark-missing-sold"),
    limit: limitIndex >= 0 ? Number(argv[limitIndex + 1]) : null,
    verbose: argv.includes("--verbose"),
  };
}

type RowResult =
  | { rowNumber: number; raw: Record<string, string>; ok: true; product: ProductImport }
  | { rowNumber: number; raw: Record<string, string>; ok: false; error: string };

function readRows(args: Args): { format: string; results: RowResult[] } {
  const text = readFileSync(args.file, "utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const format = detectEbayFormat(headers);
  if (format !== "ebay_active_listings") {
    console.error(
      format === "ebay_file_exchange"
        ? "File Exchange format detected. Send a sample export so its columns can be verified before mapping."
        : `Unrecognised CSV format. Headers: ${headers.join(", ")}`,
    );
    process.exit(1);
  }
  const rows = args.limit ? parsed.data.slice(0, args.limit) : parsed.data;
  const results = rows.map((raw, i): RowResult => {
    const rowNumber = i + 2; // header is line 1
    const check = activeListingRowSchema.safeParse(raw);
    if (!check.success) {
      const error = check.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      return { rowNumber, raw, ok: false, error };
    }
    return { rowNumber, raw, ok: true, product: mapActiveListingRow(check.data) };
  });
  return { format, results };
}

function report(results: RowResult[]) {
  const ok = results.filter((r): r is Extract<RowResult, { ok: true }> => r.ok);
  const pct = (n: number) => `${((n / Math.max(ok.length, 1)) * 100).toFixed(1)}%`;
  const withYears = ok.filter((r) => r.product.fitment.years.length > 0).length;
  const withMake = ok.filter((r) => r.product.fitment.makeSlug).length;
  const withModel = ok.filter((r) => r.product.fitment.modelSlug).length;
  const withPn = ok.filter((r) => r.product.oemPartNumber).length;
  const groups = new Map<string, number>();
  for (const r of ok) groups.set(r.product.category.groupSlug, (groups.get(r.product.category.groupSlug) ?? 0) + 1);
  const unknownModels = new Map<string, number>();
  for (const r of ok) {
    if (r.product.fitment.makeSlug && !r.product.fitment.modelSlug) {
      const key = `${r.product.fitment.makeSlug}: ${r.product.title.split(" ").slice(0, 6).join(" ")}`;
      unknownModels.set(key, (unknownModels.get(key) ?? 0) + 1);
    }
  }

  console.log(`\nRows: ${results.length}   valid: ${ok.length}   invalid: ${results.length - ok.length}`);
  console.log(`Years parsed:        ${withYears} (${pct(withYears)})`);
  console.log(`Make recognised:     ${withMake} (${pct(withMake)})`);
  console.log(`Model recognised:    ${withModel} (${pct(withModel)})`);
  console.log(`OEM part # found:    ${withPn} (${pct(withPn)})`);
  console.log(`Fitment rows:        ${ok.reduce((n, r) => n + (r.product.fitment.makeSlug ? r.product.fitment.years.length : 0), 0)}`);
  console.log("\nCategory groups:");
  for (const [slug, count] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`  ${slug.padEnd(26)} ${count}`);
  const invalid = results.filter((r) => !r.ok).slice(0, 10);
  if (invalid.length) {
    console.log("\nFirst invalid rows:");
    for (const r of invalid) if (!r.ok) console.log(`  line ${r.rowNumber}: ${r.error}`);
  }
  const noMake = ok.filter((r) => !r.product.fitment.makeSlug).slice(0, 15);
  if (noMake.length) {
    console.log("\nSample titles without a recognised make:");
    for (const r of noMake) console.log(`  ${r.product.title}`);
  }
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------
function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local)");
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: resilientFetch } });
}

/**
 * fetch with a per-request timeout and retries. supabase-js has no default timeout,
 * so a dropped connection would otherwise hang the import forever.
 */
async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const attempts = 4;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(input, { ...init, signal: AbortSignal.timeout(60_000) });
      if (res.status >= 500 && attempt < attempts) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (error) {
      if (attempt >= attempts) throw error;
      const wait = 1000 * 2 ** (attempt - 1);
      console.warn(`\n  request failed (${error instanceof Error ? error.message : String(error)}), retry ${attempt}/${attempts - 1} in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/** For selects: throws on error, treats null as an empty list. */
async function rows<T>(promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  return (await must(promise, label)) ?? [];
}

async function syncReferenceData(db: SupabaseClient) {
  await must(
    db.from("makes").upsert(
      VEHICLE_REFERENCE.map((make, i) => ({
        name: make.name, slug: make.slug, aliases: make.aliases, is_featured: Boolean(make.featured), sort_order: i,
      })),
      { onConflict: "slug" },
    ),
    "upsert makes",
  );
  const makes = await rows<{ id: number; slug: string }>(db.from("makes").select("id, slug"), "load makes");
  const makeId = new Map(makes.map((m: { id: number; slug: string }) => [m.slug, m.id]));
  await must(
    db.from("models").upsert(
      VEHICLE_REFERENCE.flatMap((make) =>
        make.models.map((model) => ({ make_id: makeId.get(make.slug), name: model.name, slug: model.slug, aliases: model.aliases })),
      ),
      { onConflict: "make_id,slug" },
    ),
    "upsert models",
  );
  const models = await rows<{ id: number; slug: string; make_id: number }>(db.from("models").select("id, slug, make_id"), "load models");
  const modelId = new Map(models.map((m: { id: number; slug: string; make_id: number }) => [`${m.make_id}:${m.slug}`, m.id]));

  await must(
    db.from("categories").upsert(
      [...CATEGORY_GROUPS, FALLBACK_CATEGORY_GROUP].map((g, i) => ({
        name: g.name, slug: g.slug, icon: g.icon, description: g.description, sort_order: i,
      })),
      { onConflict: "slug" },
    ),
    "upsert category groups",
  );
  return { makeId, modelId };
}

async function syncLeafCategories(db: SupabaseClient, products: ProductImport[]) {
  const parents = await rows<{ id: number; slug: string }>(db.from("categories").select("id, slug").is("parent_id", null), "load parents");
  const parentId = new Map(parents.map((p: { id: number; slug: string }) => [p.slug, p.id]));
  const leaves = new Map<number, { name: string; group: string }>();
  for (const p of products) leaves.set(p.category.ebayCategoryId, { name: p.category.name, group: p.category.groupSlug });
  await must(
    db.from("categories").upsert(
      [...leaves].map(([ebayId, leaf]) => ({
        name: leaf.name,
        slug: `${slugify(leaf.name, 60)}-${ebayId}`,
        ebay_category_id: ebayId,
        parent_id: parentId.get(leaf.group) ?? null,
      })),
      { onConflict: "ebay_category_id" },
    ),
    "upsert leaf categories",
  );
  const leafRows = await rows<{ id: number; ebay_category_id: number }>(db.from("categories").select("id, ebay_category_id").not("ebay_category_id", "is", null), "load leaves");
  return new Map(leafRows.map((r: { id: number; ebay_category_id: number }) => [r.ebay_category_id, r.id]));
}

/** Recomputes category counts / facets / stats (migration 0500). Non-fatal: the site falls back to live queries. */
async function refreshCatalogSummary(db: ReturnType<typeof adminClient>) {
  const started = Date.now();
  const { error } = await db.rpc("refresh_catalog_summary");
  console.log(error ? `Catalog summary refresh failed: ${error.message}` : `Catalog summary refreshed (${Date.now() - started} ms)`);
}

/** Tells the running site to refresh catalog caches (skipped unless REVALIDATE_SECRET is set). */
async function revalidateSite() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) return;
  try {
    const res = await fetch(`${site}/api/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    console.log(res.ok ? `Revalidated catalog cache on ${site}` : `Revalidate request failed (${res.status})`);
  } catch {
    console.log(`Could not reach ${site} to revalidate; pages refresh within the hour anyway.`);
  }
}

async function commit(args: Args, format: string, results: RowResult[]) {
  const db = adminClient();
  const job = await must(
    db.from("import_jobs")
      .insert({ source: format, filename: basename(args.file), status: "running", total_rows: results.length, started_at: new Date().toISOString(), options: { markMissingSold: args.markMissingSold } })
      .select("id")
      .single(),
    "create import job",
  );
  const jobId = (job as { id: string }).id;
  const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };

  try {
    const { makeId, modelId } = await syncReferenceData(db);
    const valid = results.filter((r): r is Extract<RowResult, { ok: true }> => r.ok);
    const categoryId = await syncLeafCategories(db, valid.map((r) => r.product));

    const existing = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const page = await rows<{ sku: string }>(db.from("products").select("sku").range(from, from + 999), "load existing skus");
      for (const p of page) existing.add(p.sku);
      if (page.length < 1000) break;
    }

    const BATCH = 250;
    for (let i = 0; i < results.length; i += BATCH) {
      const batch = results.slice(i, i + BATCH);
      const good = batch.filter((r): r is Extract<RowResult, { ok: true }> => r.ok);

      const upserted = good.length
        ? await rows<{ id: string; sku: string }>(
            db.from("products").upsert(
              good.map(({ product: p }) => ({
                sku: p.sku, slug: p.slug, title: p.title, condition: p.condition, status: p.status,
                price: p.price, currency: p.currency, quantity: p.quantity,
                oem_part_number: p.oemPartNumber, interchange_numbers: p.interchangeNumbers,
                placement: p.placement, category_id: categoryId.get(p.category.ebayCategoryId) ?? null,
                external_ids: p.externalIds, source: "ebay", listed_at: p.listedAt,
              })),
              { onConflict: "sku" },
            ).select("id, sku"),
            "upsert products",
          )
        : [];
      const idBySku = new Map(upserted.map((p) => [p.sku, p.id]));

      // Rebuild fitment for this batch.
      const ids = [...idBySku.values()];
      if (ids.length) await must(db.from("product_fitments").delete().in("product_id", ids), "clear fitments");
      const fitments = good.flatMap(({ product: p }) => {
        const make = p.fitment.makeSlug ? makeId.get(p.fitment.makeSlug) : undefined;
        const productId = idBySku.get(p.sku);
        if (!make || !productId) return [];
        const model = p.fitment.modelSlug ? (modelId.get(`${make}:${p.fitment.modelSlug}`) ?? null) : null;
        return p.fitment.years.map((year) => ({
          product_id: productId, year, make_id: make, model_id: model, trim: p.fitment.trim, engine: p.fitment.engine,
        }));
      });
      for (let f = 0; f < fitments.length; f += 1000) {
        await must(
          db.from("product_fitments").upsert(fitments.slice(f, f + 1000), {
            onConflict: "product_id,year,make_id,model_id,trim,engine",
            ignoreDuplicates: true,
          }),
          "insert fitments",
        );
      }

      await must(
        db.from("import_rows").upsert(
          batch.map((r) => {
            if (!r.ok) {
              counts.failed++;
              return { job_id: jobId, row_number: r.rowNumber, raw: r.raw, status: "failed", error_message: r.error };
            }
            const wasExisting = existing.has(r.product.sku);
            if (wasExisting) counts.updated++;
            else counts.created++;
            return {
              job_id: jobId, row_number: r.rowNumber, raw: r.raw, status: wasExisting ? "updated" : "created",
              product_id: idBySku.get(r.product.sku) ?? null, warnings: r.product.fitment.warnings,
            };
          }),
          { onConflict: "job_id,row_number" },
        ),
        "log import rows",
      );
      process.stdout.write(`\r  ${Math.min(i + BATCH, results.length)} / ${results.length}`);
    }

    if (args.markMissingSold) {
      const seen = new Set(valid.map((r) => r.product.sku));
      const stale = [...existing].filter((sku) => !seen.has(sku));
      for (let i = 0; i < stale.length; i += 500) {
        await must(
          db.from("products").update({ status: "sold", quantity: 0 }).eq("source", "ebay").in("sku", stale.slice(i, i + 500)),
          "mark missing sold",
        );
      }
      console.log(`\n  Marked ${stale.length} products missing from this file as sold`);
    }

    await must(
      db.from("import_jobs").update({
        status: counts.failed ? "completed_with_errors" : "completed",
        created_count: counts.created, updated_count: counts.updated, skipped_count: counts.skipped,
        failed_count: counts.failed, finished_at: new Date().toISOString(),
      }).eq("id", jobId),
      "finish job",
    );
    console.log(`\nImport ${jobId} done:`, counts);
    await refreshCatalogSummary(db);
    await revalidateSite();
  } catch (error) {
    await db.from("import_jobs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", jobId);
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { format, results } = readRows(args);
  console.log(`File: ${basename(args.file)}  format: ${format}`);
  report(results);

  if (args.verbose) {
    for (const r of results) {
      if (!r.ok) continue;
      const f = r.product.fitment;
      console.log(
        `\n${r.product.title}\n  years=${f.years.join(",")} make=${f.makeSlug} model=${f.modelSlug} trim=${f.trim} ` +
          `engine=${f.engine} placement=${f.placement} oem=${r.product.oemPartNumber} interchange=${r.product.interchangeNumbers.join(",")} ` +
          `group=${r.product.category.groupSlug}`,
      );
    }
  }

  mkdirSync("data/reports", { recursive: true });
  const reportPath = `data/reports/${basename(args.file, ".csv")}.parsed.json`;
  writeFileSync(reportPath, JSON.stringify(results.map((r) => (r.ok ? r.product : r)), null, 2));
  console.log(`\nFull parse written to ${reportPath}`);

  if (!args.commit) {
    console.log("Dry run only. Re-run with --commit to write to Supabase.");
    return;
  }
  await commit(args, format, results);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
