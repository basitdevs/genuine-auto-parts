import Link from "next/link";
import { X } from "lucide-react";
import { conditionLabel, formatPrice } from "@/lib/format";
import { hasActiveFilters, partsHref, type PartsSearch } from "@/lib/search/params";
import type { SearchFacets } from "@/lib/supabase/database.types";

type Chip = { label: string; href: string };

export function ActiveFilters({ search, facets }: { search: PartsSearch; facets: SearchFacets }) {
  if (!hasActiveFilters(search)) return null;
  const name = (list: { slug: string; name: string }[], slug: string) => list.find((x) => x.slug === slug)?.name ?? slug;
  const chips: Chip[] = [];
  if (search.q) chips.push({ label: `“${search.q}”`, href: partsHref(search, { q: null }) });
  if (search.year) chips.push({ label: String(search.year), href: partsHref(search, { year: null }) });
  if (search.make) chips.push({ label: name(facets.makes, search.make), href: partsHref(search, { make: null, model: null }) });
  if (search.model) chips.push({ label: search.model.replace(/-/g, " "), href: partsHref(search, { model: null }) });
  if (search.category) chips.push({ label: name(facets.categories, search.category), href: partsHref(search, { category: null }) });
  if (search.pn) chips.push({ label: `Part # ${search.pn}`, href: partsHref(search, { pn: null }) });
  if (search.condition) chips.push({ label: conditionLabel[search.condition] ?? search.condition, href: partsHref(search, { condition: null }) });
  if (search.min !== undefined) chips.push({ label: `From ${formatPrice(search.min)}`, href: partsHref(search, { min: null }) });
  if (search.max !== undefined) chips.push({ label: `Up to ${formatPrice(search.max)}`, href: partsHref(search, { max: null }) });
  if (search.stock) chips.push({ label: "In stock", href: partsHref(search, { stock: false }) });
  if (search.vehicle) chips.push({ label: `Vehicle #${search.vehicle}`, href: partsHref(search, { vehicle: null }) });

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href}
          scroll={false}
          className="inline-flex items-center gap-1.5 rounded-sm border bg-background py-1 pr-2 pl-3 text-xs font-semibold capitalize transition-colors hover:border-primary hover:text-primary"
        >
          {chip.label}
          <X className="size-3.5" aria-label="Remove filter" />
        </Link>
      ))}
      <Link href="/parts" className="ml-1 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        Clear all
      </Link>
    </div>
  );
}
