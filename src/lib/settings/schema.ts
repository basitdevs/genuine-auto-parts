import { z } from "zod";
import { business as businessFile, PLACEHOLDER } from "@/content/business";
import { reviews as reviewsFile } from "@/content/reviews";
import { shippingConfig as shippingFile } from "@/content/shipping";

/**
 * Editable site settings (public.site_settings, one row per key). The file values in
 * src/content/*.ts are the defaults: a missing row, missing table or invalid value always
 * falls back to them, so the storefront can never break because of settings.
 * Client-safe (no server imports): the admin forms validate with the same schemas.
 */
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().default("");
const url = z.union([z.literal(""), z.url().max(500)]).optional().default("");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 08:00");

const SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

// --------------------------------------------------------------------------- business
export const hoursSchema = z.object({
  days: text(40).min(1, "Enter the days, e.g. Mon–Fri"),
  opens: time,
  closes: time,
  schemaDays: z.array(z.enum(SCHEMA_DAYS)).min(1, "Pick at least one day"),
});

export const businessSettingsSchema = z.object({
  name: text(80).min(2),
  legalName: optionalText(120),
  tagline: optionalText(120),
  description: text(400).min(10),
  phone: optionalText(40),
  email: z.union([z.literal(""), z.email().max(200)]).optional().default(""),
  street: optionalText(160),
  city: text(80).min(1),
  region: text(40).min(1),
  postalCode: optionalText(12),
  hours: z.array(hoursSchema).max(10).default([]),
  googleMapsUrl: url,
  ratingValue: z.number().min(1).max(5).nullable().default(null),
  googleReviewCount: z.number().int().min(0).max(100_000).default(0),
  facebook: url,
  instagram: url,
  ebayStore: url,
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

const real = (v: string) => (v.startsWith(PLACEHOLDER) ? "" : v);
export const BUSINESS_DEFAULTS: BusinessSettings = {
  name: businessFile.name,
  legalName: real(businessFile.legalName),
  tagline: businessFile.tagline,
  description: businessFile.description,
  phone: real(businessFile.phone),
  email: real(businessFile.email),
  street: real(businessFile.address.street),
  city: businessFile.address.city,
  region: businessFile.address.region,
  postalCode: real(businessFile.address.postalCode),
  hours: businessFile.hours.map((h) => ({ ...h, schemaDays: h.schemaDays as (typeof SCHEMA_DAYS)[number][] })),
  googleMapsUrl: businessFile.googleMapsUrl,
  ratingValue: businessFile.rating?.value ?? null,
  googleReviewCount: businessFile.googleReviewCount,
  facebook: businessFile.social.facebook ?? "",
  instagram: businessFile.social.instagram ?? "",
  ebayStore: businessFile.social.ebayStore ?? "",
};

// --------------------------------------------------------------------------- policies
export const policySettingsSchema = z.object({
  warrantyDays: z.number().int().min(0).max(3650),
  returnDays: z.number().int().min(0).max(365),
});
export type PolicySettings = z.infer<typeof policySettingsSchema>;
export const POLICY_DEFAULTS: PolicySettings = { ...businessFile.policies };

// --------------------------------------------------------------------------- shipping
const tierSchema = z.object({ maxLb: z.number().positive().max(10_000), rate: z.number().min(0).max(10_000) });
const baseStrategy = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("flat"), rate: z.number().min(0).max(10_000) }),
  z.object({
    kind: z.literal("weight"),
    tiers: z.array(tierSchema).min(1).max(12),
    overMaxRate: z.number().min(0).max(10_000),
    defaultWeightLb: z.number().positive().max(1000),
  }),
]);
export const shippingSettingsSchema = z.object({
  confirmed: z.boolean(),
  handlingTime: text(60).min(1),
  freightMessage: text(300).min(1),
  freeOverThreshold: z.number().min(0).max(100_000).nullable(),
  strategy: baseStrategy,
});
export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;
export const SHIPPING_DEFAULTS: ShippingSettings = {
  confirmed: shippingFile.confirmed,
  handlingTime: shippingFile.handlingTime,
  freightMessage: shippingFile.freightMessage,
  freeOverThreshold: shippingFile.strategy.kind === "free_over_threshold" ? shippingFile.strategy.threshold : null,
  strategy: shippingFile.strategy.kind === "free_over_threshold" ? shippingFile.strategy.below : shippingFile.strategy,
};

// --------------------------------------------------------------------------- home
export const homeSettingsSchema = z.object({
  heroEyebrow: text(80).min(1),
  heroTitle: text(60).min(1),
  heroAccent: text(60).min(1),
  heroText: optionalText(300),
  stats: z
    .array(z.object({ value: text(24).min(1), label: text(40).min(1) }))
    .length(4),
  sections: z.object({
    makes: z.boolean(),
    categories: z.boolean(),
    newest: z.boolean(),
    vehicles: z.boolean(),
    sellCar: z.boolean(),
    quality: z.boolean(),
    reviews: z.boolean(),
    newsletter: z.boolean(),
  }),
});
export type HomeSettings = z.infer<typeof homeSettingsSchema>;
/** "{parts}" and "{makes}" in stat values are replaced with live catalog numbers. */
export const HOME_DEFAULTS: HomeSettings = {
  heroEyebrow: "Phoenix dismantler · Shipping nationwide",
  heroTitle: "Genuine OEM parts.",
  heroAccent: "Recycler prices.",
  heroText: "",
  stats: [
    { value: "{parts}", label: "OEM parts in stock" },
    { value: "{makes}", label: "Makes covered" },
    { value: "Nationwide", label: "Fast shipping" },
    { value: "Tested", label: "Inspected & guaranteed" },
  ],
  sections: { makes: true, categories: true, newest: true, vehicles: true, sellCar: true, quality: true, reviews: true, newsletter: true },
};

// --------------------------------------------------------------------------- reviews
export const reviewSchema = z.object({
  author: text(60).min(1),
  text: text(1200).min(2),
  date: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
  localGuide: z.boolean().optional().default(false),
  translatedFrom: optionalText(30),
  ownerReply: optionalText(1200),
  featured: z.boolean().optional().default(false),
});
export const reviewsSettingsSchema = z.object({ items: z.array(reviewSchema).max(200) });
export type ReviewsSettings = z.infer<typeof reviewsSettingsSchema>;
export const REVIEWS_DEFAULTS: ReviewsSettings = {
  items: reviewsFile.map((r) => ({
    author: r.author,
    text: r.text,
    date: r.date,
    localGuide: Boolean(r.localGuide),
    translatedFrom: r.translatedFrom ?? "",
    ownerReply: r.ownerReply ?? "",
    featured: Boolean(r.featured),
  })),
};

// --------------------------------------------------------------------------- FAQ
export const faqSettingsSchema = z.object({
  groups: z
    .array(
      z.object({
        group: text(60).min(1),
        items: z.array(z.object({ q: text(200).min(3), a: text(2000).min(3) })).max(30),
      }),
    )
    .max(12),
});
export type FaqSettings = z.infer<typeof faqSettingsSchema>;
/** Empty = the built-in FAQ (written in code with live policy numbers). */
export const FAQ_DEFAULTS: FaqSettings = { groups: [] };

// --------------------------------------------------------------------------- policy pages
export const POLICY_PAGE_SLUGS = ["shipping", "returns", "warranty", "privacy", "terms"] as const;
export type PolicyPageSlug = (typeof POLICY_PAGE_SLUGS)[number];
export const policyPageSchema = z.object({
  title: text(80).min(2),
  description: text(240).min(2),
  body: text(30_000).min(20),
});
export const policyPagesSettingsSchema = z.object({
  pages: z.partialRecord(z.enum(POLICY_PAGE_SLUGS), policyPageSchema),
  updated: optionalText(40),
});
export type PolicyPagesSettings = z.infer<typeof policyPagesSettingsSchema>;
/** Empty = the built-in policy copy. Saved pages override it per slug. */
export const POLICY_PAGES_DEFAULTS: PolicyPagesSettings = { pages: {}, updated: "November 2026" };

// --------------------------------------------------------------------------- notifications (private)
const emailList = z.array(z.email().max(200)).max(10);
export const notificationSettingsSchema = z.object({ leadEmails: emailList, orderEmails: emailList });
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export const NOTIFICATION_DEFAULTS: NotificationSettings = { leadEmails: [], orderEmails: [] };

// --------------------------------------------------------------------------- feature flags
export const flagSettingsSchema = z.object({
  checkoutEnabled: z.boolean(),
  showPrices: z.boolean(),
  maintenanceBanner: z.object({ enabled: z.boolean(), message: optionalText(240), tone: z.enum(["info", "warning"]).default("info") }),
});
export type FlagSettings = z.infer<typeof flagSettingsSchema>;
export const FLAG_DEFAULTS: FlagSettings = {
  checkoutEnabled: true,
  showPrices: true,
  maintenanceBanner: { enabled: false, message: "", tone: "info" },
};

// --------------------------------------------------------------------------- registry
export const SETTINGS = {
  business: { schema: businessSettingsSchema, defaults: BUSINESS_DEFAULTS },
  policies: { schema: policySettingsSchema, defaults: POLICY_DEFAULTS },
  shipping: { schema: shippingSettingsSchema, defaults: SHIPPING_DEFAULTS },
  home: { schema: homeSettingsSchema, defaults: HOME_DEFAULTS },
  reviews: { schema: reviewsSettingsSchema, defaults: REVIEWS_DEFAULTS },
  faq: { schema: faqSettingsSchema, defaults: FAQ_DEFAULTS },
  policy_pages: { schema: policyPagesSettingsSchema, defaults: POLICY_PAGES_DEFAULTS },
  notifications: { schema: notificationSettingsSchema, defaults: NOTIFICATION_DEFAULTS },
  flags: { schema: flagSettingsSchema, defaults: FLAG_DEFAULTS },
} as const;

export type SettingsKey = keyof typeof SETTINGS;
export type SettingsValues = { [K in SettingsKey]: z.infer<(typeof SETTINGS)[K]["schema"]> };
export const PUBLIC_SETTINGS_KEYS = (Object.keys(SETTINGS) as SettingsKey[]).filter((k) => k !== "notifications");

/** Validates a stored value; anything invalid falls back to the default for that key. */
export function parseSetting<K extends SettingsKey>(key: K, value: unknown): SettingsValues[K] {
  const parsed = SETTINGS[key].schema.safeParse(value);
  return (parsed.success ? parsed.data : SETTINGS[key].defaults) as SettingsValues[K];
}
