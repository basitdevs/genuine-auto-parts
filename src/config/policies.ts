/** Policy page slugs (also used by Proxy to 404 unknown /policies/* URLs). */
export const POLICY_SLUGS = ["shipping", "returns", "warranty", "privacy", "terms"] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

/** Built-in titles/descriptions (the policy page and the Content editor share them). */
export const POLICY_META: Record<PolicySlug, { title: string; description: string }> = {
  shipping: { title: "Shipping & Delivery", description: "How and when your parts ship, carriers, handling times and freight items." },
  returns: { title: "Returns & Refunds", description: "Return windows, eligible items, refunds and how to start a return." },
  warranty: { title: "Warranty", description: "What our parts warranty covers, for how long, and how to make a claim." },
  privacy: { title: "Privacy Policy", description: "What we collect, why, and how we protect your information." },
  terms: { title: "Terms of Service", description: "The terms that apply when you shop with us." },
};
