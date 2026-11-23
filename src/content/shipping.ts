/**
 * Shipping rules, kept as config so the client can choose a strategy without code changes.
 *
 * ⚠️ PENDING CLIENT DECISION: `confirmed: false` means the storefront shows
 *    "calculated at checkout" instead of quoting a price. Set the values, pick a
 *    strategy, then flip `confirmed` to true.
 *
 * Freight: products with `is_freight = true` (engines, transmissions, doors, bumpers…)
 * are never quoted automatically; they get a manual freight quote.
 */
export type WeightTier = { maxLb: number; rate: number };

export type ShippingStrategy =
  | { kind: "flat"; rate: number }
  | { kind: "weight"; tiers: WeightTier[]; overMaxRate: number; defaultWeightLb: number }
  | { kind: "free_over_threshold"; threshold: number; below: Exclude<ShippingStrategy, { kind: "free_over_threshold" }> };

export type ShippingConfig = {
  confirmed: boolean;
  strategy: ShippingStrategy;
  /** Shown for freight items and whenever a quote isn't possible. */
  freightMessage: string;
  handlingTime: string;
};

export const shippingConfig: ShippingConfig = {
  confirmed: false,
  strategy: {
    kind: "free_over_threshold",
    threshold: 150,
    below: {
      kind: "weight",
      defaultWeightLb: 5,
      overMaxRate: 89,
      tiers: [
        { maxLb: 2, rate: 9.95 },
        { maxLb: 10, rate: 14.95 },
        { maxLb: 30, rate: 24.95 },
        { maxLb: 70, rate: 49.95 },
      ],
    },
  },
  freightMessage: "Ships by freight. We'll contact you with a quote before charging.",
  handlingTime: "1–2 business days",
};

export type ShippingItem = { weightLb: number | null; isFreight: boolean; quantity: number; price: number };

export type ShippingQuote =
  | { kind: "quote"; amount: number }
  | { kind: "freight"; message: string }
  | { kind: "unconfirmed" };

function quoteWith(strategy: ShippingStrategy, items: ShippingItem[]): number {
  switch (strategy.kind) {
    case "flat":
      return strategy.rate;
    case "weight": {
      const weight = items.reduce((sum, i) => sum + (i.weightLb ?? strategy.defaultWeightLb) * i.quantity, 0);
      const tier = [...strategy.tiers].sort((a, b) => a.maxLb - b.maxLb).find((t) => weight <= t.maxLb);
      return tier ? tier.rate : strategy.overMaxRate;
    }
    case "free_over_threshold": {
      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      return subtotal >= strategy.threshold ? 0 : quoteWith(strategy.below, items);
    }
  }
}

/** Pure function, shared by the product page, cart and (Phase 3) Stripe checkout. */
export function quoteShipping(items: ShippingItem[], config: ShippingConfig = shippingConfig): ShippingQuote {
  if (items.some((i) => i.isFreight)) return { kind: "freight", message: config.freightMessage };
  if (!config.confirmed) return { kind: "unconfirmed" };
  return { kind: "quote", amount: Math.round(quoteWith(config.strategy, items) * 100) / 100 };
}

/** One-line shipping summary for a single product. */
export function shippingSummary(item: ShippingItem, config: ShippingConfig = shippingConfig): string {
  const quote = quoteShipping([item], config);
  if (quote.kind === "freight") return quote.message;
  if (quote.kind === "unconfirmed") return `Ships in ${config.handlingTime} with tracking. Shipping confirmed before you pay.`;
  return quote.amount === 0
    ? `Free shipping. Ships in ${config.handlingTime}.`
    : `Shipping $${quote.amount.toFixed(2)}. Ships in ${config.handlingTime}.`;
}
