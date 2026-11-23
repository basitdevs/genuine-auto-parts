import type { NextRequest } from "next/server";
import { authorize } from "@/lib/admin/access";
import { partNumberKey, sanitizeSearch } from "@/lib/admin/db";

/**
 * Command palette search (staff). Products by title / SKU / OEM / part numbers / eBay item #,
 * orders by number / email / name, customers by name / email. Never cached.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("dashboard");
  if (!auth.ok) return Response.json({ hits: [] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { db } = auth.session;

  const q = sanitizeSearch(request.nextUrl.searchParams.get("q") ?? "", 60);
  if (q.length < 2) return Response.json({ hits: [] }, { headers: { "Cache-Control": "no-store" } });
  const like = `%${q}%`;
  const pn = partNumberKey(q);
  const digits = /^\d{6,}$/.test(q) ? q : null;

  const productFilter = [`title.ilike.${like}`, `sku.ilike.${like}`, `oem_part_number.ilike.${like}`];
  if (pn.length >= 3) productFilter.push(`part_numbers_search.ilike.%${pn}%`);
  if (digits) productFilter.push(`external_ids->>ebay_item_id.eq.${digits}`);

  const [products, orders, customers] = await Promise.all([
    db.from("products").select("id, title, sku, status, price").or(productFilter.join(",")).order("updated_at", { ascending: false }).limit(6),
    db.from("orders").select("id, order_number, email, customer_name, status, total").or(`order_number.ilike.${like},email.ilike.${like},customer_name.ilike.${like}`).order("created_at", { ascending: false }).limit(5),
    db.from("profiles").select("id, email, full_name, role").or(`email.ilike.${like},full_name.ilike.${like}`).limit(5),
  ]);

  const hits = [
    ...(products.data ?? []).map((p) => ({ kind: "product", id: p.id, title: p.title, subtitle: `${p.sku} · ${p.status} · $${Number(p.price).toFixed(2)}`, href: `/admin/products/${p.id}` })),
    ...(orders.data ?? []).map((o) => ({ kind: "order", id: o.id, title: `Order ${o.order_number}`, subtitle: `${o.customer_name ?? o.email} · ${o.status} · $${Number(o.total).toFixed(2)}`, href: `/admin/orders/${o.id}` })),
    ...(customers.data ?? []).map((c) => ({ kind: "customer", id: c.id, title: c.full_name || c.email || "Customer", subtitle: `${c.email ?? ""} · ${c.role}`, href: `/admin/customers/${c.id}` })),
  ];
  return Response.json({ hits }, { headers: { "Cache-Control": "no-store" } });
}
