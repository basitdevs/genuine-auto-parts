import { z } from "zod";

/**
 * URL contract for /parts. Every filter lives in the query string, so results are
 * shareable, bookmarkable and survive back/forward navigation.
 *   /parts?year=2015&make=bmw&model=3-series&category=lighting&pn=63117338701&condition=used&min=50&max=400&stock=1&sort=price_asc&page=2
 */
export const SORT_OPTIONS = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest arrivals" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const CONDITION_OPTIONS = [
  { value: "used", label: "Used – OEM" },
  { value: "new", label: "New" },
  { value: "remanufactured", label: "Remanufactured" },
  { value: "for_parts", label: "For parts / repair" },
] as const;

export type ConditionValue = (typeof CONDITION_OPTIONS)[number]["value"];

export const PAGE_SIZE = 24;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,80}$/)
  .optional()
  .catch(undefined);

const positiveNumber = z.coerce.number().nonnegative().max(1_000_000).optional().catch(undefined);

export const searchParamsSchema = z.object({
  q: optionalText(120).catch(undefined),
  year: z.coerce.number().int().min(1950).max(2100).optional().catch(undefined),
  make: slug,
  model: slug,
  category: slug,
  pn: optionalText(60).catch(undefined),
  condition: z.enum(["used", "new", "remanufactured", "for_parts"]).optional().catch(undefined),
  min: positiveNumber,
  max: positiveNumber,
  stock: z
    .enum(["1", "0"])
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
  vehicle: z.string().trim().regex(/^[A-Za-z0-9-]{1,20}$/).optional().catch(undefined),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export type PartsSearch = z.infer<typeof searchParamsSchema>;

type RawParams = Record<string, string | string[] | undefined>;

export function parsePartsSearch(raw: RawParams): PartsSearch {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return searchParamsSchema.parse(flat);
}

/** Effective sort: relevance only makes sense with a text query. */
export function effectiveSort(search: PartsSearch): SortValue {
  return search.sort ?? (search.q || search.pn ? "relevance" : "newest");
}

/** Builds a /parts URL. `null` removes a key; page resets unless explicitly set. */
export function partsHref(current: Partial<PartsSearch>, changes: Partial<Record<keyof PartsSearch, string | number | boolean | null>> = {}) {
  const merged: Record<string, string | number | boolean | undefined | null> = { ...current, ...changes };
  if (!("page" in changes)) merged.page = undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (key === "stock") {
      params.set("stock", "1");
      continue;
    }
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `/parts?${qs}` : "/parts";
}

export function hasActiveFilters(search: PartsSearch): boolean {
  return Boolean(
    search.q || search.year || search.make || search.model || search.category || search.pn ||
      search.condition || search.min !== undefined || search.max !== undefined || search.stock || search.vehicle,
  );
}
