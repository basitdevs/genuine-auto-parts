import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { PartImage } from "@/components/catalog/part-image";
import { EmptyState, ProductGrid, ProductGridSkeleton } from "@/components/catalog/product-grid";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getVehicleBySlug, searchParts } from "@/lib/catalog/queries";
import { formatNumber } from "@/lib/format";
import { partsHref } from "@/lib/search/params";

/** Rendered on demand and cached per vehicle (no build-time generation). */
export async function generateMetadata(props: PageProps<"/vehicles/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const v = await getVehicleBySlug(slug);
  if (!v) return { title: "Donor vehicle" };
  const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  return {
    title: `${name} Parts (Stock #${v.stockNumber})`,
    description: `Genuine OEM used parts from our ${name}, stock #${v.stockNumber}.`,
    alternates: { canonical: `/vehicles/${v.slug}` },
  };
}

export default function VehiclePage(props: PageProps<"/vehicles/[slug]">) {
  return (
    <Suspense fallback={<VehicleSkeleton />}>
      <VehicleView params={props.params} />
    </Suspense>
  );
}

async function VehicleView({ params }: { params: PageProps<"/vehicles/[slug]">["params"] }) {
  const { slug } = await params;
  const v = await getVehicleBySlug(slug);
  if (v === undefined) {
    return <EmptyState title="This vehicle is temporarily unavailable" description="Please refresh in a moment." />;
  }
  if (!v) notFound();

  const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  const search = { q: undefined, pn: undefined, stock: false, vehicle: v.stockNumber };
  const parts = await searchParts({ ...search, sort: "newest" });
  const specs: [string, string | null][] = [
    ["Stock #", v.stockNumber],
    ["VIN", v.vin],
    ["Odometer", v.odometer !== null ? `${formatNumber(v.odometer)} mi` : null],
    ["Engine", v.engine],
    ["Transmission", v.transmission],
    ["Drive", v.driveType],
    ["Color", v.color],
  ];

  return (
    <>
      <PageHero title={name} crumbs={[{ label: "Vehicles", href: "/vehicles" }, { label: `#${v.stockNumber}` }]} description={v.description ?? undefined} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <PartImage image={v.images[0] ?? null} icon="car-front" sizes="(min-width: 1024px) 640px, 100vw" eager className="rounded-lg border" />
            {v.images.length > 1 ? (
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {v.images.slice(1, 6).map((img) => (
                  <li key={img.src}>
                    <PartImage image={img} sizes="120px" className="rounded-md border" />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <dl className="divide-y rounded-lg border">
              {specs
                .filter((s): s is [string, string] => Boolean(s[1]))
                .map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[130px_1fr] gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className={label === "VIN" ? "font-mono font-medium" : "font-medium"}>{value}</dd>
                  </div>
                ))}
            </dl>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button asChild size="lg">
                <Link href={partsHref({}, { vehicle: v.stockNumber })}>
                  Shop all parts <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact?topic=part-request">
                  <MessageSquareText aria-hidden /> Request a part
                </Link>
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Don&apos;t see the part you need? It may still be on the vehicle. Ask and we&apos;ll check.</p>
          </div>
        </div>

        <section aria-labelledby="vehicle-parts" className="mt-12">
          <h2 id="vehicle-parts" className="mb-5 font-display text-2xl font-bold tracking-wide uppercase">
            Parts from this vehicle{parts.total ? ` (${formatNumber(parts.total)})` : ""}
          </h2>
          <ProductGrid
            products={parts.products.slice(0, 12)}
            empty={<EmptyState title="Parts are being listed" description="We list parts as we pull them. Request what you need and we'll check the vehicle." />}
          />
          {parts.total > 12 ? (
            <div className="mt-6 text-center">
              <Button asChild variant="outline">
                <Link href={partsHref({}, { vehicle: v.stockNumber })}>View all {formatNumber(parts.total)} parts</Link>
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function VehicleSkeleton() {
  return (
    <>
      <div className="bg-inverse py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Skeleton className="h-12 w-2/3 bg-inverse-3" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <ProductGridSkeleton count={4} />
      </div>
    </>
  );
}
