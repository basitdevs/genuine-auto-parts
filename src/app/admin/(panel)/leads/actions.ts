"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, FORBIDDEN, type ActionResult } from "@/lib/admin/access";
import { LEAD_TABLES } from "@/lib/admin/leads";
import { dbError, invalid, logEvent } from "@/lib/admin/server";

const leadType = z.enum(["sell_car", "part", "return", "contact"]);

const updateSchema = z.object({
  type: leadType,
  id: z.coerce.number().int().positive(),
  status: z.enum(["new", "in_progress", "closed", "spam"]).optional(),
  assignedTo: z.union([z.literal(""), z.uuid()]).optional(),
  internalNotes: z.string().trim().max(5000).optional(),
});

export async function updateLead(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const auth = await authorize("leads");
  if (!auth.ok) return FORBIDDEN;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { type, id, status, assignedTo, internalNotes } = parsed.data;
  const patch: { status?: typeof status; assigned_to?: string | null; internal_notes?: string | null } = {};
  if (status) patch.status = status;
  if (assignedTo !== undefined) patch.assigned_to = assignedTo || null;
  if (internalNotes !== undefined) patch.internal_notes = internalNotes || null;
  if (!Object.keys(patch).length) return { ok: true, message: "No change" };

  const { error, count } = await auth.session.db.from(LEAD_TABLES[type]).update(patch, { count: "exact" }).eq("id", id);
  if (error) return dbError(error);
  if (!count) return { ok: false, message: "Lead not found." };
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${type}/${id}`);
  return { ok: true, message: status ? `Marked ${status === "in_progress" ? "contacted" : status}` : "Saved" };
}

/** Part request → order (source "lead"): copies the customer and the requested part. */
export async function convertLeadToOrder(input: { id: number }): Promise<ActionResult<{ orderId: string }>> {
  const auth = await authorize("orders");
  if (!auth.ok) return FORBIDDEN;
  const id = z.coerce.number().int().positive().safeParse(input.id);
  if (!id.success) return { ok: false, message: "Invalid lead." };
  const { db, userId, email: actorEmail } = auth.session;

  const { data: lead, error: leadError } = await db.from("part_requests").select("*, products(id, sku, title, price, status, quantity)").eq("id", id.data).maybeSingle();
  if (leadError || !lead) return dbError(leadError, "Lead not found.");
  if (lead.order_id) return { ok: false, message: "This lead was already converted.", };

  const product = lead.products as unknown as { id: string; sku: string; title: string; price: number; status: string; quantity: number } | null;
  const price = lead.offer_amount !== null ? Number(lead.offer_amount) : product ? Number(product.price) : 0;
  const { data: order, error } = await db
    .from("orders")
    .insert({
      email: lead.email,
      customer_name: lead.name,
      phone: lead.phone,
      status: "new",
      source: "lead",
      lead_id: lead.id,
      subtotal: product ? price : 0,
      total: product ? price : 0,
      notes: [lead.message, lead.vin ? `VIN: ${lead.vin}` : "", [lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(" ")].filter(Boolean).join("\n") || null,
      placed_at: new Date().toISOString(),
    })
    .select("id, order_number")
    .single();
  if (error || !order) return dbError(error);

  if (product) {
    await db.from("order_items").insert({ order_id: order.id, product_id: product.id, sku: product.sku, title: product.title, unit_price: price, quantity: 1 });
  }
  await db.from("order_events").insert({
    order_id: order.id,
    kind: "created",
    status: "new",
    message: `Created from part request #${lead.id}${lead.offer_amount !== null ? ` (offer $${Number(lead.offer_amount).toFixed(2)})` : ""}${product ? "" : " · add items before confirming"}`,
    actor_id: userId,
    actor_email: actorEmail,
  });
  await db.from("part_requests").update({ order_id: order.id, status: "in_progress" }).eq("id", lead.id);
  await logEvent(db, "lead.convert", "part_requests", String(lead.id), `Converted part request #${lead.id} to order ${order.order_number}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/orders");
  return { ok: true, message: `Order ${order.order_number} created`, data: { orderId: order.id } };
}
