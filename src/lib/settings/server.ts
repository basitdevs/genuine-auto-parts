import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { business as businessFile, type OpeningHours } from "@/content/business";
import type { ShippingConfig } from "@/content/shipping";
import { createServiceClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { parseSetting, PUBLIC_SETTINGS_KEYS, SETTINGS, type SettingsValues } from "./schema";

export const SETTINGS_TAG = "settings";

type PublicSettings = Omit<SettingsValues, "notifications">;

function defaults(): PublicSettings {
  return Object.fromEntries(PUBLIC_SETTINGS_KEYS.map((k) => [k, SETTINGS[k].defaults])) as PublicSettings;
}

/**
 * All public settings, merged over the file defaults. Cached (tag "settings");
 * admin saves call revalidateTag("settings"). A missing table (migration 0600 not yet
 * applied) or a network error returns the defaults and retries within minutes.
 */
export async function getSiteSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  const db = createPublicClient();
  if (!db) {
    cacheLife("hours");
    return defaults();
  }
  const { data, error } = await db.from("site_settings").select("key, value");
  if (error) {
    cacheLife("minutes");
    return defaults();
  }
  cacheLife("hours");
  const stored = new Map((data ?? []).map((r) => [r.key, r.value]));
  return Object.fromEntries(
    PUBLIC_SETTINGS_KEYS.map((k) => [k, stored.has(k) ? parseSetting(k, stored.get(k)) : SETTINGS[k].defaults]),
  ) as PublicSettings;
}

export async function getSetting<K extends keyof PublicSettings>(key: K): Promise<PublicSettings[K]> {
  return (await getSiteSettings())[key];
}

export type SiteBusiness = {
  name: string;
  shortName: string;
  legalName: string;
  tagline: string;
  description: string;
  url: string;
  phone: string;
  email: string;
  address: { street: string; city: string; region: string; postalCode: string; country: string };
  geo: { latitude: number; longitude: number };
  googleMapsUrl: string;
  googleMapsEmbedUrl: string;
  hours: OpeningHours[];
  rating: { value: number; count: number } | null;
  googleReviewCount: number;
  social: { facebook: string | null; instagram: string | null; ebayStore: string | null };
  policies: { warrantyDays: number; returnDays: number };
};

/** Business details in the shape the storefront has always used (empty string = not set). */
export async function getBusiness(): Promise<SiteBusiness> {
  const { business: b, policies } = await getSiteSettings();
  return {
    name: b.name,
    shortName: businessFile.shortName,
    legalName: b.legalName,
    tagline: b.tagline,
    description: b.description,
    url: businessFile.url,
    phone: b.phone,
    email: b.email,
    address: { street: b.street, city: b.city, region: b.region, postalCode: b.postalCode, country: businessFile.address.country },
    geo: businessFile.geo,
    googleMapsUrl: b.googleMapsUrl || businessFile.googleMapsUrl,
    googleMapsEmbedUrl: businessFile.googleMapsEmbedUrl,
    hours: b.hours,
    rating: b.ratingValue ? { value: b.ratingValue, count: b.googleReviewCount } : null,
    googleReviewCount: b.googleReviewCount,
    social: { facebook: b.facebook || null, instagram: b.instagram || null, ebayStore: b.ebayStore || null },
    policies,
  };
}

/** Shipping rules in the shape quoteShipping() expects. */
export async function getShippingConfig(): Promise<ShippingConfig> {
  const s = await getSetting("shipping");
  return {
    confirmed: s.confirmed,
    handlingTime: s.handlingTime,
    freightMessage: s.freightMessage,
    strategy: s.freeOverThreshold !== null ? { kind: "free_over_threshold", threshold: s.freeOverThreshold, below: s.strategy } : s.strategy,
  };
}

export async function getFlags() {
  return getSetting("flags");
}

/** Private: who gets lead / order emails. Service role (the table hides this key from the public). */
export async function getNotificationSettings(): Promise<SettingsValues["notifications"]> {
  const db = createServiceClient();
  if (!db) return SETTINGS.notifications.defaults;
  const { data } = await db.from("site_settings").select("value").eq("key", "notifications").maybeSingle();
  return data ? parseSetting("notifications", data.value) : SETTINGS.notifications.defaults;
}
