"use server";

import { z } from "zod";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { dbError, invalid, logEvent, revalidateAdmin, revalidateCatalog } from "@/lib/admin/server";
import type { StaffSession } from "@/lib/auth/staff";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/supabase/database.types";

const STOCK_HELD: OrderStatus[] = ["paid", "shipped", "completed"];
const id = z.uuid();

async function addEvent(session: StaffSession, orderId: string, kind: "status" | "note" | "tracking", message: string, status?: string) {
  await session.db.from("order_events").insert({ order_id: orderId, kind, status: status ?? null, message, actor_id: session.userId, actor_email: session.email });
}

/**
 * Moves stock when an order crosses the "paid" line: into paid/shipped/completed takes the
 * units out of inventory (one-of-a-kind parts become sold); back out returns them.
 */
async function adjustStock(session: StaffSession, orderId: string, direction: "commit" | "release") {
  const { data: items } = await session.db.from("order_items").select("product_id, quantity, sku").eq("order_id", orderId);
  const lines = (items ?? []).filter((i): i is typeof i & { product_id: string } => Boolean(i.product_id));
  if (!lines.length) return [];
  const { data: products } = await session.db.from("products").select("id, slug, quantity, status").in("id", lines.map((l) => l.product_id));
  const touched: string[] = [];
  for (const line of lines) {
    const p = products?.find((x) => x.id === line.product_id);
    if (!p) continue;
    const quantity = direction === "commit" ? Math.max(0, p.quantity - line.quantity) : p.quantity + line.quantity;
    const status = direction === "commit" ? (quantity === 0 ? "sold" : p.status) : p.status === "sold" && quantity > 0 ? "active" : p.status;
    const { error } = await session.db.from("products").update({ quantity, status }).eq("id", p.id);
    if (!error) touched.push(p.slug);
  }
  return touched;
}

const statusSchema = z.object({ orderId: id, status: z.enum(ORDER_STATUSES), note: z.string().trim().max(1000).optional() });

export async function updateOrderStatus(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const auth = await authorize("orders");
  if (!auth.ok) return FORBIDDEN;
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { orderId, status, note } = parsed.data;
  const { session } = auth;

  const { data: order, error: readError } = await session.db.from("orders").select("status, shipped_at").eq("id", orderId).is("deleted_at", null).maybeSingle();
  if (readError || !order) return dbError(readError, "Order not found.");
  if (order.status === status) return { ok: true, message: "No change" };

  const patch: { status: OrderStatus; shipped_at?: string } = { status };
  if (status === "shipped" && !order.shipped_at) patch.shipped_at = new Date().toISOString();
  const { error } = await session.db.from("orders").update(patch).eq("id", orderId);
  if (error) return dbError(error);

  const wasHeld = STOCK_HELD.includes(order.status as OrderStatus);
  const nowHeld = STOCK_HELD.includes(status);
  let stockNote = "";
  if (wasHeld !== nowHeld) {
    const slugs = await adjustStock(session, orderId, nowHeld ? "commit" : "release");
    if (slugs.length) {
      stockNote = nowHeld ? ` · ${slugs.length} item(s) removed from stock` : ` · ${slugs.length} item(s) returned to stock`;
      await revalidateCatalog(session.db, { productSlugs: slugs });
    }
  }
  await addEvent(session, orderId, "status", `Status: ${order.status} → ${status}${stockNote}${note ? ` · ${note}` : ""}`, status);
  revalidateAdmin("/admin/orders", `/admin/orders/${orderId}`, "/admin");
  return { ok: true, message: `Marked ${status}${stockNote}` };
}

const trackingSchema = z.object({
  orderId: id,
  carrier: z.string().trim().max(40),
  trackingNumber: z.string().trim().max(80),
  markShipped: z.boolean().default(false),
});

export async function saveTracking(input: z.input<typeof trackingSchema>): Promise<ActionResult> {
  const auth = await authorize("orders");
  if (!auth.ok) return FORBIDDEN;
  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { orderId, carrier, trackingNumber, markShipped } = parsed.data;
  const { error } = await auth.session.db
    .from("orders")
    .update({ carrier: carrier || null, tracking_number: trackingNumber || null })
    .eq("id", orderId);
  if (error) return dbError(error);
  await addEvent(auth.session, orderId, "tracking", trackingNumber ? `Tracking: ${carrier || "carrier"} ${trackingNumber}` : "Tracking removed");
  if (markShipped) return updateOrderStatus({ orderId, status: "shipped" });
  revalidateAdmin(`/admin/orders/${orderId}`);
  return { ok: true, message: "Tracking saved" };
}

const noteSchema = z.object({ orderId: id, note: z.string().trim().min(1, "Write a note first.").max(2000) });

export async function addOrderNote(input: z.input<typeof noteSchema>): Promise<ActionResult> {
  const auth = await authorize("orders");
  if (!auth.ok) return FORBIDDEN;
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await addEvent(auth.session, parsed.data.orderId, "note", parsed.data.note);
  revalidateAdmin(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Note added" };
}

const detailsSchema = z.object({
  orderId: id,
  customerName: z.string().trim().max(120),
  email: z.email("Enter a valid email.").max(254),
  phone: z.string().trim().max(40),
  line1: z.string().trim().max(160),
  line2: z.string().trim().max(160),
  city: z.string().trim().max(80),
  region: z.string().trim().max(40),
  postalCode: z.string().trim().max(12),
  shippingTotal: z.coerce.number().min(0).max(100_000),
  taxTotal: z.coerce.number().min(0).max(100_000),
  staffNotes: z.string().trim().max(4000),
});

export async function updateOrderDetails(input: z.input<typeof detailsSchema>): Promise<ActionResult> {
  const auth = await authorize("orders");
  if (!auth.ok) return FORBIDDEN;
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const { data: order } = await auth.session.db.from("orders").select("subtotal, discount_total").eq("id", d.orderId).maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };
  const address = [d.line1, d.line2, d.city, d.region, d.postalCode].some(Boolean)
    ? { line1: d.line1, line2: d.line2, city: d.city, region: d.region, postal_code: d.postalCode, country: "US", name: d.customerName }
    : null;
  const total = Math.round((Number(order.subtotal) + d.shippingTotal + d.taxTotal - Number(order.discount_total)) * 100) / 100;
  const { error } = await auth.session.db
    .from("orders")
    .update({
      customer_name: d.customerName || null,
      email: d.email.toLowerCase(),
      phone: d.phone || null,
      shipping_address: address,
      shipping_total: d.shippingTotal,
      tax_total: d.taxTotal,
      total,
      staff_notes: d.staffNotes || null,
    })
    .eq("id", d.orderId);
  if (error) return dbError(error);
  revalidateAdmin(`/admin/orders/${d.orderId}`, "/admin/orders");
  return { ok: true, message: "Order details saved" };
}

export async function deleteOrder(orderId: string): Promise<ActionResult> {
  const auth = await authorize("settings"); // admin only
  if (!auth.ok) return FORBIDDEN;
  if (!id.safeParse(orderId).success) return { ok: false, message: "Invalid order." };
  const { data: order } = await auth.session.db.from("orders").select("status, order_number").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };
  if (STOCK_HELD.includes(order.status as OrderStatus)) {
    return { ok: false, message: "Cancel or refund this order first so its stock is returned." };
  }
  const { error } = await auth.session.db.from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", orderId);
  if (error) return dbError(error);
  await logEvent(auth.session.db, "order.delete", "orders", orderId, `Deleted order ${order.order_number}`);
  revalidateAdmin("/admin/orders", "/admin");
  return { ok: true, message: `Order ${order.order_number} deleted` };
}
