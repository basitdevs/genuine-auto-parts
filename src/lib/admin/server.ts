import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import type { StaffSession } from "@/lib/auth/staff";
import { clearExistsCache } from "@/lib/catalog/exists";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import type { Json } from "@/lib/supabase/database.types";
import type { ActionResult } from "./access";

type Db = StaffSession["db"];

/**
 * After any change that affects the public catalog: recompute catalog_summary (category
 * counts, facets, hero stats), drop the Proxy existence memo, and revalidate the catalog
 * plus each touched product/vehicle page. Summary failures are logged, never thrown.
 */
export async function revalidateCatalog(db: Db, opts: { productSlugs?: string[]; vehicleSlugs?: string[]; summary?: boolean } = {}) {
  if (opts.summary !== false) {
    const { error } = await db.rpc("refresh_catalog_summary");
    if (error) console.error(`[admin] refresh_catalog_summary failed: ${error.message}`);
  }
  clearExistsCache();
  revalidateTag(CATALOG_TAG, "max");
  for (const slug of opts.productSlugs ?? []) revalidateTag(`product:${slug}`, "max");
  for (const slug of opts.vehicleSlugs ?? []) revalidateTag(`vehicle:${slug}`, "max");
}

/** Explicit activity-log entry (bulk actions, uploads). Never fails the caller. */
export async function logEvent(db: Db, action: string, entityType: string, entityId: string | null, summary: string, after?: Json) {
  const { error } = await db.rpc("log_admin_event", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_summary: summary,
    p_after: after ?? null,
  });
  if (error) console.warn(`[admin] log_admin_event skipped: ${error.message}`);
}

export function revalidateAdmin(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

/** Zod failure → ActionResult with the first message and per-field errors. */
export function invalid(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = error.issues[0];
  return { ok: false, message: first ? `${first.path.length ? `${first.path.join(".")}: ` : ""}${first.message}` : "Check the form and try again.", fieldErrors };
}

export function dbError(error: { message: string; code?: string } | null, fallback = "The database rejected that change."): ActionResult<never> {
  if (!error) return { ok: false, message: fallback };
  if (error.code === "42501") return { ok: false, message: "You don't have permission to do that." };
  if (error.code === "23505") return { ok: false, message: "That value is already in use (must be unique)." };
  if (/does not exist|could not find/i.test(error.message)) return { ok: false, message: "Database update needed: run supabase/pending-2026-11-20-admin.sql in the SQL Editor." };
  return { ok: false, message: error.message || fallback };
}

/** FormData → plain object (repeated keys become arrays). */
export function formObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string") continue;
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  }
  return out;
}
