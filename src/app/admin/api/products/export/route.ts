import type { NextRequest } from "next/server";
import { authorize } from "@/lib/admin/access";
import { isMissingSchema } from "@/lib/admin/db";
import { buildProductQuery, ebayItemId, loadCatalogRefs, parseProductFilters } from "@/lib/admin/products";

const COLUMNS = ["sku", "title", "status", "condition", "price", "compare_at_price", "quantity", "oem_part_number", "interchange_numbers", "brand", "placement", "category", "ebay_item_id", "weight_lb", "is_freight", "slug", "updated_at"] as const;
const SELECT = "id, sku, title, status, condition, price, compare_at_price, quantity, oem_part_number, interchange_numbers, brand, placement, category_id, external_ids, weight_lb, is_freight, slug, updated_at";
const MAX_ROWS = 25_000;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("|") : String(v);
  // Neutralise spreadsheet formulas (CSV injection) and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV of the current /admin/products filter (staff only, never cached). */
export async function GET(request: NextRequest) {
  const auth = await authorize("products");
  if (!auth.ok) return new Response("Forbidden", { status: 403 });
  const { db } = auth.session;
  const filters = parseProductFilters(Object.fromEntries(request.nextUrl.searchParams));
  const refs = await loadCatalogRefs(db);
  const catName = new Map(refs.categories.map((c) => [c.id, c.name]));

  const rows: string[] = [COLUMNS.join(",")];
  let legacy = false;
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    let res = await buildProductQuery(db, filters, SELECT, { categories: refs.categories, legacy }).range(from, from + 999);
    if (res.error && isMissingSchema(res.error) && !legacy) {
      legacy = true;
      res = await buildProductQuery(db, filters, SELECT, { categories: refs.categories, legacy }).range(from, from + 999);
    }
    if (res.error) return new Response(`Export failed: ${res.error.message}`, { status: 500 });
    const page = (res.data ?? []) as unknown as Record<string, unknown>[];
    for (const p of page) {
      const values: Record<(typeof COLUMNS)[number], unknown> = {
        sku: p.sku, title: p.title, status: p.status, condition: p.condition, price: p.price, compare_at_price: p.compare_at_price,
        quantity: p.quantity, oem_part_number: p.oem_part_number, interchange_numbers: p.interchange_numbers, brand: p.brand,
        placement: p.placement, category: p.category_id ? catName.get(Number(p.category_id)) : "", ebay_item_id: ebayItemId(p.external_ids),
        weight_lb: p.weight_lb, is_freight: p.is_freight, slug: p.slug, updated_at: p.updated_at,
      };
      rows.push(COLUMNS.map((c) => csvCell(values[c])).join(","));
    }
    if (page.length < 1000) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${rows.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
