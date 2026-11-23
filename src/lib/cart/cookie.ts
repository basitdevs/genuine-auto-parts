import "server-only";
import { cookies } from "next/headers";

/**
 * Guest cart in a first-party cookie: "productId:qty,productId:qty" (UUIDs and digits only).
 * Only IDs and quantities are stored. Prices, titles and stock are always re-read from
 * the database, so editing the cookie can't change what anything costs.
 * Phase 3 merges it into public.carts on sign-in and checks out via Stripe.
 */
export const CART_COOKIE = "gatp_cart";
export const MAX_LINES = 30;
export const MAX_QTY = 10;

export type CartLine = { productId: string; quantity: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  const lines = new Map<string, number>();
  for (const part of raw.split(",")) {
    const [id, qty] = part.split(":");
    const quantity = Math.min(MAX_QTY, Math.max(1, Number.parseInt(qty ?? "1", 10) || 1));
    if (id && UUID.test(id) && lines.size < MAX_LINES) lines.set(id, quantity);
  }
  return [...lines].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE)?.value);
}

/** Server Actions / Route Handlers only (cookies are read-only during render). */
export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, lines.slice(0, MAX_LINES).map((l) => `${l.productId}:${l.quantity}`).join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
