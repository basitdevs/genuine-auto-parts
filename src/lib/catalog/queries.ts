import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { ProductRow, SearchFacets } from "@/lib/supabase/database.types";
import { effectiveSort, PAGE_SIZE, type PartsSearch } from "@/lib/search/params";
import { imageUrl, VEHICLE_BUCKET, type ImageSource } from "./images";
import type { CatalogStats, CategoryTile, MakeTile, ProductCard, SearchResult, VehicleCard } from "./types";

/**
 * Catalog reads. Every function is `"use cache"` + tagged "catalog" (call
 * revalidateTag("catalog", "max") after imports/edits, see /api/revalidate).
 *
 * Resilience contract: a failed query never throws. It logs, returns an empty
 * fallback, and caches that fallback for seconds only (healthy results: hours),
 * so a database hiccup can't break the build or pin empty pages for long.
 */
export const CATALOG_TAG = "catalog";

const CARD_SELECT =
  "id, slug, title, price, compare_at_price, condition, status, quantity, oem_part_number, placement, " +
  "product_images(storage_path, external_url, alt, position), categories(icon, parent:parent_id(icon))";

type CardRow = Pick<
  ProductRow,
  "id" | "slug" | "title" | "price" | "compare_at_price" | "condition" | "status" | "quantity" | "oem_part_number" | "placement"
> & {
  product_images: (ImageSource & { position: number })[] | null;
  categories: { icon: string | null; parent: { icon: string | null } | null } | null;
};

const EMPTY_FACETS: SearchFacets = { categories: [], makes: [], conditions: [], price: { min: 0, max: 0 } };

/** Logs a failed catalog query. Callers then set cacheLife("seconds") (a blip must not stick) and return a fallback. */
function reportQueryError(label: string, error: { message: string } | unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
  console.error(`[catalog] ${label} failed: ${message}`);
}

function toCard(row: CardRow): ProductCard {
  const first = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
  const src = first ? imageUrl(first) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null ? null : Number(row.compare_at_price),
    condition: row.condition,
    status: row.status,
    quantity: row.quantity,
    oemPartNumber: row.oem_part_number,
    placement: row.placement,
    categoryIcon: row.categories?.icon ?? row.categories?.parent?.icon ?? null,
    image: src ? { src, alt: first?.alt ?? row.title } : null,
  };
}

type CatalogSummary = { categoryTiles: CategoryTile[]; facets: SearchFacets; stats: CatalogStats; refreshedAt: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Precomputed aggregates from public.catalog_summary (migration 0500), refreshed at the
 * end of every import and on admin product edits, then revalidated via the "catalog" tag.
 * Returns null when the row is missing or unreadable; callers fall back to live queries.
 */
export async function getCatalogSummary(): Promise<CatalogSummary | null> {
  "use cache";
  cacheTag(CATALOG_TAG, "catalog-summary");
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return null;
  }
  try {
    const { data, error } = await db.from("catalog_summary").select("category_counts, facets, stats, refreshed_at").eq("id", 1).maybeSingle();
    if (error) throw error;
    const facets = asRecord(data?.facets);
    const stats = asRecord(data?.stats);
    if (!data || !facets || !stats || !Array.isArray(data.category_counts) || !Array.isArray(facets.categories)) {
      cacheLife("minutes");
      return null;
    }
    cacheLife("hours");
    return {
      categoryTiles: (data.category_counts as CategoryTile[]).filter((c) => Number(c.count) > 0),
      facets: { ...EMPTY_FACETS, ...(facets as Partial<SearchFacets>) },
      stats: { activeParts: Number(stats.activeParts ?? 0), makes: Number(stats.makes ?? 0), vehicles: Number(stats.vehicles ?? 0) },
      refreshedAt: data.refreshed_at,
    };
  } catch (error) {
    reportQueryError("catalog summary", error);
    cacheLife("seconds");
    return null;
  }
}

export async function getCatalogStats(): Promise<CatalogStats | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const summary = await getCatalogSummary();
  if (summary) {
    cacheLife("hours");
    return summary.stats;
  }
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return null;
  }
  try {
    const { data, error } = await db.rpc("catalog_stats");
    if (error || !data || typeof data !== "object" || Array.isArray(data)) throw error ?? new Error("empty response");
    const stats = data as Record<string, unknown>;
    cacheLife("hours");
    return {
      activeParts: Number(stats.activeParts ?? 0),
      makes: Number(stats.makes ?? 0),
      vehicles: Number(stats.vehicles ?? 0),
    };
  } catch (error) {
    reportQueryError("catalog_stats", error);
    cacheLife("seconds");
    return null;
  }
}

export async function getNewestProducts(limit = 8): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  try {
    const { data, error } = await db
      .from("products")
      .select(CARD_SELECT)
      .eq("status", "active")
      .gt("quantity", 0)
      .order("listed_at", { ascending: false, nullsFirst: false })
      .limit(limit)
      .overrideTypes<CardRow[], { merge: false }>();
    if (error) throw error;
    cacheLife("hours");
    return (data ?? []).map(toCard);
  } catch (error) {
    reportQueryError("newest products", error);
    cacheLife("seconds");
    return [];
  }
}

export async function getShopByMakes(): Promise<MakeTile[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  try {
    const { data, error } = await db.rpc("fitment_makes", {});
    if (error) throw error;
    cacheLife("hours");
    return (data ?? [])
      .map((m) => ({ slug: m.slug, name: m.name, count: Number(m.product_count) }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    reportQueryError("makes", error);
    cacheLife("seconds");
    return [];
  }
}

export async function getCategoryTiles(): Promise<CategoryTile[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const summary = await getCatalogSummary();
  if (summary) {
    cacheLife("hours");
    return summary.categoryTiles;
  }
  // Fallback (summary not created/refreshed yet): live aggregate.
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  try {
    // One cheap aggregate (active products per category) rolled up to the top-level groups,
    // instead of the full facet engine.
    const { data, error } = await db
      .from("categories")
      .select("id, parent_id, slug, name, description, icon, sort_order, products(count)")
      .eq("products.status", "active")
      .order("sort_order")
      .overrideTypes<
        {
          id: number;
          parent_id: number | null;
          slug: string;
          name: string;
          description: string | null;
          icon: string | null;
          sort_order: number;
          products: { count: number }[];
        }[],
        { merge: false }
      >();
    if (error) throw error;
    const rows = data ?? [];
    const totals = new Map<number, number>();
    for (const c of rows) {
      const root = c.parent_id ?? c.id;
      totals.set(root, (totals.get(root) ?? 0) + (c.products?.[0]?.count ?? 0));
    }
    cacheLife("hours");
    return rows
      .filter((c) => c.parent_id === null)
      .map((c) => ({ slug: c.slug, name: c.name, description: c.description, icon: c.icon, count: totals.get(c.id) ?? 0 }))
      .filter((c) => c.count > 0);
  } catch (error) {
    reportQueryError("categories", error);
    cacheLife("seconds");
    return [];
  }
}

type VehicleRowWithRelations = {
  slug: string;
  stock_number: string;
  year: number;
  trim: string | null;
  odometer: number | null;
  engine: string | null;
  transmission: string | null;
  drive_type: string | null;
  exterior_color: string | null;
  vin: string | null;
  description: string | null;
  acquired_at: string | null;
  makes: { name: string; slug: string } | null;
  models: { name: string; slug: string } | null;
  donor_vehicle_images: (ImageSource & { position: number })[] | null;
  products: { count: number }[] | null;
};

const VEHICLE_SELECT =
  "slug, stock_number, year, trim, odometer, engine, transmission, drive_type, exterior_color, vin, description, acquired_at, " +
  "makes(name, slug), models(name, slug), donor_vehicle_images(storage_path, external_url, alt, position), products(count)";

function toVehicleCard(v: VehicleRowWithRelations): VehicleCard {
  const first = [...(v.donor_vehicle_images ?? [])].sort((a, b) => a.position - b.position)[0];
  const src = first ? imageUrl(first, VEHICLE_BUCKET) : null;
  const label = `${v.year} ${v.makes?.name ?? ""} ${v.models?.name ?? ""}`.trim();
  return {
    slug: v.slug,
    stockNumber: v.stock_number,
    year: v.year,
    make: v.makes?.name ?? "",
    makeSlug: v.makes?.slug ?? "",
    model: v.models?.name ?? null,
    modelSlug: v.models?.slug ?? null,
    trim: v.trim,
    odometer: v.odometer,
    engine: v.engine,
    transmission: v.transmission,
    driveType: v.drive_type,
    color: v.exterior_color,
    image: src ? { src, alt: first?.alt ?? label } : null,
    partsCount: v.products?.[0]?.count ?? 0,
  };
}

export async function getDismantlingVehicles(limit = 6): Promise<VehicleCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  try {
    const { data, error } = await db
      .from("donor_vehicles")
      .select(VEHICLE_SELECT)
      .eq("status", "dismantling")
      .order("acquired_at", { ascending: false, nullsFirst: false })
      .limit(limit)
      .overrideTypes<VehicleRowWithRelations[], { merge: false }>();
    if (error) throw error;
    cacheLife("hours");
    return (data ?? []).map(toVehicleCard);
  } catch (error) {
    reportQueryError("vehicles", error);
    cacheLife("seconds");
    return [];
  }
}

export type VehicleDetail = VehicleCard & {
  vin: string | null;
  description: string | null;
  acquiredAt: string | null;
  images: { src: string; alt: string }[];
};

/** Vehicle detail page. Returns undefined on query failure (vs null = not found). */
export async function getVehicleBySlug(slug: string): Promise<VehicleDetail | null | undefined> {
  "use cache";
  cacheTag(CATALOG_TAG, `vehicle:${slug}`);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return null;
  }
  try {
    const { data, error } = await db
      .from("donor_vehicles")
      .select(VEHICLE_SELECT)
      .eq("slug", slug)
      .maybeSingle()
      .overrideTypes<VehicleRowWithRelations | null, { merge: false }>();
    if (error) throw error;
    if (!data) {
      cacheLife("minutes");
      return null;
    }
    cacheLife("hours");
    const card = toVehicleCard(data);
    return {
      ...card,
      vin: data.vin,
      description: data.description,
      acquiredAt: data.acquired_at,
      images: [...(data.donor_vehicle_images ?? [])]
        .sort((a, b) => a.position - b.position)
        .flatMap((img) => {
          const src = imageUrl(img, VEHICLE_BUCKET);
          return src ? [{ src, alt: img.alt ?? card.make }] : [];
        }),
    };
  } catch (error) {
    reportQueryError(`vehicle ${slug}`, error);
    cacheLife("seconds");
    return undefined;
  }
}

/** All non-incoming vehicles for /vehicles (dismantling first). */
export async function getAllVehicles(): Promise<VehicleCard[] | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  try {
    const { data, error } = await db
      .from("donor_vehicles")
      .select(VEHICLE_SELECT)
      .in("status", ["dismantling", "parted_out"])
      .order("status")
      .order("acquired_at", { ascending: false, nullsFirst: false })
      .limit(120)
      .overrideTypes<VehicleRowWithRelations[], { merge: false }>();
    if (error) throw error;
    cacheLife("hours");
    return (data ?? []).map(toVehicleCard);
  } catch (error) {
    reportQueryError("all vehicles", error);
    cacheLife("seconds");
    return null;
  }
}

/** Listing search. Cached per unique filter combination. */
export async function searchParts(search: PartsSearch): Promise<SearchResult> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return { products: [], total: 0, facets: EMPTY_FACETS, error: "not-configured" };
  }

  const args = {
    p_query: search.q ?? null,
    p_year: search.year ?? null,
    p_make: search.make ?? null,
    p_model: search.model ?? null,
    p_category: search.category ?? null,
    p_part_number: search.pn ?? null,
    p_condition: search.condition ?? null,
    p_min_price: search.min ?? null,
    p_max_price: search.max ?? null,
    p_in_stock: search.stock,
    p_vehicle: search.vehicle ?? null,
  };
  const page = search.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;

  // Unfiltered listing: facets come from the precomputed summary instead of the facet engine.
  const unfiltered = !search.stock && Object.entries(args).every(([key, value]) => key === "p_in_stock" || value === null);

  try {
    const [results, facets] = await Promise.all([
      db
        .rpc("search_products", { ...args, p_sort: effectiveSort(search) }, { count: "exact" })
        .select(CARD_SELECT)
        .range(from, from + PAGE_SIZE - 1)
        .overrideTypes<CardRow[], { merge: false }>(),
      (async (): Promise<{ data: unknown; error: { message: string } | null }> => {
        const summary = unfiltered ? await getCatalogSummary() : null;
        if (summary) return { data: summary.facets, error: null };
        return db.rpc("search_facets", args);
      })(),
    ]);
    if (results.error) throw results.error;
    if (facets.error) reportQueryError("search facets", facets.error);
    cacheLife("minutes");
    return {
      products: (results.data ?? []).map(toCard),
      total: results.count ?? 0,
      facets: (facets.data as SearchFacets | null) ?? EMPTY_FACETS,
      error: null,
    };
  } catch (error) {
    reportQueryError("search", error);
    cacheLife("seconds");
    return { products: [], total: 0, facets: EMPTY_FACETS, error: error instanceof Error ? error.message : "search failed" };
  }
}

export type ProductDetail = ProductCard & {
  sku: string;
  description: string | null;
  conditionNotes: string | null;
  interchangeNumbers: string[];
  brand: string | null;
  warrantyDays: number;
  isFreight: boolean;
  weightLb: number | null;
  listedAt: string | null;
  images: { src: string; alt: string }[];
  category: { name: string; slug: string; parent: { name: string; slug: string } | null } | null;
  fitments: {
    year: number;
    make: string;
    model: string | null;
    makeSlug: string | null;
    modelSlug: string | null;
    trim: string | null;
    engine: string | null;
  }[];
  vehicle: {
    stockNumber: string;
    slug: string;
    year: number;
    make: string;
    model: string | null;
    odometer: number | null;
    engine: string | null;
    transmission: string | null;
    vin: string | null;
  } | null;
};

type DetailRow = CardRow & {
  sku: string;
  description: string | null;
  condition_notes: string | null;
  interchange_numbers: string[];
  brand: string | null;
  warranty_days: number;
  is_freight: boolean;
  weight_lb: number | null;
  listed_at: string | null;
  category: { name: string; slug: string; icon: string | null; parent: { name: string; slug: string; icon: string | null } | null } | null;
  product_fitments: {
    year: number;
    trim: string | null;
    engine: string | null;
    makes: { name: string; slug: string } | null;
    models: { name: string; slug: string } | null;
  }[];
  donor_vehicles: {
    stock_number: string;
    slug: string;
    year: number;
    odometer: number | null;
    engine: string | null;
    transmission: string | null;
    vin: string | null;
    makes: { name: string } | null;
    models: { name: string } | null;
  } | null;
};

/**
 * Product detail, rendered on demand (no build-time generation) and cached per slug.
 * Returns null when the product doesn't exist and undefined when the query failed.
 */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null | undefined> {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return null;
  }
  try {
    const { data, error } = await db
      .from("products")
      .select(
        `${CARD_SELECT}, sku, description, condition_notes, interchange_numbers, brand, warranty_days, is_freight, weight_lb, listed_at,
         category:category_id(name, slug, icon, parent:parent_id(name, slug, icon)),
         product_fitments(year, trim, engine, makes(name, slug), models(name, slug)),
         donor_vehicles(stock_number, slug, year, odometer, engine, transmission, vin, makes(name), models(name))`,
      )
      .eq("slug", slug)
      .maybeSingle()
      .overrideTypes<DetailRow | null, { merge: false }>();
    if (error) throw error;
    if (!data) {
      cacheLife("minutes");
      return null;
    }
    cacheLife("hours");

    const card = toCard(data);
    const images = [...(data.product_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .flatMap((img) => {
        const src = imageUrl(img);
        return src ? [{ src, alt: img.alt ?? data.title }] : [];
      });
    const v = data.donor_vehicles;
    return {
      ...card,
      categoryIcon: data.category?.icon ?? data.category?.parent?.icon ?? null,
      sku: data.sku,
      description: data.description,
      conditionNotes: data.condition_notes,
      interchangeNumbers: data.interchange_numbers ?? [],
      brand: data.brand,
      warrantyDays: data.warranty_days,
      isFreight: data.is_freight,
      weightLb: data.weight_lb === null ? null : Number(data.weight_lb),
      listedAt: data.listed_at,
      images,
      category: data.category
        ? {
            name: data.category.name,
            slug: data.category.slug,
            parent: data.category.parent ? { name: data.category.parent.name, slug: data.category.parent.slug } : null,
          }
        : null,
      fitments: (data.product_fitments ?? [])
        .map((f) => ({
          year: f.year,
          make: f.makes?.name ?? "",
          model: f.models?.name ?? null,
          makeSlug: f.makes?.slug ?? null,
          modelSlug: f.models?.slug ?? null,
          trim: f.trim,
          engine: f.engine,
        }))
        .sort((a, b) => b.year - a.year),
      vehicle: v
        ? {
            stockNumber: v.stock_number,
            slug: v.slug,
            year: v.year,
            make: v.makes?.name ?? "",
            model: v.models?.name ?? null,
            odometer: v.odometer,
            engine: v.engine,
            transmission: v.transmission,
            vin: v.vin,
          }
        : null,
    };
  } catch (error) {
    reportQueryError(`product ${slug}`, error);
    cacheLife("seconds");
    return undefined;
  }
}

/**
 * In-stock parts similar to a product: same category + make + model first, then
 * widened to make + model, then category, until there are enough. Never includes
 * the product itself. Used on every product page and as the "Sold" fallback.
 */
export async function getSimilarProducts(
  productId: string,
  { category, make, model }: { category: string | null; make: string | null; model: string | null },
  limit = 8,
): Promise<ProductCard[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  const attempts = [
    { p_category: category, p_make: make, p_model: model },
    { p_category: null, p_make: make, p_model: model },
    { p_category: category, p_make: make, p_model: null },
    { p_category: category, p_make: null, p_model: null },
  ].filter(
    (a, i, all) =>
      (a.p_category || a.p_make) &&
      (!a.p_model || a.p_make) &&
      all.findIndex((b) => b.p_category === a.p_category && b.p_make === a.p_make && b.p_model === a.p_model) === i,
  );

  const found = new Map<string, ProductCard>();
  try {
    for (const attempt of attempts) {
      if (found.size >= limit) break;
      const { data, error } = await db
        .rpc("search_products", { ...attempt, p_in_stock: true, p_sort: "newest" })
        .select(CARD_SELECT)
        .neq("id", productId)
        .limit(limit)
        .overrideTypes<CardRow[], { merge: false }>();
      if (error) throw error;
      for (const row of data ?? []) if (found.size < limit && !found.has(row.id)) found.set(row.id, toCard(row));
    }
    cacheLife("hours");
    return [...found.values()];
  } catch (error) {
    reportQueryError(`similar to ${productId}`, error);
    cacheLife("seconds");
    return [...found.values()];
  }
}

export type CartProduct = ProductCard & { sku: string; weightLb: number | null; isFreight: boolean };

/**
 * Cart lines, read fresh (no cache): price and stock must be current when the shopper
 * reviews the cart. Returns null when the query failed (the cart then shows a retry state).
 */
export async function getCartProducts(ids: string[]): Promise<Map<string, CartProduct> | null> {
  const out = new Map<string, CartProduct>();
  if (ids.length === 0) return out;
  const db = createPublicClient();
  if (!db) return null;
  const { data, error } = await db
    .from("products")
    .select(`${CARD_SELECT}, sku, weight_lb, is_freight`)
    .in("id", ids)
    .overrideTypes<(CardRow & { sku: string; weight_lb: number | null; is_freight: boolean })[], { merge: false }>();
  if (error) {
    reportQueryError("cart products", error);
    return null;
  }
  for (const row of data ?? []) {
    out.set(row.id, { ...toCard(row), sku: row.sku, weightLb: row.weight_lb === null ? null : Number(row.weight_lb), isFreight: row.is_freight });
  }
  return out;
}

/** Title for a SKU (contact form context). null = unknown SKU or query failure. */
export async function getProductTitleBySku(sku: string): Promise<string | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return null;
  }
  const { data, error } = await db.from("products").select("title").eq("sku", sku).maybeSingle();
  if (error) {
    reportQueryError(`sku ${sku}`, error);
    cacheLife("seconds");
    return null;
  }
  cacheLife("hours");
  return data?.title ?? null;
}

export type FitmentOption = { value: string; label: string; count: number };

export async function getFitmentYears(): Promise<FitmentOption[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  const { data, error } = await db.rpc("fitment_years", {});
  if (error) {
    reportQueryError("fitment years", error);
    cacheLife("seconds");
    return [];
  }
  cacheLife("hours");
  return (data ?? []).map((y) => ({ value: String(y.year), label: String(y.year), count: Number(y.product_count) }));
}

export async function getFitmentMakes(year: number | null): Promise<FitmentOption[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  const { data, error } = await db.rpc("fitment_makes", { p_year: year });
  if (error) {
    reportQueryError("fitment makes", error);
    cacheLife("seconds");
    return [];
  }
  cacheLife("hours");
  return (data ?? []).map((m) => ({ value: m.slug, label: m.name, count: Number(m.product_count) }));
}

export async function getFitmentModels(make: string, year: number | null): Promise<FitmentOption[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  const { data, error } = await db.rpc("fitment_models", { p_make: make, p_year: year });
  if (error) {
    reportQueryError("fitment models", error);
    cacheLife("seconds");
    return [];
  }
  cacheLife("hours");
  return (data ?? []).map((m) => ({ value: m.slug, label: m.name, count: Number(m.product_count) }));
}

/** Top-level categories for the search panel (no counts needed). */
export async function getCategoryOptions(): Promise<{ value: string; label: string }[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return [];
  }
  const { data, error } = await db.from("categories").select("slug, name").is("parent_id", null).order("sort_order");
  if (error) {
    reportQueryError("category options", error);
    cacheLife("seconds");
    return [];
  }
  cacheLife("hours");
  return (data ?? []).map((c) => ({ value: c.slug, label: c.name }));
}

/**
 * Optional SEO overrides set in the admin (migration 0600). Separate from getProductBySlug so
 * a missing column can never break product pages: any error simply means "no overrides".
 */
export async function getProductSeo(slug: string): Promise<{ title: string | null; description: string | null } | null> {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return null;
  }
  const { data, error } = await db.from("products").select("seo_title, seo_description").eq("slug", slug).maybeSingle();
  if (error) cacheLife("minutes");
  else cacheLife("hours");
  if (error || !data) return null;
  return { title: data.seo_title, description: data.seo_description };
}
