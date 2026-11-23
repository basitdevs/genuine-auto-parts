/**
 * Business details shown across the site and in JSON-LD.
 *
 * ⚠️  Anything marked `PLACEHOLDER` must be replaced with the real values from the
 *     Google Business Profile before launch. Nothing here was invented:
 *     only the name and map coordinates come from the shared Google Maps link.
 */
export const PLACEHOLDER = "__PLACEHOLDER__";

export const isPlaceholder = (value: string | null | undefined): boolean => !value || value.startsWith(PLACEHOLDER);

export type OpeningHours = { days: string; opens: string; closes: string; schemaDays: string[] };

export const business = {
  name: "Genuine Auto & Truck Parts",
  shortName: "Genuine Auto",
  legalName: `${PLACEHOLDER} legal entity name`,
  tagline: "Genuine OEM parts. Recycler prices.",
  description:
    "Phoenix-based auto and truck dismantler selling tested, genuine OEM used parts, shipped nationwide.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  phone: `${PLACEHOLDER} phone`, // e.g. "+1 602-555-0100" — copy from Google listing
  email: `${PLACEHOLDER} email`,

  address: {
    street: `${PLACEHOLDER} street address`,
    city: "Phoenix",
    region: "AZ",
    postalCode: `${PLACEHOLDER} ZIP`,
    country: "US",
  },

  // From the shared Google Maps link (!3d / !4d parameters).
  geo: { latitude: 33.5033879, longitude: -112.1005094 },
  googleMapsUrl:
    "https://www.google.com/maps/place/Genuine+Auto+%26+Truck+Parts/@33.5033923,-112.1030843,17z/data=!4m7!3m6!1s0x872b138f5452103f:0x5f168585f48910f5!8m2!3d33.5033879!4d-112.1005094",
  googleMapsEmbedUrl: "https://www.google.com/maps?q=33.5033879,-112.1005094&z=16&output=embed",

  /** Replace with real hours from the listing. Empty array = "hours coming soon". */
  hours: [] as OpeningHours[],

  /**
   * Google star rating summary (e.g. { value: 4.9, count: 62 }). Shown in the reviews
   * section and JSON-LD once set. Review texts live in src/content/reviews.ts.
   */
  rating: null as { value: number; count: number } | null,

  /** Total reviews on the Google listing (shown even before the star rating is set). */
  googleReviewCount: 49,

  social: {
    facebook: null as string | null,
    instagram: null as string | null,
    ebayStore: null as string | null,
  },

  /**
   * ⚠️ PENDING CLIENT CONFIRMATION. Single source for every page that mentions these
   * (product pages, quality section, policy pages). Shipping rules: src/content/shipping.ts.
   */
  policies: {
    warrantyDays: 90,
    returnDays: 30,
  },
} as const;

export type Business = typeof business;
