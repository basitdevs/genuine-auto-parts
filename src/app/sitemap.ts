import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { env } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

const STATIC_ROUTES = ["", "/parts", "/vehicles", "/about", "/sell-your-car", "/returns", "/contact", "/faq",
  "/policies/shipping", "/policies/returns", "/policies/warranty", "/policies/privacy", "/policies/terms"];

const PAGE = 1000;
const MAX_URLS = 45_000; // stay under the 50k-per-sitemap limit; split with generateSitemaps beyond this

/**
 * Static pages + active products + donor vehicles. Product pages are fetched in parallel
 * with per-request timeouts; on any failure the sitemap degrades to the static routes
 * (cached for minutes) instead of failing the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheTag(CATALOG_TAG);

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${env.siteUrl}${path}`,
    changeFrequency: path === "" || path === "/parts" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));

  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return entries;
  }

  try {
    const { count, error } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw error;
    const total = Math.min(count ?? 0, MAX_URLS);

    const pages = await Promise.all(
      Array.from({ length: Math.ceil(total / PAGE) }, (_, i) =>
        db
          .from("products")
          .select("slug, updated_at")
          .eq("status", "active")
          .order("id")
          .range(i * PAGE, i * PAGE + PAGE - 1)
          .abortSignal(AbortSignal.timeout(20_000)),
      ),
    );
    const vehicles = await db
      .from("donor_vehicles")
      .select("slug, updated_at")
      .in("status", ["dismantling", "parted_out"])
      .abortSignal(AbortSignal.timeout(15_000));

    for (const page of pages) {
      if (page.error) throw page.error;
      for (const p of page.data ?? []) {
        entries.push({ url: `${env.siteUrl}/parts/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly", priority: 0.8 });
      }
    }
    for (const v of vehicles.data ?? []) {
      entries.push({ url: `${env.siteUrl}/vehicles/${v.slug}`, lastModified: v.updated_at, changeFrequency: "weekly", priority: 0.5 });
    }
    cacheLife("hours");
  } catch (error) {
    console.error(`[sitemap] product URLs skipped: ${error instanceof Error ? error.message : String(error)}`);
    cacheLife("minutes");
  }
  return entries;
}
