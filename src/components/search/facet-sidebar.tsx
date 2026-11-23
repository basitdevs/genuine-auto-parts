import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { conditionLabel, formatNumber } from "@/lib/format";
import { partsHref, type PartsSearch } from "@/lib/search/params";
import type { SearchFacets } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

function FacetLink({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-inverse font-semibold text-inverse-foreground" : "hover:bg-muted",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-sm border",
            active ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {active ? <Check className="size-3" /> : null}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined ? (
        <span className={cn("text-xs tabular-nums", active ? "text-inverse-muted" : "text-muted-foreground")}>{formatNumber(count)}</span>
      ) : null}
    </Link>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b py-4 last:border-b-0">
      <h3 className="mb-2 px-2 text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );
}

/** Server-rendered facets: plain links, so filtering works without JavaScript. */
export function FacetSidebar({ search, facets }: { search: PartsSearch; facets: SearchFacets }) {
  return (
    <div>
      <Group title="Availability">
        <FacetLink href={partsHref(search, { stock: !search.stock })} active={search.stock} label="In stock only" />
      </Group>

      {facets.categories.length ? (
        <Group title="Category">
          <ul className="space-y-0.5">
            {facets.categories.map((c) => (
              <li key={c.slug}>
                <FacetLink
                  href={partsHref(search, { category: search.category === c.slug ? null : c.slug })}
                  active={search.category === c.slug}
                  label={c.name}
                  count={c.count}
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {facets.makes.length ? (
        <Group title="Make">
          <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {facets.makes.map((m) => (
              <li key={m.slug}>
                <FacetLink
                  href={partsHref(search, search.make === m.slug ? { make: null, model: null } : { make: m.slug, model: null })}
                  active={search.make === m.slug}
                  label={m.name}
                  count={m.count}
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {facets.conditions.length ? (
        <Group title="Condition">
          <ul className="space-y-0.5">
            {facets.conditions.map((c) => (
              <li key={c.value}>
                <FacetLink
                  href={partsHref(search, { condition: search.condition === c.value ? null : c.value })}
                  active={search.condition === c.value}
                  label={conditionLabel[c.value] ?? c.value}
                  count={c.count}
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      <Group title="Price">
        <form action="/parts" method="get" className="px-2">
          {/* Preserve the other filters on submit */}
          {Object.entries(search).map(([key, value]) =>
            key === "min" || key === "max" || key === "page" || value === undefined || value === false ? null : (
              <input key={key} type="hidden" name={key} value={value === true ? "1" : String(value)} />
            ),
          )}
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="price-min">
              Minimum price
            </label>
            <Input id="price-min" name="min" inputMode="numeric" placeholder={`$${Math.floor(facets.price.min)}`} defaultValue={search.min} className="h-9" />
            <span aria-hidden className="text-muted-foreground">–</span>
            <label className="sr-only" htmlFor="price-max">
              Maximum price
            </label>
            <Input id="price-max" name="max" inputMode="numeric" placeholder={`$${Math.ceil(facets.price.max)}`} defaultValue={search.max} className="h-9" />
          </div>
          <Button type="submit" variant="outline" size="sm" className="mt-2 w-full">
            Apply price
          </Button>
        </form>
      </Group>
    </div>
  );
}
