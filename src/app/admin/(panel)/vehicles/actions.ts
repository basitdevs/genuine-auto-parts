"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { dbError, invalid, logEvent, revalidateCatalog } from "@/lib/admin/server";
import { VEHICLE_BUCKET } from "@/lib/catalog/images";
import { slugify } from "@/lib/import/ebay-mapping";

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optInt = z.union([z.literal("").transform(() => null), z.coerce.number().int().min(0).max(5_000_000)]).nullable().optional();

const vehicleSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  stock_number: z.string().trim().min(1, "Stock # is required").max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  slug: z.string().trim().max(120).optional().default(""),
  vin: z.union([z.literal("").transform(() => null), z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "A VIN has 17 characters (no I, O or Q)")]).nullable().optional(),
  year: z.coerce.number().int().min(1950, "Year looks wrong").max(2100),
  make_id: z.coerce.number().int().positive("Pick a make"),
  model_id: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive()]).nullable().optional(),
  trim: optText(80),
  odometer: optInt,
  engine: optText(80),
  transmission: optText(80),
  drive_type: optText(20),
  exterior_color: optText(40),
  interior_color: optText(40),
  status: z.enum(["incoming", "dismantling", "parted_out", "crushed"]),
  description: optText(5000),
  is_featured: z.boolean(),
  acquired_at: z.union([z.literal("").transform(() => null), z.iso.date()]).nullable().optional(),
});
export type VehicleInput = z.input<typeof vehicleSchema>;

export async function saveVehicle(input: VehicleInput): Promise<ActionResult<{ id: number }>> {
  const auth = await authorize("vehicles");
  if (!auth.ok) return FORBIDDEN;
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { db } = auth.session;
  const { id, slug: rawSlug, ...fields } = parsed.data;

  const [{ data: make }, { data: model }] = await Promise.all([
    db.from("makes").select("name").eq("id", fields.make_id).maybeSingle(),
    fields.model_id ? db.from("models").select("name").eq("id", fields.model_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const slug = slugify(rawSlug || `${fields.year} ${make?.name ?? ""} ${model?.name ?? ""} ${fields.stock_number}`, 120);
  const row = { ...fields, slug };

  let vehicleId = id;
  let oldSlug: string | null = null;
  if (id) {
    const { data: before } = await db.from("donor_vehicles").select("slug").eq("id", id).maybeSingle();
    oldSlug = before?.slug ?? null;
    const { error } = await db.from("donor_vehicles").update(row).eq("id", id);
    if (error) return dbError(error);
  } else {
    const { data, error } = await db.from("donor_vehicles").insert(row).select("id").single();
    if (error || !data) return dbError(error);
    vehicleId = data.id;
  }
  await revalidateCatalog(db, { vehicleSlugs: [slug, ...(oldSlug && oldSlug !== slug ? [oldSlug] : [])], summary: false });
  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true, message: id ? "Vehicle saved" : "Vehicle created", data: { id: vehicleId! } };
}

export async function deleteVehicle(id: number): Promise<ActionResult> {
  const auth = await authorize("settings"); // admin only
  if (!auth.ok) return FORBIDDEN;
  const { db } = auth.session;
  const { data: v } = await db.from("donor_vehicles").select("slug, stock_number").eq("id", id).maybeSingle();
  if (!v) return { ok: false, message: "Vehicle not found." };
  const { data: imgs } = await db.from("donor_vehicle_images").select("storage_path").eq("vehicle_id", id);
  const { error } = await db.from("donor_vehicles").delete().eq("id", id);
  if (error) return dbError(error);
  const paths = (imgs ?? []).map((i) => i.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length) await db.storage.from(VEHICLE_BUCKET).remove(paths);
  await logEvent(db, "vehicle.delete", "donor_vehicles", String(id), `Deleted vehicle ${v.stock_number} (linked parts kept, unlinked)`);
  await revalidateCatalog(db, { vehicleSlugs: [v.slug], summary: false });
  revalidatePath("/admin/vehicles");
  return { ok: true, message: `Vehicle ${v.stock_number} deleted` };
}

const idStr = z.string().regex(/^\d+$/);

export async function registerVehicleImage(input: { ownerId: string; storagePath: string }): Promise<ActionResult> {
  const auth = await authorize("vehicles");
  if (!auth.ok) return FORBIDDEN;
  if (!idStr.safeParse(input.ownerId).success || !new RegExp(`^${input.ownerId}/[A-Za-z0-9._-]{1,120}$`).test(input.storagePath)) return { ok: false, message: "Invalid upload." };
  const { db } = auth.session;
  const vehicleId = Number(input.ownerId);
  const { count } = await db.from("donor_vehicle_images").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId);
  const { error } = await db.from("donor_vehicle_images").insert({ vehicle_id: vehicleId, storage_path: input.storagePath, position: count ?? 0 });
  if (error) return dbError(error);
  const { data: v } = await db.from("donor_vehicles").select("slug").eq("id", vehicleId).maybeSingle();
  await revalidateCatalog(db, { vehicleSlugs: v ? [v.slug] : [], summary: false });
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true, message: "Photo added" };
}

export async function saveVehicleImages(input: { ownerId: string; images: { id: number; alt: string }[] }): Promise<ActionResult> {
  const auth = await authorize("vehicles");
  if (!auth.ok) return FORBIDDEN;
  if (!idStr.safeParse(input.ownerId).success || input.images.length > 60) return { ok: false, message: "Invalid request." };
  const { db } = auth.session;
  const vehicleId = Number(input.ownerId);
  for (const [position, img] of input.images.entries()) {
    const { error } = await db.from("donor_vehicle_images").update({ position, alt: img.alt.slice(0, 200) || null }).eq("id", img.id).eq("vehicle_id", vehicleId);
    if (error) return dbError(error);
  }
  const { data: v } = await db.from("donor_vehicles").select("slug").eq("id", vehicleId).maybeSingle();
  await revalidateCatalog(db, { vehicleSlugs: v ? [v.slug] : [], summary: false });
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true, message: "Photo order saved" };
}

export async function deleteVehicleImage(input: { ownerId: string; imageId: number }): Promise<ActionResult> {
  const auth = await authorize("vehicles");
  if (!auth.ok) return FORBIDDEN;
  if (!idStr.safeParse(input.ownerId).success) return { ok: false, message: "Invalid request." };
  const { db } = auth.session;
  const vehicleId = Number(input.ownerId);
  const { data: img } = await db.from("donor_vehicle_images").select("storage_path").eq("id", input.imageId).eq("vehicle_id", vehicleId).maybeSingle();
  if (!img) return { ok: false, message: "Photo not found." };
  const { error } = await db.from("donor_vehicle_images").delete().eq("id", input.imageId);
  if (error) return dbError(error);
  if (img.storage_path) await db.storage.from(VEHICLE_BUCKET).remove([img.storage_path]);
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true, message: "Photo deleted" };
}
