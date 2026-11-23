import { EmptyState, ProductGrid } from "@/components/catalog/product-grid";
import { getNewestProducts } from "@/lib/catalog/queries";
import { Section } from "./section";

export async function NewestArrivals() {
  const products = await getNewestProducts(8);
  return (
    <Section
      id="newest"
      eyebrow="Fresh off the lift"
      title="Newest arrivals"
      description="Just pulled, inspected and listed. One-off parts go fast."
      action={{ label: "View all", href: "/parts?sort=newest" }}
    >
      <ProductGrid
        products={products}
        empty={<EmptyState title="New parts are on the way" description="We list new inventory every week. Check back soon." />}
      />
    </Section>
  );
}
