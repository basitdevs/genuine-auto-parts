import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { clearExistsCache } from "@/lib/catalog/exists";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { SETTINGS_TAG } from "@/lib/settings/server";

/**
 * POST /api/revalidate  (header: Authorization: Bearer <REVALIDATE_SECRET>)
 * Marks every catalog and settings cache entry stale after an import, bulk edit or direct DB change. Pages refresh
 * on their next visit (stale-while-revalidate), so 6,500 product pages aren't rebuilt at once.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    Boolean(secret) &&
    provided.length === secret!.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(secret!));
  if (!ok) return Response.json({ error: "Unauthorized" }, { status: 401 });

  revalidateTag(CATALOG_TAG, "max");
  revalidateTag(SETTINGS_TAG, "max");
  clearExistsCache();
  return Response.json({ revalidated: [CATALOG_TAG, SETTINGS_TAG] });
}
