import { z } from "zod";
import { groupForEbayCategory } from "./category-groups";
import { parseTitle, type ParsedTitle } from "./title-parser";

/**
 * Single source of truth for eBay CSV -> products mapping.
 *
 * Two eBay export formats are supported:
 *  - "Active listings report" (Seller Hub > Reports > All active listings). This is the file
 *    in the repo (`eBay-all-active-listings-report-*.csv`): 30 columns, no pictures,
 *    no item specifics, no compatibility. Fitment + part numbers are parsed from the title.
 *  - "File Exchange / Seller Hub listing template" exports (Action, ItemID, PicURL,
 *    C:Brand, C:Manufacturer Part Number, Compatibility ...). Richer; preferred for images.
 */
export type EbayFormat = "ebay_active_listings" | "ebay_file_exchange";

/** Column names exactly as they appear in each export. */
export const EBAY_COLUMNS = {
  ebay_active_listings: {
    itemId: "Item number",
    title: "Title",
    sku: "Custom label (SKU)",
    quantity: "Available quantity",
    format: "Format",
    currency: "Currency",
    price: "Current price",
    startPrice: "Start price",
    soldQuantity: "Sold quantity",
    startDate: "Start date",
    categoryName: "eBay category 1 name",
    categoryId: "eBay category 1 number",
    condition: "Condition",
    epid: "eBay Product ID(ePID)",
    upc: "P:UPC",
    ean: "P:EAN",
  },
  ebay_file_exchange: {
    itemId: "ItemID",
    title: "Title",
    sku: "CustomLabel",
    quantity: "Quantity",
    format: "Format",
    currency: "Currency",
    price: "StartPrice",
    startPrice: "StartPrice",
    soldQuantity: "QuantitySold",
    startDate: "StartTime",
    categoryName: "CategoryName",
    categoryId: "Category",
    condition: "ConditionID",
    description: "Description",
    pictures: "PicURL", // pipe-separated URLs
    brand: "C:Brand",
    mpn: "C:Manufacturer Part Number",
    interchange: "C:Interchange Part Number",
    oem: "C:OE/OEM Part Number",
    placement: "C:Placement on Vehicle",
    compatibility: "Compatibility", // "Year=2012|Make=BMW|Model=328i|Trim=...|Engine=..." rows separated by "||" or newlines
    weightMajor: "WeightMajor",
    weightMinor: "WeightMinor",
    length: "PackageLength",
    width: "PackageWidth",
    depth: "PackageDepth",
  },
} as const;

/** Columns ignored on import (trading-card fields, auction-only fields, analytics). */
export const IGNORED_ACTIVE_LISTING_COLUMNS = [
  "Variation details", "Auction Buy It Now price", "Reserve price", "Watchers", "Bids", "End date",
  "eBay category 2 name", "eBay category 2 number", "CD:Professional Grader - (ID: 27501)",
  "CD:Grade - (ID: 27502)", "CDA:Certification Number - (ID: 27503)", "CD:Card Condition - (ID: 40001)",
  "Listing site", "P:ISBN",
];

export function detectEbayFormat(headers: string[]): EbayFormat | null {
  const set = new Set(headers.map((h) => h.replace(/^﻿/, "").trim()));
  if (set.has("Item number") && set.has("Custom label (SKU)")) return "ebay_active_listings";
  if (set.has("ItemID") || set.has("*Action") || set.has("Action")) return "ebay_file_exchange";
  return null;
}

/** eBay condition label / ConditionID -> our enum. */
export const CONDITION_MAP: Record<string, "new" | "used" | "remanufactured" | "for_parts"> = {
  new: "new",
  "new other (see details)": "new",
  "open box": "new",
  used: "used",
  "pre-owned": "used",
  remanufactured: "remanufactured",
  "seller refurbished": "remanufactured",
  "for parts or not working": "for_parts",
  "1000": "new",
  "1500": "new",
  "2500": "remanufactured",
  "3000": "used",
  "7000": "for_parts",
};

const money = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[$,\s]/g, "") : v),
  z.coerce.number().nonnegative().max(1_000_000),
);

/** Validates one row of the Active listings report. */
export const activeListingRowSchema = z.object({
  "Item number": z.string().regex(/^\d{9,15}$/, "Item number must be numeric"),
  Title: z.string().trim().min(3).max(200),
  "Custom label (SKU)": z.string().trim().max(80).optional().default(""),
  "Available quantity": z.coerce.number().int().min(0),
  Currency: z.string().trim().length(3).default("USD"),
  "Current price": money,
  "Start date": z.string().optional().default(""),
  "eBay category 1 name": z.string().trim().min(1),
  "eBay category 1 number": z.coerce.number().int().positive(),
  Condition: z.string().trim().min(1),
});

export type ActiveListingRow = z.infer<typeof activeListingRowSchema>;

/** Normalized product payload written by the importer (and produced by future CSV formats). */
export type ProductImport = {
  sku: string;
  slug: string;
  title: string;
  condition: "new" | "used" | "remanufactured" | "for_parts";
  price: number;
  currency: string;
  quantity: number;
  status: "active" | "sold";
  oemPartNumber: string | null;
  interchangeNumbers: string[];
  placement: string | null;
  category: { groupSlug: string; name: string; ebayCategoryId: number };
  fitment: ParsedTitle;
  externalIds: Record<string, string | number>;
  listedAt: string | null;
  imageUrls: string[];
};

export function slugify(input: string, maxLength = 80): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** "Jul-18-25 00:12:28 PDT" -> ISO string. */
export function parseEbayDate(value: string): string | null {
  const match = /^([A-Za-z]{3})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) (PDT|PST)$/.exec(value.trim());
  if (!match) return null;
  const [, mon, day, yy, hh, mm, ss, tz] = match;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(mon);
  if (month < 0) return null;
  const offset = tz === "PDT" ? 7 : 8;
  const date = new Date(Date.UTC(2000 + Number(yy), month, Number(day), Number(hh) + offset, Number(mm), Number(ss)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function mapActiveListingRow(row: ActiveListingRow): ProductImport {
  const itemId = row["Item number"];
  // SKU is a GUID in this account; fall back to the eBay item number when missing.
  const sku = row["Custom label (SKU)"] || `EBAY-${itemId}`;
  const fitment = parseTitle(row.Title);
  const [oem, ...interchange] = fitment.partNumbers;
  const categoryName = row["eBay category 1 name"];
  const categoryId = row["eBay category 1 number"];
  const group = groupForEbayCategory(categoryName, categoryId);
  const condition = CONDITION_MAP[row.Condition.toLowerCase()] ?? "used";
  if (!CONDITION_MAP[row.Condition.toLowerCase()]) fitment.warnings.push(`Unknown condition "${row.Condition}", defaulted to used`);

  return {
    sku,
    slug: `${slugify(row.Title)}-${sku.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase()}`,
    title: row.Title.replace(/\s{2,}/g, " ").trim(),
    condition,
    price: row["Current price"],
    currency: row.Currency,
    quantity: row["Available quantity"],
    status: row["Available quantity"] > 0 ? "active" : "sold",
    oemPartNumber: oem ?? null,
    interchangeNumbers: interchange,
    placement: fitment.placement,
    category: { groupSlug: group.slug, name: categoryName, ebayCategoryId: categoryId },
    fitment,
    externalIds: { ebay_item_id: itemId, ebay_category_id: categoryId },
    listedAt: parseEbayDate(row["Start date"]),
    imageUrls: [],
  };
}
