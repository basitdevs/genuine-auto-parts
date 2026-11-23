import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { EmptyState } from "@/components/catalog/product-grid";
import { Reveal } from "@/components/motion/reveal";
import { getCategoryTiles } from "@/lib/catalog/queries";
import { formatNumber } from "@/lib/format";
import { partsHref } from "@/lib/search/params";
import { Section } from "./section";

export async function ShopByCategory() {
  const categories = await getCategoryTiles();

  return (
    <Section
      id="categories"
      eyebrow="Shop by category"
      title="Every system, from engine to interior"
      tone="muted"
      action={{ label: "Full catalog", href: "/parts" }}
    >
      {categories.length === 0 ? (
        <EmptyState title="Browse every part" description="Search by vehicle or part number to find what you need." />
      ) : (
        <Reveal>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={partsHref({}, { category: category.slug })}
                  className="group relative flex h-full items-start gap-4 overflow-hidden rounded-lg border bg-card p-5 transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-inverse text-inverse-foreground transition-[background-color,transform] duration-300 group-hover:-rotate-6 group-hover:bg-primary">
                    <CategoryIcon name={category.icon} className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg leading-tight font-bold tracking-wide uppercase">{category.name}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{formatNumber(category.count)} parts</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </Section>
  );
}
