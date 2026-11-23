import "server-only";
import { isMissingSchema } from "@/lib/admin/db";
import type { StaffSession } from "@/lib/auth/staff";
import { parseSetting, SETTINGS, type SettingsKey, type SettingsValues } from "./schema";

/** Fresh (uncached) settings for the admin editors, with which keys are customised. */
export async function loadSettingsForAdmin(db: StaffSession["db"]) {
  const { data, error } = await db.from("site_settings").select("key, value, updated_at");
  const stored = new Map((data ?? []).map((r) => [r.key, r]));
  const values = Object.fromEntries(
    (Object.keys(SETTINGS) as SettingsKey[]).map((k) => [k, stored.has(k) ? parseSetting(k, stored.get(k)!.value) : SETTINGS[k].defaults]),
  ) as SettingsValues;
  const updated = Object.fromEntries([...stored].map(([k, r]) => [k, r.updated_at])) as Partial<Record<SettingsKey, string>>;
  return { values, updated, missing: isMissingSchema(error), error: error && !isMissingSchema(error) ? error.message : null };
}
