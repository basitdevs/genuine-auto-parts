"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { dbError, logEvent, revalidateCatalog } from "@/lib/admin/server";
import { PRODUCT_BUCKET } from "@/lib/catalog/images";
import { commitBatch, syncReferenceData, type BatchResult } from "@/lib/import/commit";
import { createServiceClient } from "@/lib/supabase/admin";

/** Imports are admin-only; writes use the service role so 6,500-row imports don't flood the audit log. */
async function adminService() {
  const auth = await authorize("imports");
  if (!auth.ok) return null;
  const db = createServiceClient();
  return db ? { auth, db } : null;
}

const startSchema = z.object({ filename: z.string().trim().min(1).max(200), totalRows: z.number().int().min(1).max(50_000), markMissingSold: z.boolean() });

export async function startImport(input: z.input<typeof startSchema>): Promise<ActionResult<{ jobId: string }>> {
  const ctx = await adminService();
  if (!ctx) return FORBIDDEN;
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid import." };
  try {
    await syncReferenceData(ctx.db);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Reference data sync failed." };
  }
  const { data, error } = await ctx.db
    .from("import_jobs")
    .insert({
      source: "ebay_active_listings",
      filename: parsed.data.filename,
      status: "running",
      total_rows: parsed.data.totalRows,
      started_at: new Date().toISOString(),
      created_by: ctx.auth.session.userId,
      options: { markMissingSold: parsed.data.markMissingSold, via: "admin" },
    })
    .select("id")
    .single();
  if (error || !data) return dbError(error);
  return { ok: true, message: "Import started", data: { jobId: data.id } };
}

const rowSchema = z.object({ rowNumber: z.number().int().min(1), raw: z.record(z.string(), z.string().max(5000)) });
const batchSchema = z.object({ jobId: z.uuid(), rows: z.array(rowSchema).min(1).max(250) });

export async function importBatch(input: z.input<typeof batchSchema>): Promise<ActionResult<BatchResult>> {
  const ctx = await adminService();
  if (!ctx) return FORBIDDEN;
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid batch." };
  try {
    const result = await commitBatch(ctx.db, parsed.data.jobId, parsed.data.rows);
    return { ok: true, message: "Batch saved", data: result };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Batch failed." };
  }
}

const finishSchema = z.object({ jobId: z.uuid(), markMissingSold: z.boolean(), seenSkus: z.array(z.string().max(80)).max(50_000), aborted: z.boolean().default(false) });

export async function finishImport(input: z.input<typeof finishSchema>): Promise<ActionResult<{ markedSold: number }>> {
  const ctx = await adminService();
  if (!ctx) return FORBIDDEN;
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { jobId, markMissingSold, seenSkus, aborted } = parsed.data;
  const { db } = ctx;

  const count = async (status: "created" | "updated" | "failed") => (await db.from("import_rows").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", status)).count ?? 0;
  const [created, updated, failed] = await Promise.all([count("created"), count("updated"), count("failed")]);

  let markedSold = 0;
  if (markMissingSold && !aborted) {
    const seen = new Set(seenSkus);
    const stale: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("products").select("sku").eq("source", "ebay").eq("status", "active").range(from, from + 999);
      for (const p of data ?? []) if (!seen.has(p.sku)) stale.push(p.sku);
      if (!data || data.length < 1000) break;
    }
    for (let i = 0; i < stale.length; i += 500) {
      const { count: n } = await db.from("products").update({ status: "sold", quantity: 0 }, { count: "exact" }).eq("source", "ebay").in("sku", stale.slice(i, i + 500));
      markedSold += n ?? 0;
    }
  }

  await db
    .from("import_jobs")
    .update({ status: aborted ? "failed" : failed ? "completed_with_errors" : "completed", created_count: created, updated_count: updated, failed_count: failed, finished_at: new Date().toISOString() })
    .eq("id", jobId);
  await revalidateCatalog(ctx.auth.session.db);
  await logEvent(ctx.auth.session.db, "import.finish", "import_jobs", jobId, `CSV import: ${created} created, ${updated} updated, ${failed} failed${markedSold ? `, ${markedSold} marked sold` : ""}`);
  revalidatePath("/admin/imports");
  return { ok: true, message: aborted ? "Import stopped" : "Import complete", data: { markedSold } };
}

// ---------------------------------------------------------------- image jobs
const ALLOWED_IMAGE_HOSTS = ["i.ebayimg.com"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function startImageJob(): Promise<ActionResult<{ jobId: string; total: number }>> {
  const ctx = await adminService();
  if (!ctx) return FORBIDDEN;
  const { count } = await ctx.db.from("product_images").select("id", { count: "exact", head: true }).is("storage_path", null).not("external_url", "is", null);
  const { data, error } = await ctx.db
    .from("image_jobs")
    .insert({ kind: "copy_external", status: count ? "running" : "completed", total: count ?? 0, created_by: ctx.auth.session.userId, started_at: new Date().toISOString(), finished_at: count ? null : new Date().toISOString() })
    .select("id")
    .single();
  if (error || !data) return dbError(error);
  revalidatePath("/admin/imports");
  return { ok: true, message: count ? `Copying ${count} photos into storage…` : "No marketplace photos waiting to be copied.", data: { jobId: data.id, total: count ?? 0 } };
}

/** Copies up to 6 external images into Storage per call; the browser calls it until done. */
export async function processImageBatch(input: { jobId: string }): Promise<ActionResult<{ remaining: number; done: number; failed: number }>> {
  const ctx = await adminService();
  if (!ctx) return FORBIDDEN;
  if (!z.uuid().safeParse(input.jobId).success) return { ok: false, message: "Invalid job." };
  const { db } = ctx;
  const { data: job } = await db.from("image_jobs").select("done, failed, errors").eq("id", input.jobId).maybeSingle();
  if (!job) return { ok: false, message: "Job not found." };
  const { data: batch } = await db.from("product_images").select("id, product_id, external_url").is("storage_path", null).not("external_url", "is", null).order("id").limit(6);

  let done = job.done;
  let failed = job.failed;
  const errors = Array.isArray(job.errors) ? [...(job.errors as unknown[])] : [];
  for (const img of batch ?? []) {
    try {
      const url = new URL(String(img.external_url));
      if (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.includes(url.hostname)) throw new Error(`host not allowed: ${url.hostname}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "error" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^image\/(jpeg|png|webp|avif)/.test(type)) throw new Error(`HTTP ${res.status} ${type}`);
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large");
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("avif") ? "avif" : "jpg";
      const path = `${img.product_id}/ext-${img.id}.${ext}`;
      const up = await db.storage.from(PRODUCT_BUCKET).upload(path, bytes, { contentType: type, upsert: true, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      await db.from("product_images").update({ storage_path: path }).eq("id", img.id);
      done++;
    } catch (e) {
      failed++;
      if (errors.length < 200) errors.push({ imageId: img.id, url: img.external_url, error: e instanceof Error ? e.message : String(e) });
      // Mark as handled so the loop moves on: keep the external URL as the image source.
      await db.from("product_images").update({ storage_path: null, external_url: img.external_url }).eq("id", img.id);
    }
  }
  const { count: remaining } = await db.from("product_images").select("id", { count: "exact", head: true }).is("storage_path", null).not("external_url", "is", null);
  const stuck = (batch ?? []).length > 0 && done === job.done; // whole batch failed: stop to avoid an endless loop
  const finished = !remaining || stuck;
  await db
    .from("image_jobs")
    .update({ done, failed, errors: errors as never, ...(finished ? { status: failed ? "completed_with_errors" : "completed", finished_at: new Date().toISOString() } : {}) })
    .eq("id", input.jobId);
  if (finished) {
    await revalidateCatalog(ctx.auth.session.db, { summary: false });
    revalidatePath("/admin/imports");
  }
  return { ok: true, message: finished ? "Image job finished" : "Working…", data: { remaining: finished ? 0 : (remaining ?? 0), done, failed } };
}
