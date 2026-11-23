/**
 * Built-in FAQ, written in the RichText Markdown subset so it can be shown as-is on /faq
 * and copied into Admin → Content → FAQ as the starting point for edits.
 * Numbers come from the live settings (warranty/returns/shipping/city).
 */
export type FaqGroup = { group: string; items: { q: string; a: string }[] };

export function builtInFaq(ctx: { warrantyDays: number; returnDays: number; handlingTime: string; city: string; region: string }): FaqGroup[] {
  const { warrantyDays, returnDays, handlingTime, city, region } = ctx;
  return [
    {
      group: "Parts & fitment",
      items: [
        { q: "Are your parts genuine OEM?", a: "Yes. Our parts are original factory (OEM) parts removed from vehicles we dismantle. Condition is shown on every listing." },
        {
          q: "How do I know a part fits my vehicle?",
          a: "Compare the OEM part number on the listing with the number on your original part, and check the fitment table on the product page. The surest way: [send us your VIN](/contact?topic=fitment) and we'll confirm before you buy.",
        },
        {
          q: "Can I search by part number or VIN?",
          a: "Yes. Type an OEM or interchange part number into the search bar at the top of any page, or [shop by year, make and model](/parts). To check fitment by VIN, [send us your VIN](/contact?topic=fitment) and we'll confirm.",
        },
        { q: "The part I need isn't listed. Can you find it?", a: "Often, yes. Many parts are still on vehicles we're dismantling. [Send a part request](/contact?topic=part-request) with your vehicle details." },
        { q: "Are the photos of the actual part?", a: "Where a listing has photos, they show the actual part. If a listing has no photo yet, [ask us](/contact) and we'll send pictures before you buy." },
      ],
    },
    {
      group: "Ordering & payment",
      items: [
        {
          q: "How do I place an order?",
          a: "Add parts to your cart and send your order request. We confirm availability, fitment and shipping, then email you a secure payment link, usually within one business day. Nothing is charged until you approve it.",
        },
        { q: "Can I make an offer on a part?", a: "Yes. Use the **Make an offer** button on any part, or [contact us](/contact?topic=part-request) with the part and your price." },
      ],
    },
    {
      group: "Shipping & pickup",
      items: [
        { q: "How fast do you ship?", a: `Orders usually ship within ${handlingTime}, with tracking sent by email.` },
        {
          q: "How much is shipping?",
          a: "Shipping depends on the part and your location, and we confirm the cost before you pay. Large items (engines, transmissions, doors, bumpers) ship by freight, and we quote those before you're charged.",
        },
        { q: "Can I pick up my part locally?", a: `Yes. Many customers pick up the same day from our yard in ${city}, ${region}. [Contact us](/contact) first so your part is ready when you arrive.` },
        { q: "Do you ship nationwide?", a: "Yes, we ship throughout the United States. See our [shipping policy](/policies/shipping)." },
      ],
    },
    {
      group: "Warranty & returns",
      items: [
        { q: "Do your parts come with a warranty?", a: `Yes. Parts are covered by a ${warrantyDays}-day warranty against defects. Labor and installation costs are not covered. [Warranty details](/policies/warranty).` },
        { q: "Can I return a part?", a: `Most parts can be returned within ${returnDays} days of delivery in the condition you received them. [Start a return](/returns) and wait for instructions before shipping anything back.` },
      ],
    },
    {
      group: "Selling your car",
      items: [
        { q: "Do you buy cars that don't run?", a: "Yes. We buy running and non-running vehicles, including accident-damaged and high-mileage cars and trucks. [Get an estimate](/sell-your-car)." },
      ],
    },
  ];
}

/** Plain text for JSON-LD: drops Markdown link targets and bold markers. */
export const faqPlainText = (md: string) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "");
