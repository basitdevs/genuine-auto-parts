import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { EmptyState, ProductGrid, ProductGridSkeleton } from "@/components/catalog/product-grid";
import { ActiveFilters } from "@/components/search/active-filters";
import { FacetSidebar } from "@/components/search/facet-sidebar";
import { Pagination } from "@/components/search/pagination";
import { SortSelect } from "@/components/search/sort-select";
import { VehicleSearch } from "@/components/search/vehicle-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryOptions, getFitmentYears, searchParts } from "@/lib/catalog/queries";
import { formatNumber } from "@/lib/format";
import { effectiveSort, PAGE_SIZE, parsePartsSearch } from "@/lib/search/params";

export const metadata: Metadata = {
  title: "Shop Used OEM Auto & Truck Parts",
  description: "Search tested genuine OEM used parts by year, make, model, part number or VIN. Filter by category, condition and price.",
  alternates: { canonical: "/parts" },
};

export default function PartsPage(props: PageProps<"/parts">) {
  return (
    <>
      <div className="border-b bg-inverse text-inverse-foreground">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <nav aria-label="Breadcrumb" className="text-xs text-inverse-muted">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-inverse-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-inverse-foreground">
                Parts
              </li>
            </ol>
          </nav>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight uppercase sm:text-5xl">Shop parts</h1>
          <p className="mt-2 max-w-2xl text-sm text-inverse-muted">
            Genuine OEM used parts, inspected before they ship. Narrow down by vehicle, part number or category.
          </p>
        </div>
      </div>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/parts">["searchParams"] }) {
  const search = parsePartsSearch(await searchParams);
  const [result, years, categories] = await Promise.all([searchParts(search), getFitmentYears(), getCategoryOptions()]);
  const sort = effectiveSort(search);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const page = search.page ?? 1;
  const firstItem = result.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, result.total);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Vehicle finder. key: remount with fresh defaults when the URL changes */}
      <VehicleSearch key={JSON.stringify(search)} years={years} categories={categories} initial={search} className="mb-8" />

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside aria-label="Filters" className="lg:sticky lg:top-40 lg:self-start">
          <details className="rounded-lg border bg-card lg:open:border-transparent" open>
            <summary className="cursor-pointer list-none px-4 py-3 font-display font-bold tracking-wide uppercase lg:hidden [&::-webkit-details-marker]:hidden">
              Filters
            </summary>
            <div className="px-2 pb-2 lg:p-0">
              <FacetSidebar search={search} facets={result.facets} />
            </div>
          </details>
        </aside>

        <section aria-labelledby="results-heading" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-heading" className="text-sm text-muted-foreground">
              {result.total > 0 ? (
                <>
                  Showing <strong className="text-foreground">{formatNumber(firstItem)}–{formatNumber(lastItem)}</strong> of{" "}
                  <strong className="text-foreground">{formatNumber(result.total)}</strong> parts
                </>
              ) : (
                "No matching parts"
              )}
            </h2>
            <SortSelect search={search} value={sort} />
          </div>
          <div className="mb-5">
            <ActiveFilters search={search} facets={result.facets} />
          </div>

          {result.error && result.error !== "not-configured" ? (
            <EmptyState
              icon={<AlertTriangle className="size-6" aria-hidden />}
              title="Search is temporarily unavailable"
              description="We couldn't load results. Please try again in a moment."
              action={
                <Button asChild variant="outline">
                  <Link href="/parts">Reload</Link>
                </Button>
              }
            />
          ) : (
            <ProductGrid
              products={result.products}
              eagerCount={4}
              empty={
                <EmptyState
                  title="No parts match those filters"
                  description={
                    <>
                      Try removing a filter or searching by OEM part number. We dismantle new vehicles every week. Tell us what
                      you need and we&apos;ll look for it.
                    </>
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button asChild variant="outline">
                        <Link href="/parts">Clear filters</Link>
                      </Button>
                      <Button asChild>
                        <Link href="/contact?topic=part-request">Request a part</Link>
                      </Button>
                    </div>
                  }
                />
              }
            />
          )}
          <Pagination search={search} totalPages={totalPages} />
        </section>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="mb-6 h-14 w-full" />
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
        <div>
          <Skeleton className="mb-5 h-10 w-64" />
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}
