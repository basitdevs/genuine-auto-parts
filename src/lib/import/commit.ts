import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_GROUPS, FALLBACK_CATEGORY_GROUP } from "./category-groups";
import { activeListingRowSchema, mapActiveListingRow, slugify, type ProductImport } from "./ebay-mapping";
import { VEHICLE_REFERENCE } from "./vehicle-reference";

/**
 * Browser-driven import, server side. Same mapping as scripts/import-ebay.ts:
 * products upsert by SKU, fitment rebuilt from the parsed title, leaf categories created
 * from eBay categories, every row logged to import_rows. Runs with the service role
 * (imports are admin-only; authorization happens in the calling Server Action).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- service client typed loosely for bulk upserts
type Db = SupabaseClient<any>;

export type RawRow = { rowNumber: number; raw: Record<string, string> };

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/** Makes, models and category groups from the reference data (idempotent). */
export async function syncReferenceData(db: Db) {
  await must(db.from("makes").upsert(VEHICLE_REFERENCE.map((m, i) => ({ name: m.name, slug: m.slug, aliases: m.aliases, is_featured: Boolean(m.featured), sort_order: i })), { onConflict: "slug" }), "upsert makes");
  const makes = (await must(db.from("makes").select("id, slug"), "load makes")) as { id: number; slug: string }[];
  const makeId = new Map(makes.map((m) => [m.slug, m.id]));
  await must(
    db.from("models").upsert(VEHICLE_REFERENCE.flatMap((make) => make.models.map((model) => ({ make_id: makeId.get(make.slug), name: model.name, slug: model.slug, aliases: model.aliases }))), { onConflict: "make_id,slug" }),
    "upsert models",
  );
  await must(
    db.from("categories").upsert([...CATEGORY_GROUPS, FALLBACK_CATEGORY_GROUP].map((g, i) => ({ name: g.name, slug: g.slug, icon: g.icon, description: g.description, sort_order: i })), { onConflict: "slug" }),
    "upsert category groups",
  );
}

async function loadMaps(db: Db) {
  const [makes, models] = await Promise.all([
    must(db.from("makes").select("id, slug"), "load makes") as Promise<{ id: number; slug: string }[]>,
    must(db.from("models").select("id, slug, make_id"), "load models") as Promise<{ id: number; slug: string; make_id: number }[]>,
  ]);
  return { makeId: new Map(makes.map((m) => [m.slug, m.id])), modelId: new Map(models.map((m) => [`${m.make_id}:${m.slug}`, m.id])) };
}

async function syncLeafCategories(db: Db, products: ProductImport[]) {
  const parents = (await must(db.from("categories").select("id, slug").is("parent_id", null), "load parents")) as { id: number; slug: string }[];
  const parentId = new Map(parents.map((p) => [p.slug, p.id]));
  const leaves = new Map<number, { name: string; group: string }>();
  for (const p of products) leaves.set(p.category.ebayCategoryId, { name: p.category.name, group: p.category.groupSlug });
  if (leaves.size) {
    await must(
      db.from("categories").upsert([...leaves].map(([ebayId, leaf]) => ({ name: leaf.name, slug: `${slugify(leaf.name, 60)}-${ebayId}`, ebay_category_id: ebayId, parent_id: parentId.get(leaf.group) ?? null })), { onConflict: "ebay_category_id" }),
      "upsert leaf categories",
    );
  }
  const rows = (await must(db.from("categories").select("id, ebay_category_id").in("ebay_category_id", [...leaves.keys()]), "load leaves")) as { id: number; ebay_category_id: number }[];
  return new Map(rows.map((r) => [r.ebay_category_id, r.id]));
}

export type BatchResult = { created: number; updated: number; failed: number; skus: string[] };

/** Validates + maps + writes one batch (≤ 250 rows). Safe to retry: everything is an upsert. */
export async function commitBatch(db: Db, jobId: string, batch: RawRow[]): Promise<BatchResult> {
  const results = batch.map((r) => {
    const check = activeListingRowSchema.safeParse(r.raw);
    return check.success
      ? { ...r, ok: true as const, product: mapActiveListingRow(check.data) }
      : { ...r, ok: false as const, error: check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  });
  const good = results.filter((r): r is Extract<(typeof results)[number], { ok: true }> => r.ok);
  const { makeId, modelId } = await loadMaps(db);
  const categoryId = await syncLeafCategories(db, good.map((r) => r.product));

  const skus = good.map((r) => r.product.sku);
  const existing = new Set(skus.length ? ((await must(db.from("products").select("sku").in("sku", skus), "load existing")) as { sku: string }[]).map((p) => p.sku) : []);

  const upserted = good.length
    ? ((await must(
        db.from("products").upsert(
          good.map(({ product: p }) => ({
            sku: p.sku, slug: p.slug, title: p.title, condition: p.condition, status: p.status, price: p.price, currency: p.currency, quantity: p.quantity,
            oem_part_number: p.oemPartNumber, interchange_numbers: p.interchangeNumbers, placement: p.placement,
            category_id: categoryId.get(p.category.ebayCategoryId) ?? null, external_ids: p.externalIds, source: "ebay", listed_at: p.listedAt,
          })),
          { onConflict: "sku" },
        ).select("id, sku"),
        "upsert products",
      )) as { id: string; sku: string }[])
    : [];
  const idBySku = new Map(upserted.map((p) => [p.sku, p.id]));

  const ids = [...idBySku.values()];
  if (ids.length) await must(db.from("product_fitments").delete().in("product_id", ids), "clear fitments");
  const fitments = good.flatMap(({ product: p }) => {
    const make = p.fitment.makeSlug ? makeId.get(p.fitment.makeSlug) : undefined;
    const productId = idBySku.get(p.sku);
    if (!make || !productId) return [];
    const model = p.fitment.modelSlug ? (modelId.get(`${make}:${p.fitment.modelSlug}`) ?? null) : null;
    return p.fitment.years.map((year) => ({ product_id: productId, year, make_id: make, model_id: model, trim: p.fitment.trim, engine: p.fitment.engine }));
  });
  for (let i = 0; i < fitments.length; i += 1000) {
    await must(db.from("product_fitments").upsert(fitments.slice(i, i + 1000), { onConflict: "product_id,year,make_id,model_id,trim,engine", ignoreDuplicates: true }), "insert fitments");
  }

  // Marketplace photo URLs (File Exchange "PicURL"): recorded as external images for the image job.
  const images = good.flatMap(({ product: p }) => {
    const productId = idBySku.get(p.sku);
    return productId && !existing.has(p.sku) ? p.imageUrls.map((url, position) => ({ product_id: productId, external_url: url, position })) : [];
  });
  if (images.length) await must(db.from("product_images").insert(images), "insert image urls");

  let created = 0;
  let updated = 0;
  let failed = 0;
  await must(
    db.from("import_rows").upsert(
      results.map((r) => {
        if (!r.ok) {
          failed++;
          return { job_id: jobId, row_number: r.rowNumber, raw: r.raw, status: "failed", error_message: r.error };
        }
        const was = existing.has(r.product.sku);
        if (was) updated++;
        else created++;
        return { job_id: jobId, row_number: r.rowNumber, raw: r.raw, status: was ? "updated" : "created", product_id: idBySku.get(r.product.sku) ?? null, warnings: r.product.fitment.warnings };
      }),
      { onConflict: "job_id,row_number" },
    ),
    "log import rows",
  );
  return { created, updated, failed, skus };
}
