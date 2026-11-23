import "server-only";
import { quoteShipping } from "@/content/shipping";
import { getShippingConfig } from "@/lib/settings/server";
import { getCartProducts, type CartProduct } from "@/lib/catalog/queries";
import { conditionLabel } from "@/lib/format";
import { cartCount, MAX_QTY, type CartLine } from "./cookie";
import type { CartSnapshot, CartSnapshotLine } from "./types";

export const isSellable = (p: { status: string; quantity: number }) => p.status === "active" && p.quantity > 0;

const EMPTY: Omit<CartSnapshot, "count" | "error"> = {
  lines: [],
  units: 0,
  subtotal: 0,
  shipping: { kind: "unconfirmed" },
  unavailable: 0,
};

/**
 * Builds the drawer/cart view from cookie lines. Pass `products` when the caller already
 * loaded them (saves a round trip); otherwise they're read fresh from the database.
 */
export async function buildCartSnapshot(lines: CartLine[], products?: Map<string, CartProduct> | null): Promise<CartSnapshot> {
  const count = cartCount(lines);
  if (lines.length === 0) return { ...EMPTY, count, error: null };

  const map = products ?? (await getCartProducts(lines.map((l) => l.productId)));
  if (!map) return { ...EMPTY, count, error: "We couldn't reach our inventory. Your cart is saved, so please try again." };

  const out: CartSnapshotLine[] = [];
  for (const line of lines) {
    const p = map.get(line.productId);
    if (!p) continue;
    const available = isSellable(p);
    const maxQuantity = available ? Math.min(p.quantity, MAX_QTY) : 0;
    out.push({
      productId: p.id,
      slug: p.slug,
      title: p.title,
      sku: p.sku,
      price: p.price,
      quantity: available ? Math.min(line.quantity, maxQuantity) : line.quantity,
      maxQuantity,
      conditionLabel: conditionLabel[p.condition],
      image: p.image,
      categoryIcon: p.categoryIcon,
      available,
      isFreight: p.isFreight,
    });
  }

  const live = out.filter((l) => l.available);
  const subtotal = live.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const shippingConfig = await getShippingConfig();
  const quote = quoteShipping(
    live.map((l) => {
      const p = map.get(l.productId);
      return { weightLb: p?.weightLb ?? null, isFreight: l.isFreight, quantity: l.quantity, price: l.price };
    }),
    shippingConfig,
  );

  return {
    lines: out,
    count,
    units: live.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    shipping: quote.kind === "quote" ? { kind: "quote", amount: quote.amount } : { kind: quote.kind },
    unavailable: lines.length - live.length,
    error: null,
  };
}
