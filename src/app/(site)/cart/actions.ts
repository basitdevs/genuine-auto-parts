"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_LINES, MAX_QTY, readCart, writeCart } from "@/lib/cart/cookie";
import { buildCartSnapshot, isSellable as sellable } from "@/lib/cart/snapshot";
import type { CartMutationResult, CartSnapshot } from "@/lib/cart/types";
import { getCartProducts } from "@/lib/catalog/queries";
import { formatPrice } from "@/lib/format";
import { GENERIC_ERROR, handleLead } from "@/lib/forms/lead-pipeline";
import { cartRequestSchema, toTextOrNull, type LeadActionState } from "@/lib/forms/schemas";
import { createPublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Cart Server Actions. The cookie only holds product IDs + quantities; every action
 * re-reads stock from the database and clamps quantities to what's actually available.
 *
 * Two flavours:
 * - Drawer actions (getCart, addCartItem, setCartItemQuantity, removeCartItem) are called
 *   from the cart drawer and return a fresh CartSnapshot.
 * - Form actions (addToCartForm, updateCartQuantity, removeFromCart, removeUnavailable)
 *   keep the cart usable without JavaScript.
 * Setting the cookie re-renders the current page, so the header badge stays in sync.
 */
const idSchema = z.uuid();
const qtySchema = z.coerce.number().int().min(0).max(MAX_QTY);

type AddOutcome = { ok: boolean; message: string; changed: boolean };

async function addLine(productId: string, quantity = 1): Promise<AddOutcome & { snapshot: () => Promise<CartSnapshot> }> {
  const lines = await readCart();
  const products = await getCartProducts([...new Set([productId, ...lines.map((l) => l.productId)])]);
  const snapshot = () => buildCartSnapshot(lines, products);
  const fail = (message: string) => ({ ok: false, message, changed: false, snapshot });

  if (!products) return fail("We couldn't reach our inventory. Please try again.");
  const product = products.get(productId);
  if (!product || !sellable(product)) return fail("Sorry, this part just sold.");

  const stock = Math.min(product.quantity, MAX_QTY);
  const existing = lines.find((l) => l.productId === productId);
  if (existing) {
    if (existing.quantity >= stock) {
      return {
        ok: true,
        message: stock === 1 ? "Already in your cart (only one available)." : "You have all available units in your cart.",
        changed: false,
        snapshot,
      };
    }
    existing.quantity = Math.min(stock, existing.quantity + quantity);
  } else {
    if (lines.length >= MAX_LINES) return fail(`Your cart is full (${MAX_LINES} parts). Send this cart first, then add more.`);
    lines.push({ productId, quantity: Math.min(stock, quantity) });
  }
  await writeCart(lines);
  return { ok: true, message: "Added to your cart.", changed: true, snapshot };
}

/** Current cart for the drawer (always fresh). */
export async function getCart(): Promise<CartSnapshot> {
  return buildCartSnapshot(await readCart());
}

export async function addCartItem(productId: string, quantity = 1): Promise<CartMutationResult> {
  const id = idSchema.safeParse(productId);
  const qty = qtySchema.safeParse(quantity);
  if (!id.success || !qty.success || qty.data < 1) {
    return { ok: false, message: "That part couldn't be added.", cart: await getCart() };
  }
  const result = await addLine(id.data, qty.data);
  return { ok: result.ok, message: result.message, cart: await result.snapshot() };
}

export async function setCartItemQuantity(productId: string, quantity: number): Promise<CartMutationResult> {
  const id = idSchema.safeParse(productId);
  const qty = qtySchema.safeParse(quantity);
  if (!id.success || !qty.success) return { ok: false, message: "Couldn't update that quantity.", cart: await getCart() };
  if (qty.data === 0) return removeCartItem(id.data);

  const lines = await readCart();
  const line = lines.find((l) => l.productId === id.data);
  const products = await getCartProducts(lines.map((l) => l.productId));
  if (!line) return { ok: false, message: "That part is no longer in your cart.", cart: await buildCartSnapshot(lines, products) };
  const product = products?.get(id.data);
  if (product && !sellable(product)) {
    return { ok: false, message: "Sorry, this part just sold.", cart: await buildCartSnapshot(lines, products) };
  }
  const stock = product ? Math.min(product.quantity, MAX_QTY) : line.quantity;
  const next = Math.max(1, Math.min(qty.data, stock));
  if (next !== line.quantity) {
    line.quantity = next;
    await writeCart(lines);
  }
  const message = qty.data > stock ? `Only ${stock} available.` : "Cart updated.";
  return { ok: qty.data <= stock, message, cart: await buildCartSnapshot(lines, products) };
}

export async function removeCartItem(productId: string): Promise<CartMutationResult> {
  const id = idSchema.safeParse(productId);
  const lines = await readCart();
  if (!id.success) return { ok: false, message: "Couldn't remove that part.", cart: await buildCartSnapshot(lines) };
  const next = lines.filter((l) => l.productId !== id.data);
  if (next.length !== lines.length) await writeCart(next);
  return { ok: true, message: "Removed from your cart.", cart: await buildCartSnapshot(next) };
}

/** No-JS add to cart: adds the part, then shows the cart page. */
export async function addToCartForm(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("productId"));
  const qty = qtySchema.safeParse(formData.get("quantity") ?? 1);
  if (id.success) await addLine(id.data, qty.success && qty.data > 0 ? qty.data : 1);
  redirect("/cart");
}

export async function updateCartQuantity(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("productId"));
  const qty = qtySchema.safeParse(formData.get("quantity"));
  if (!id.success || !qty.success) return;
  await setCartItemQuantity(id.data, qty.data);
}

export async function removeFromCart(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("productId"));
  if (!id.success) return;
  const lines = await readCart();
  await writeCart(lines.filter((l) => l.productId !== id.data));
}

/** Removes every line that's no longer available (sold, archived or deleted). */
export async function removeUnavailable(): Promise<void> {
  const lines = await readCart();
  const products = await getCartProducts(lines.map((l) => l.productId));
  if (!products) return;
  await writeCart(lines.filter((l) => {
    const p = products.get(l.productId);
    return p && sellable(p);
  }));
}

/**
 * Until Stripe checkout launches: send the cart as an order request. It becomes a real
 * order (status "new", source "request") through create_order_request(), which re-reads
 * prices and stock in the database and links the order to the signed-in customer. Staff
 * then confirm it in /admin/orders. Before migration 0600 it falls back to a
 * part_requests lead so no request is ever lost.
 */
export async function submitCartRequest(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const db = createPublicClient();
  if (!db) return { status: "error", message: GENERIC_ERROR };

  const lines = await readCart();
  const products = await getCartProducts(lines.map((l) => l.productId));
  if (!products) return { status: "error", message: GENERIC_ERROR };
  const items = lines.flatMap((l) => {
    const p = products.get(l.productId);
    return p && sellable(p) ? [{ product: p, quantity: Math.min(l.quantity, p.quantity) }] : [];
  });
  if (items.length === 0) return { status: "error", message: "Your cart has no available parts. Add a part and try again." };

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const lineText = items.map((i) => `${i.product.sku} · ${i.product.title} · ${formatPrice(i.product.price)} × ${i.quantity}`);
  const single = items.length === 1 ? items[0].product : null;

  const result = await handleLead(
    "cart-request",
    cartRequestSchema,
    formData,
    async (d) => {
      // The visitor's own session (anon or signed in) so auth.uid() links the customer.
      const session = await createSupabaseServerClient();
      const order = await session.rpc("create_order_request", {
        p_email: d.email,
        p_name: d.name,
        p_phone: toTextOrNull(d.phone),
        p_postal_code: toTextOrNull(d.postalCode),
        p_notes: toTextOrNull(d.notes),
        p_items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      });
      let error: { message: string } | null = order.error;
      let orderNumber: string | null = order.data?.[0]?.o_number ?? null;
      const missingRpc = order.error && /could not find the function|does not exist|PGRST202/i.test(`${order.error.code ?? ""} ${order.error.message}`);
      if (missingRpc) {
        orderNumber = null;
        const message = [
          `Cart order request (${items.length} ${items.length === 1 ? "part" : "parts"}), subtotal ${formatPrice(subtotal)}:`,
          ...lineText.map((t) => `- ${t}`),
          d.postalCode ? `Ship to ZIP: ${d.postalCode}` : "",
          d.notes ? `\nCustomer notes: ${d.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        ({ error } = await db.from("part_requests").insert({
          product_id: single?.id ?? null,
          name: d.name,
          email: d.email,
          phone: toTextOrNull(d.phone),
          part_name: `Cart order request (${items.length} ${items.length === 1 ? "part" : "parts"})`,
          part_number: items.map((i) => i.product.sku).join(", ").slice(0, 500),
          message,
        }));
      }
      if (!error) await writeCart([]);
      return {
        error,
        email: {
          kind: "order_request",
          name: d.name,
          email: d.email,
          phone: d.phone,
          product: single ? { title: single.title, slug: single.slug, sku: single.sku } : null,
          fields: [
            ["Order", orderNumber ?? "Saved as a lead (run migration 0600 for orders)"],
            ["Parts", lineText.join("\n")],
            ["Subtotal", formatPrice(subtotal)],
            ["Ship to ZIP", d.postalCode],
          ],
          message: d.notes,
        },
      };
    },
    "Order request sent.",
  );
  if (result.status === "success") redirect("/cart?sent=1");
  return result;
}
