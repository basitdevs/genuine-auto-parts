import "server-only";
import type { StaffSession } from "@/lib/auth/staff";
import type { ProductStatus } from "@/lib/supabase/database.types";
import { partNumberKey, sanitizeSearch, str } from "./db";

type Db = StaffSession["db"];

export const PRODUCT_STATUSES: ProductStatus[] = ["active", "sold", "draft", "archived"];
export const CONDITIONS = ["used", "new", "remanufactured", "for_parts"] as const;
export const SORTS = {
  updated: { column: "updated_at", ascending: false, label: "Recently updated" },
  created: { column: "created_at", ascending: false, label: "Newest" },
  price_asc: { column: "price", ascending: true, label: "Price: low → high" },
  price_desc: { column: "price", ascending: false, label: "Price: high → low" },
  title: { column: "title", ascending: true, label: "Title A–Z" },
  quantity: { column: "quantity", ascending: false, label: "Stock: high → low" },
} as const;
export type SortKey = keyof typeof SORTS;

export type ProductFilters = {
  q?: string;
  status?: ProductStatus;
  category?: number;
  make?: number;
  model?: number;
  condition?: (typeof CONDITIONS)[number];
  photos?: "yes" | "none";
  stock?: "in" | "out";
  min?: number;
  max?: number;
  vehicle?: number;
  sort: SortKey;
};

const num = (v: unknown) => {
  const n = Number(str(v));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** URL params → validated filters (everything optional, unknown values ignored). */
export function parseProductFilters(params: Record<string, string | string[] | undefined>): ProductFilters {
  const get = (k: string) => (Array.isArray(params[k]) ? params[k]?.[0] : params[k]);
  const status = get("status") as ProductStatus;
  const condition = get("condition") as ProductFilters["condition"];
  const sort = get("sort") as SortKey;
  return {
    q: sanitizeSearch(get("q") ?? "") || undefined,
    status: PRODUCT_STATUSES.includes(status) ? status : undefined,
    category: num(get("category")),
    make: num(get("make")),
    model: num(get("model")),
    condition: CONDITIONS.includes(condition as (typeof CONDITIONS)[number]) ? condition : undefined,
    photos: get("photos") === "yes" || get("photos") === "none" ? (get("photos") as "yes" | "none") : undefined,
    stock: get("stock") === "in" || get("stock") === "out" ? (get("stock") as "in" | "out") : undefined,
    min: num(get("min")),
    max: num(get("max")),
    vehicle: num(get("vehicle")),
    sort: sort in SORTS ? sort : "updated",
  };
}

export function filtersToParams(f: ProductFilters): Record<string, string | undefined> {
  return {
    q: f.q,
    status: f.status,
    category: f.category?.toString(),
    make: f.make?.toString(),
    model: f.model?.toString(),
    condition: f.condition,
    photos: f.photos,
    stock: f.stock,
    min: f.min?.toString(),
    max: f.max?.toString(),
    vehicle: f.vehicle?.toString(),
    sort: f.sort === "updated" ? undefined : f.sort,
  };
}

export type CategoryNode = { id: number; name: string; parent_id: number | null; slug: string };

/** A top-level category matches itself and all its leaves. */
export function categoryIds(categories: CategoryNode[], id: number): number[] {
  return [id, ...categories.filter((c) => c.parent_id === id).map((c) => c.id)];
}

/**
 * Applies filters to a products select. `legacy` = migration 0600 not applied yet
 * (no deleted_at / image_count), so those filters are skipped.
 */
export function buildProductQuery(db: Db, f: ProductFilters, select: string, opts: { categories: CategoryNode[]; legacy?: boolean; count?: boolean }) {
  const fitment = f.make || f.model;
  const sel = fitment ? `${select}, product_fitments!inner(make_id, model_id)` : select;
  let query = db.from("products").select(sel, opts.count ? { count: "exact" } : undefined);
  if (!opts.legacy) query = query.is("deleted_at", null);
  if (f.status) query = query.eq("status", f.status);
  if (f.condition) query = query.eq("condition", f.condition);
  if (f.category) query = query.in("category_id", categoryIds(opts.categories, f.category));
  if (f.make) query = query.eq("product_fitments.make_id", f.make);
  if (f.model) query = query.eq("product_fitments.model_id", f.model);
  if (f.stock === "in") query = query.gt("quantity", 0);
  if (f.stock === "out") query = query.eq("quantity", 0);
  if (f.min !== undefined) query = query.gte("price", f.min);
  if (f.max !== undefined) query = query.lte("price", f.max);
  if (f.vehicle) query = query.eq("donor_vehicle_id", f.vehicle);
  if (f.photos && !opts.legacy) query = f.photos === "none" ? query.eq("image_count", 0) : query.gt("image_count", 0);
  if (f.q) {
    const like = `%${f.q}%`;
    const pn = partNumberKey(f.q);
    const ors = [`title.ilike.${like}`, `sku.ilike.${like}`, `oem_part_number.ilike.${like}`];
    if (pn.length >= 3) ors.push(`part_numbers_search.ilike.%${pn}%`);
    if (/^\d{6,}$/.test(f.q)) ors.push(`external_ids->>ebay_item_id.eq.${f.q}`);
    query = query.or(ors.join(","));
  }
  const sort = SORTS[f.sort];
  return query.order(sort.column, { ascending: sort.ascending }).order("id");
}

export async function loadCatalogRefs(db: Db) {
  const [cats, makes, models] = await Promise.all([
    db.from("categories").select("id, name, parent_id, slug").order("sort_order").order("name"),
    db.from("makes").select("id, name").order("name"),
    db.from("models").select("id, name, make_id").order("name"),
  ]);
  return {
    categories: (cats.data ?? []) as CategoryNode[],
    makes: makes.data ?? [],
    models: models.data ?? [],
  };
}

export function ebayItemId(externalIds: unknown): string | null {
  if (externalIds && typeof externalIds === "object" && !Array.isArray(externalIds)) {
    const v = (externalIds as Record<string, unknown>).ebay_item_id;
    return v ? String(v) : null;
  }
  return null;
}
