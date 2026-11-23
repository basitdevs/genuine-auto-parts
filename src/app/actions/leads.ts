"use server";

import { GENERIC_ERROR, handleLead } from "@/lib/forms/lead-pipeline";
import {
  RETURN_REASONS,
  contactSchema,
  returnSchema,
  sellCarSchema,
  toNumberOrNull,
  toTextOrNull,
  type LeadActionState,
} from "@/lib/forms/schemas";
import { createPublicClient } from "@/lib/supabase/public";

export async function submitSellCar(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const db = createPublicClient();
  if (!db) return { status: "error", message: GENERIC_ERROR };
  return handleLead(
    "sell-car",
    sellCarSchema,
    formData,
    async (d) => {
      const { error } = await db.from("sell_car_requests").insert({
        name: d.name,
        email: d.email,
        phone: toTextOrNull(d.phone),
        vehicle_year: toNumberOrNull(d.vehicleYear),
        vehicle_make: d.vehicleMake,
        vehicle_model: d.vehicleModel,
        vin: toTextOrNull(d.vin),
        mileage: toNumberOrNull(d.mileage.replace(/,/g, "")),
        pickup_location: d.pickupLocation,
        asking_price: toNumberOrNull(d.askingPrice),
        notes: toTextOrNull(d.notes),
      });
      return {
        error,
        email: {
          kind: "sell_car",
          name: d.name,
          email: d.email,
          phone: d.phone,
          fields: [
            ["Vehicle", `${d.vehicleYear} ${d.vehicleMake} ${d.vehicleModel}`],
            ["VIN", d.vin],
            ["Mileage", d.mileage],
            ["Pickup location", d.pickupLocation],
            ["Asking price", d.askingPrice ? `$${d.askingPrice}` : ""],
          ],
          message: d.notes,
        },
      };
    },
    "Thanks! We've received your vehicle details and will get back to you with an offer, usually within one business day.",
  );
}

export async function submitReturn(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const db = createPublicClient();
  if (!db) return { status: "error", message: GENERIC_ERROR };
  return handleLead(
    "return",
    returnSchema,
    formData,
    async (d) => {
      const { error } = await db.from("return_requests").insert({
        name: d.name,
        email: d.email,
        phone: toTextOrNull(d.phone),
        order_number: toTextOrNull(d.orderNumber),
        invoice_number: toTextOrNull(d.invoiceNumber),
        reason: d.reason,
        description: d.description,
      });
      return {
        error,
        email: {
          kind: "return",
          name: d.name,
          email: d.email,
          phone: d.phone,
          fields: [
            ["Order #", d.orderNumber],
            ["Invoice #", d.invoiceNumber],
            ["Reason", RETURN_REASONS.find((r) => r.value === d.reason)?.label ?? d.reason],
          ],
          message: d.description,
        },
      };
    },
    "Your return request is in. We'll email you return instructions and an authorization number shortly. Please don't ship anything until you receive them.",
  );
}

export async function submitContact(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const db = createPublicClient();
  if (!db) return { status: "error", message: GENERIC_ERROR };
  return handleLead(
    "contact",
    contactSchema,
    formData,
    async (d) => {
      // Part requests, offers and fitment checks go to part_requests (linked to the product when a SKU is given).
      if (d.topic === "part-request" || d.topic === "fitment") {
        let product: { id: string; slug: string; title: string; sku: string } | null = null;
        if (d.sku) {
          const { data } = await db.from("products").select("id, slug, title, sku").eq("sku", d.sku).maybeSingle();
          product = data ?? null;
        }
        const offer = toNumberOrNull(d.offerAmount);
        const { error } = await db.from("part_requests").insert({
          product_id: product?.id ?? null,
          name: d.name,
          email: d.email,
          phone: toTextOrNull(d.phone),
          vehicle_year: toNumberOrNull(d.vehicleYear),
          vehicle_make: toTextOrNull(d.vehicleMake),
          vehicle_model: toTextOrNull(d.vehicleModel),
          vin: toTextOrNull(d.vin),
          part_name: toTextOrNull(d.partName) ?? (d.topic === "fitment" ? "Fitment check" : null),
          part_number: toTextOrNull(d.partNumber),
          offer_amount: offer,
          message: d.message,
        });
        return {
          error,
          email: {
            kind: d.topic === "fitment" ? "fitment" : offer ? "offer" : "part_request",
            name: d.name,
            email: d.email,
            phone: d.phone,
            product: product ? { title: product.title, slug: product.slug, sku: product.sku } : null,
            fields: [
              ["Part", d.partName],
              ["Part #", d.partNumber],
              ["Offer", offer ? `$${offer.toFixed(2)}` : ""],
              ["Vehicle", [d.vehicleYear, d.vehicleMake, d.vehicleModel].filter(Boolean).join(" ")],
              ["VIN", d.vin],
            ],
            message: d.message,
          },
        };
      }
      const subject = d.topic === "order" ? "Order question" : "General question";
      const { error } = await db.from("contact_messages").insert({
        name: d.name,
        email: d.email,
        phone: toTextOrNull(d.phone),
        subject,
        message: d.message,
      });
      return {
        error,
        email: { kind: "contact", name: d.name, email: d.email, phone: d.phone, fields: [["Topic", subject]], message: d.message },
      };
    },
    "Message received. We'll reply by email, usually within one business day.",
  );
}
