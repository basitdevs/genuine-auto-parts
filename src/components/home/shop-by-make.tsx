import Link from "next/link";
import { EmptyState } from "@/components/catalog/product-grid";
import { Reveal } from "@/components/motion/reveal";
import { getShopByMakes } from "@/lib/catalog/queries";
import { formatNumber } from "@/lib/format";
import { partsHref } from "@/lib/search/params";
import { Section } from "./section";

/**
 * Make tiles use a bold wordmark treatment rather than manufacturer logos
 * (those are trademarks; add licensed SVGs to makes.logo_path later if desired).
 */
export async function ShopByMake() {
  const makes = (await getShopByMakes()).slice(0, 12);

  return (
    <Section
      id="makes"
      eyebrow="Shop by make"
      title="Parts for the brands we dismantle"
      description="Factory-original parts sorted by manufacturer. Pick a make to see everything we have on the shelf."
      action={{ label: "All makes", href: "/parts" }}
    >
      {makes.length === 0 ? (
        <EmptyState title="Browse every part" description="Search by vehicle or part number to find what you need." />
      ) : (
        <Reveal>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {makes.map((make) => (
              <li key={make.slug}>
                <Link
                  href={partsHref({}, { make: make.slug })}
                  className="group relative flex h-28 flex-col justify-between overflow-hidden rounded-lg border bg-card p-4 transition-[border-color,background-color] duration-300 hover:border-inverse hover:bg-inverse hover:text-inverse-foreground"
                >
                  <span aria-hidden className="absolute -right-3 -bottom-4 font-display text-7xl font-extrabold text-foreground/[0.04] uppercase transition-colors group-hover:text-inverse-foreground/[0.06]">
                    {make.name.slice(0, 2)}
                  </span>
                  <span className="relative font-display text-xl leading-none font-bold tracking-wide uppercase">{make.name}</span>
                  <span className="relative flex items-center justify-between text-xs text-muted-foreground group-hover:text-inverse-muted">
                    {formatNumber(make.count)} parts
                    <span aria-hidden className="h-0.5 w-5 origin-right scale-x-50 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </Section>
  );
}
