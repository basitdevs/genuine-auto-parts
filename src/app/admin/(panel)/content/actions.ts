"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { dbError, invalid } from "@/lib/admin/server";
import { SETTINGS, type SettingsKey } from "@/lib/settings/schema";
import { SETTINGS_TAG } from "@/lib/settings/server";
import type { Json } from "@/lib/supabase/database.types";

/** Which public pages each settings key shows up on (revalidated after a save). */
const AFFECTS: Record<SettingsKey, string[]> = {
  business: ["/", "/contact", "/about", "/faq", "/policies/[slug]"],
  policies: ["/", "/about", "/faq", "/returns", "/cart", "/policies/[slug]", "/parts/[slug]"],
  shipping: ["/cart", "/faq", "/policies/[slug]", "/parts/[slug]"],
  home: ["/"],
  reviews: ["/"],
  faq: ["/faq"],
  policy_pages: ["/policies/[slug]"],
  notifications: [],
  flags: ["/", "/cart", "/parts", "/parts/[slug]"],
};
const CONTENT_KEYS: SettingsKey[] = ["business", "policies", "shipping", "home", "reviews", "faq", "policy_pages"];

/**
 * Saves one settings key. Content keys need the Content area, notifications/flags the
 * Settings area (both admin-only). Validated with the same Zod schema the site reads with.
 */
export async function saveSetting(key: SettingsKey, value: unknown): Promise<ActionResult> {
  if (!(key in SETTINGS)) return { ok: false, message: "Unknown setting." };
  const auth = await authorize(CONTENT_KEYS.includes(key) ? "content" : "settings");
  if (!auth.ok) return FORBIDDEN;
  const parsed = SETTINGS[key].schema.safeParse(value);
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await auth.session.db
    .from("site_settings")
    .upsert({ key, value: parsed.data as Json, updated_by: auth.session.userId }, { onConflict: "key" });
  if (error) return dbError(error);

  revalidateTag(SETTINGS_TAG, "max");
  for (const path of AFFECTS[key]) revalidatePath(path, path.includes("[") ? "page" : undefined);
  revalidatePath("/admin/content");
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved. The site shows the change right away." };
}

/** Restores the built-in default for a key (deletes the stored row). */
export async function resetSetting(key: SettingsKey): Promise<ActionResult> {
  if (!(key in SETTINGS)) return { ok: false, message: "Unknown setting." };
  const auth = await authorize(CONTENT_KEYS.includes(key) ? "content" : "settings");
  if (!auth.ok) return FORBIDDEN;
  const { error } = await auth.session.db.from("site_settings").delete().eq("key", key);
  if (error) return dbError(error);
  revalidateTag(SETTINGS_TAG, "max");
  for (const path of AFFECTS[key]) revalidatePath(path, path.includes("[") ? "page" : undefined);
  revalidatePath("/admin/content");
  revalidatePath("/admin/settings");
  return { ok: true, message: "Reset to the built-in default" };
}
