"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { isMissingSchema } from "@/lib/admin/db";
import { dbError, invalid, logEvent, revalidateCatalog } from "@/lib/admin/server";
import type { StaffSession } from "@/lib/auth/staff";
import { PRODUCT_BUCKET } from "@/lib/catalog/images";
import { slugify } from "@/lib/import/ebay-mapping";

const uuid = z.uuid();
const statusEnum = z.enum(["draft", "active", "sold", "archived"]);
const money = z.coerce.number().min(0, "Must be 0 or more").max(1_000_000);
const optMoney = z.union([z.literal("").transform(() => null), z.coerce.number().min(0).max(1_000_000)]).nullable().optional();
const optDim = z.union([z.literal("").transform(() => null), z.coerce.number().min(0).max(100_000)]).nullable().optional();
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

/** Status and stock stay consistent: selling the last unit = sold; sold = 0 left. */
function normalizeStock(status: z.infer<typeof statusEnum>, quantity: number) {
  if (status === "sold") return { status, quantity: 0 };
  if (status === "active" && quantity === 0) return { status: "sold" as const, quantity };
  return { status, quantity };
}

async function slugsFor(db: StaffSession["db"], ids: string[]) {
  const { data } = await db.from("products").select("slug").in("id", ids);
  return (data ?? []).map((p) => p.slug);
}

// ---------------------------------------------------------------- quick edit (table row)
const quickSchema = z.object({ id: uuid, price: money, quantity: z.coerce.number().int().min(0).max(10_000), status: statusEnum });

export async function quickUpdateProduct(input: z.input<typeof quickSchema>): Promise<ActionResult> {
  const auth = await authorize("products");
  if (!auth.ok) return FORBIDDEN;
  const parsed = quickSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { status, quantity } = normalizeStock(parsed.data.status, parsed.data.quantity);
  const { data, error } = await auth.session.db
    .from("products")
    .update({ price: parsed.data.price, quantity, status })
    .eq("id", parsed.data.id)
    .select("slug, compare_at_price")
    .maybeSingle();
  if (error || !data) return dbError(error, "Product not found.");
  await revalidateCatalog(auth.session.db, { productSlugs: [data.slug] });
  revalidatePath("/admin/products");
  return { ok: true, message: status !== parsed.data.status ? `Saved · marked ${status}` : "Saved" };
}

// ---------------------------------------------------------------- bulk actions
const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ids: z.array(uuid).min(1).max(500), value: statusEnum }),
  z.object({ action: z.literal("category"), ids: z.array(uuid).min(1).max(500), value: z.coerce.number().int().positive() }),
  z.object({ action: z.literal("price"), ids: z.array(uuid).min(1).max(500), value: z.coerce.number().min(-90, "At most -90%").max(500, "At most +500%") }),
  z.object({ action: z.literal("delete"), ids: z.array(uuid).min(1).max(500) }),
]);

export async function bulkProducts(input: z.input<typeof bulkSchema>): Promise<ActionResult> {
  // Authorize before looking at the input, so unauthorized callers learn nothing from validation.
  const auth = await authorize("products");
  if (!auth.ok) return FORBIDDEN;
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.action === "delete" && !(await authorize("settings")).ok) return FORBIDDEN; // delete = admin only
  const { db } = auth.session;
  const { ids } = parsed.data;
  const slugs = await slugsFor(db, ids);
  let message = "";

  switch (parsed.data.action) {
    case "status": {
      const value = parsed.data.value;
      const patch = value === "sold" ? { status: value, quantity: 0 } : { status: value };
      const { error, count } = await db.from("products").update(patch, { count: "exact" }).in("id", ids);
      if (error) return dbError(error);
      if (value === "active") await db.from("products").update({ quantity: 1 }).in("id", ids).eq("quantity", 0);
      message = `${count ?? ids.length} product(s) marked ${value}`;
      break;
    }
    case "category": {
      const { error, count } = await db.from("products").update({ category_id: parsed.data.value }, { count: "exact" }).in("id", ids);
      if (error) return dbError(error);
      message = `Category changed on ${count ?? ids.length} product(s)`;
      break;
    }
    case "price": {
      const { data, error } = await db.rpc("admin_adjust_prices", { p_ids: ids, p_percent: parsed.data.value });
      if (error) return dbError(error);
      message = `Prices ${parsed.data.value >= 0 ? "raised" : "lowered"} ${Math.abs(parsed.data.value)}% on ${data ?? ids.length} product(s)`;
      break;
    }
    case "delete": {
      const { error, count } = await db.from("products").update({ deleted_at: new Date().toISOString(), status: "archived" }, { count: "exact" }).in("id", ids);
      if (error) return dbError(error);
      message = `${count ?? ids.length} product(s) deleted`;
      break;
    }
  }
  await logEvent(db, `product.bulk_${parsed.data.action}`, "products", null, message, { ids, value: "value" in parsed.data ? parsed.data.value : null });
  await revalidateCatalog(db, { productSlugs: slugs });
  revalidatePath("/admin/products");
  return { ok: true, message };
}

// ---------------------------------------------------------------- full save (create / update)
const fitmentSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  make_id: z.coerce.number().int().positive("Pick a make"),
  model_id: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive()]).nullable().optional(),
  trim: optText(80),
  engine: optText(80),
  notes: optText(200),
});

const productSchema = z
  .object({
    id: uuid.optional(),
    title: z.string().trim().min(3, "Title is required").max(200),
    slug: z.string().trim().max(120).optional().default(""),
    sku: z.string().trim().min(1, "SKU is required").max(80).regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dot, dash or underscore"),
    status: statusEnum,
    condition: z.enum(["used", "new", "remanufactured", "for_parts"]),
    condition_notes: optText(500),
    description: optText(10_000),
    price: money,
    compare_at_price: optMoney,
    quantity: z.coerce.number().int().min(0).max(10_000),
    warranty_days: z.coerce.number().int().min(0).max(3650),
    is_featured: z.boolean(),
    oem_part_number: optText(80),
    interchange_numbers: z.array(z.string().trim().min(1).max(80)).max(40),
    brand: optText(80),
    placement: optText(80),
    category_id: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive()]).nullable().optional(),
    donor_vehicle_id: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive()]).nullable().optional(),
    weight_lb: optDim,
    length_in: optDim,
    width_in: optDim,
    height_in: optDim,
    is_freight: z.boolean(),
    seo_title: optText(70),
    seo_description: optText(170),
    fitments: z.array(fitmentSchema).max(400),
  })
  .refine((p) => p.compare_at_price == null || p.compare_at_price >= p.price, { message: "Compare-at price must be higher than the price", path: ["compare_at_price"] });

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("products");
  if (!auth.ok) return FORBIDDEN;
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { db } = auth.session;
  const { id, fitments, slug: rawSlug, ...fields } = parsed.data;
  const { status, quantity } = normalizeStock(fields.status, fields.quantity);
  const slug = slugify(rawSlug || `${fields.title}-${fields.sku}`, 120);

  const fullRow = { ...fields, status, quantity, slug, compare_at_price: fields.compare_at_price ?? null };
  // Before migration 0600 the SEO columns don't exist: save everything else instead of failing.
  const { seo_title: _seoTitle, seo_description: _seoDescription, ...legacyRow } = fullRow;
  void _seoTitle;
  void _seoDescription;
  let seoSkipped = false;
  let productId = id;
  let oldSlug: string | null = null;
  if (id) {
    const { data: before } = await db.from("products").select("slug").eq("id", id).maybeSingle();
    oldSlug = before?.slug ?? null;
    let { error } = await db.from("products").update(fullRow).eq("id", id);
    if (error && isMissingSchema(error)) {
      seoSkipped = true;
      ({ error } = await db.from("products").update(legacyRow).eq("id", id));
    }
    if (error) return dbError(error);
  } else {
    const extra = { source: "manual", listed_at: status === "active" ? new Date().toISOString() : null };
    let res = await db.from("products").insert({ ...fullRow, ...extra }).select("id").single();
    if (res.error && isMissingSchema(res.error)) {
      seoSkipped = true;
      res = await db.from("products").insert({ ...legacyRow, ...extra }).select("id").single();
    }
    if (res.error || !res.data) return dbError(res.error);
    productId = res.data.id;
  }

  // Fitment: replace the whole set (small per product, and triggers re-index search once).
  const del = await db.from("product_fitments").delete().eq("product_id", productId!);
  if (del.error) return dbError(del.error, "Saved the product, but couldn't update fitment.");
  const unique = new Map(fitments.map((f) => [[f.year, f.make_id, f.model_id ?? "", f.trim ?? "", f.engine ?? ""].join("|"), f]));
  if (unique.size) {
    const ins = await db.from("product_fitments").insert([...unique.values()].map((f) => ({ ...f, model_id: f.model_id ?? null, product_id: productId! })));
    if (ins.error) return dbError(ins.error, "Saved the product, but couldn't save fitment rows.");
  }

  await revalidateCatalog(db, { productSlugs: [slug, ...(oldSlug && oldSlug !== slug ? [oldSlug] : [])] });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  const note = seoSkipped ? " (SEO fields need the 0600 database update)" : "";
  return { ok: true, message: `${id ? "Product saved" : "Product created"}${note}`, data: { id: productId! } };
}

export async function duplicateProduct(id: string): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("products");
  if (!auth.ok) return FORBIDDEN;
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid product." };
  const { db } = auth.session;
  const { data: src } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!src) return { ok: false, message: "Product not found." };
  const suffix = Date.now().toString(36).slice(-5).toUpperCase();
  const { id: _id, created_at: _c, updated_at: _u, search_vector: _s, part_numbers_search: _p, deleted_at: _d, image_count: _i, external_ids: _e, ...copy } = src as typeof src & Record<string, unknown>;
  void _id; void _c; void _u; void _s; void _p; void _d; void _i; void _e;
  const { data: created, error } = await db
    .from("products")
    .insert({ ...copy, sku: `${src.sku}-COPY-${suffix}`.slice(0, 80), slug: `${src.slug}-copy-${suffix.toLowerCase()}`.slice(0, 120), title: `${src.title} (copy)`, status: "draft", source: "manual", external_ids: {}, listed_at: null })
    .select("id")
    .single();
  if (error || !created) return dbError(error);
  const { data: fits } = await db.from("product_fitments").select("year, make_id, model_id, trim, engine, notes").eq("product_id", id);
  if (fits?.length) await db.from("product_fitments").insert(fits.map((f) => ({ ...f, product_id: created.id })));
  await logEvent(db, "product.duplicate", "products", created.id, `Duplicated ${src.sku}`);
  revalidatePath("/admin/products");
  return { ok: true, message: "Draft copy created. Photos aren't copied.", data: { id: created.id } };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  return bulkProducts({ action: "delete", ids: [id] });
}

export async function restoreProduct(id: string): Promise<ActionResult> {
  const auth = await authorize("settings");
  if (!auth.ok) return FORBIDDEN;
  const { error } = await auth.session.db.from("products").update({ deleted_at: null, status: "draft" }).eq("id", id);
  if (error) return dbError(error);
  revalidatePath("/admin/products");
  return { ok: true, message: "Product restored as a draft" };
}

// ---------------------------------------------------------------- images
const registerSchema = z.object({ ownerId: uuid, storagePath: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/), alt: z.string().trim().max(200).optional() });

/** The browser uploads straight to Storage (staff RLS); this records the image row. */
export async function registerProductImage(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  const auth = await authorize("products");
  if (!auth.ok) return FORBIDDEN;
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { ownerId: productId, storagePath, alt } = parsed.data;
  if (!storagePath.startsWith(`${productId}/`)) return { ok: false, message: "Upload path doesn't match the product." };
  const { db } = auth.session;
  const { count } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { error } = await db.from("product_images").insert({ product_id: productId, storage_path: storagePath, alt: alt || null, position: count ?? 0 });
  if (error) return dbError(error);
  const slugs = await slugsFor(db, [productId]);
  await revalidateCatalog(db, { productSlugs: slugs, summary: false });
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Photo added" };
}

const imagesSchema = z.object({ ownerId: uuid, images: z.array(z.object({ id: z.coerce.number().int().positive(), alt: z.string().trim().max(200) })).max(50) });

export async function saveProductImages(input: z.input<typeof imagesSchema>): Promise<ActionResult> {
  const auth = await authorize("products");
  if (!auth.ok) return FORBIDDEN;
  const parsed = imagesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { db } = auth.session;
  const productId = parsed.data.ownerId;
  for (const [position, img] of parsed.data.images.entries()) {
    const { error } = await db.from("product_images").update({ position, alt: img.alt || null }).eq("id", img.id).eq("product_id", productId);
    if (error) return dbError(error);
  }
  const slugs = await slugsFor(db, [productId]);
  await revalidateCatalog(db, { productSlugs: slugs, summary: false });
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Photo order saved" };
}

export async function deleteProductImage(raw: { ownerId: string; imageId: number }): Promise<ActionResult> {
  const input = { productId: raw.ownerId, imageId: raw.imageId };
  const auth = await authorize("products");
  if (!auth.ok) return FORBIDDEN;
  if (!uuid.safeParse(input.productId).success || !Number.isInteger(input.imageId)) return { ok: false, message: "Invalid image." };
  const { db } = auth.session;
  const { data: img } = await db.from("product_images").select("storage_path").eq("id", input.imageId).eq("product_id", input.productId).maybeSingle();
  if (!img) return { ok: false, message: "Image not found." };
  const { error } = await db.from("product_images").delete().eq("id", input.imageId);
  if (error) return dbError(error);
  if (img.storage_path) await db.storage.from(PRODUCT_BUCKET).remove([img.storage_path]);
  const slugs = await slugsFor(db, [input.productId]);
  await revalidateCatalog(db, { productSlugs: slugs, summary: false });
  revalidatePath(`/admin/products/${input.productId}`);
  return { ok: true, message: "Photo deleted" };
}
