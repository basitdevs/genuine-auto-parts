import type { CardImage } from "@/lib/catalog/types";

/**
 * Serializable cart view shared by the server (Server Actions) and the cart drawer.
 * Built fresh from the database on every call, so prices and stock are always current.
 */
export type CartSnapshotLine = {
  productId: string;
  slug: string;
  title: string;
  sku: string;
  price: number;
  quantity: number;
  /** Highest quantity the shopper can pick (stock, capped at MAX_QTY). */
  maxQuantity: number;
  conditionLabel: string;
  image: CardImage | null;
  categoryIcon: string | null;
  available: boolean;
  isFreight: boolean;
};

export type CartShippingLine =
  | { kind: "quote"; amount: number }
  | { kind: "freight" }
  | { kind: "unconfirmed" };

export type CartSnapshot = {
  lines: CartSnapshotLine[];
  /** Units in the cookie (matches the header badge). */
  count: number;
  /** Units that can actually be ordered. */
  units: number;
  subtotal: number;
  shipping: CartShippingLine;
  unavailable: number;
  /** Set when the inventory couldn't be read; the cookie is untouched. */
  error: string | null;
};

export type CartMutationResult = {
  ok: boolean;
  message: string;
  cart: CartSnapshot;
};
