import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CarFront, MessageSquareText, RotateCcw, SearchCheck, ShieldCheck, Truck } from "lucide-react";
import { AddToCartButton } from "@/components/cart/add-to-cart";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { ProductGrid, ProductGridSkeleton } from "@/components/catalog/product-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shippingSummary } from "@/content/shipping";
import { getBusiness, getFlags, getShippingConfig } from "@/lib/settings/server";
import { MAX_QTY, readCart } from "@/lib/cart/cookie";
import { getProductBySlug, getProductSeo, getSimilarProducts, type ProductDetail } from "@/lib/catalog/queries";
import { env } from "@/lib/env";
import { conditionLabel, formatNumber, formatPrice, formatYearRange } from "@/lib/format";
import { partsHref } from "@/lib/search/params";
import { JsonLd } from "@/lib/seo/json-ld";

export async function generateMetadata(props: PageProps<"/parts/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const [product, seo] = await Promise.all([getProductBySlug(slug), getProductSeo(slug)]);
  if (product === undefined) return { title: "Part" };
  if (!product) return { title: "Part not found", robots: { index: false } };
  const description = seo?.description || `${conditionLabel[product.condition]} ${product.title}${product.oemPartNumber ? `, OEM # ${product.oemPartNumber}` : ""}. ${formatPrice(product.price)}. Tested and shipped nationwide.`;
  return {
    title: product.status === "sold" ? `${seo?.title || product.title} (Sold)` : seo?.title || product.title,
    description,
    alternates: { canonical: `/parts/${product.slug}` },
    openGraph: { title: product.title, description, images: product.images[0] ? [product.images[0].src] : undefined },
  };
}

export default function ProductPage(props: PageProps<"/parts/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductView params={props.params} />
    </Suspense>
  );
}

/** Groups per-year fitment rows into "2012–2018 BMW 3 Series 328i" lines. */
function groupFitments(fitments: ProductDetail["fitments"]) {
  const groups = new Map<string, { make: string; model: string | null; trim: string | null; engine: string | null; years: number[] }>();
  for (const f of fitments) {
    const key = [f.make, f.model, f.trim, f.engine].join("|");
    const group = groups.get(key) ?? { make: f.make, model: f.model, trim: f.trim, engine: f.engine, years: [] };
    group.years.push(f.year);
    groups.set(key, group);
  }
  return [...groups.values()];
}

async function ProductView({ params }: { params: PageProps<"/parts/[slug]">["params"] }) {
  const { slug } = await params;
  const [product, business, shippingConfig, flags] = await Promise.all([getProductBySlug(slug), getBusiness(), getShippingConfig(), getFlags()]);
  if (product === undefined) return <ProductUnavailable />;
  if (!product) notFound();

  const sold = product.status === "sold";
  const soldOut = sold || product.quantity === 0;
  const fitments = groupFitments(product.fitments);
  const first = product.fitments.at(-1);
  const primaryFit = product.fitments.find((f) => f.makeSlug) ?? null;
  const similarKey = {
    category: product.category?.slug ?? null,
    make: primaryFit?.makeSlug ?? null,
    model: primaryFit?.modelSlug ?? null,
  };
  const similarLabel = primaryFit ? `${primaryFit.make} ${primaryFit.model ?? ""}`.trim() : null;
  const specs: [string, string | null][] = [
    ["SKU", product.sku],
    ["OEM part #", product.oemPartNumber],
    ["Interchange #", product.interchangeNumbers.join(", ") || null],
    ["Condition", conditionLabel[product.condition]],
    ["Placement", product.placement],
    ["Brand", product.brand],
    ["Category", product.category?.name ?? null],
  ];

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    sku: product.sku,
    mpn: product.oemPartNumber ?? undefined,
    image: product.images.map((i) => i.src),
    description: product.description ?? product.title,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    itemCondition: product.condition === "new" ? "https://schema.org/NewCondition" : product.condition === "remanufactured" ? "https://schema.org/RefurbishedCondition" : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url: `${env.siteUrl}/parts/${product.slug}`,
      priceCurrency: "USD",
      price: product.price.toFixed(2),
      availability: soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      seller: { "@id": `${env.siteUrl}/#store` },
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <JsonLd data={productLd} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">Home</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/parts" className="hover:text-foreground">Parts</Link>
          </li>
          {product.category?.parent ? (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={partsHref({}, { category: product.category.parent.slug })} className="hover:text-foreground">
                  {product.category.parent.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden>/</li>
          <li aria-current="page" className="line-clamp-1 text-foreground">{product.title}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <ProductGallery images={product.images} icon={product.categoryIcon} />

        {/* Buy box */}
        <div>
          {sold ? (
            <div role="status" className="mb-5 rounded-lg border-2 border-foreground bg-inverse p-4 text-inverse-foreground">
              <p className="font-display text-xl font-bold tracking-wide uppercase">This part has sold</p>
              <p className="mt-1 text-sm text-inverse-muted">
                Most of our parts are one-of-a-kind.{" "}
                <a href="#similar-title" className="font-semibold text-inverse-accent underline underline-offset-2">See similar parts in stock</a>, or{" "}
                <Link
                  href={`/contact?topic=part-request&sku=${encodeURIComponent(product.sku)}`}
                  className="font-semibold text-inverse-accent underline underline-offset-2"
                >
                  ask us to find another
                </Link>
                .
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Badge variant={soldOut ? "dark" : "default"}>{soldOut ? "Sold out" : product.quantity === 1 ? "Only 1 left" : `${product.quantity} in stock`}</Badge>
            <Badge variant="outline">{conditionLabel[product.condition]}</Badge>
          </div>
          <h1 className="mt-4 font-display text-3xl leading-tight font-bold tracking-tight uppercase sm:text-4xl">{product.title}</h1>
          {product.oemPartNumber ? (
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              OEM # <span className="font-semibold text-foreground">{product.oemPartNumber}</span>
            </p>
          ) : null}

          <div id="buy" className="mt-6 rounded-lg border bg-card p-5">
            {flags.showPrices ? (
            <p className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-bold">{formatPrice(product.price)}</span>
              {product.compareAtPrice && product.compareAtPrice > product.price ? (
                <span className="text-muted-foreground line-through">{formatPrice(product.compareAtPrice)}</span>
              ) : null}
            </p>
            ) : (
              <p className="font-display text-2xl font-bold uppercase">Call for price</p>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {soldOut ? (
                <Button size="lg" disabled>
                  {sold ? "Sold" : "Sold out"}
                </Button>
              ) : (
                <Suspense fallback={<AddToCartButton productId={product.id} title={product.title} maxQuantity={Math.min(product.quantity, MAX_QTY)} inCart={false} />}>
                  <CartButton productId={product.id} title={product.title} maxQuantity={Math.min(product.quantity, MAX_QTY)} />
                </Suspense>
              )}
              <Button asChild size="lg" variant="outline">
                <Link href={`/contact?topic=part-request&sku=${encodeURIComponent(product.sku)}`}>
                  <MessageSquareText aria-hidden /> Make an offer
                </Link>
              </Button>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5">
                <Truck className="size-4 text-primary" aria-hidden />
                {shippingSummary({ weightLb: product.weightLb, isFreight: product.isFreight, quantity: 1, price: product.price }, shippingConfig)}
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-primary" aria-hidden /> {business.policies.warrantyDays}-day parts warranty
              </li>
              <li className="flex items-center gap-2.5">
                <RotateCcw className="size-4 text-primary" aria-hidden /> {business.policies.returnDays}-day returns.{" "}
                <Link href="/policies/returns" className="underline underline-offset-2 hover:text-primary">Details</Link>
              </li>
            </ul>
          </div>

          <div className="mt-6 rounded-lg border border-primary/30 bg-accent p-4 text-sm text-accent-foreground">
            <p className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="size-4" aria-hidden /> Check fitment before you buy
            </p>
            <p className="mt-1">
              Compare the OEM part number with your original part, or{" "}
              <Link href={`/contact?topic=fitment&sku=${encodeURIComponent(product.sku)}`} className="font-semibold underline underline-offset-2">
                send us your VIN
              </Link>{" "}
              and we&apos;ll confirm it fits.
            </p>
          </div>

          <dl className="mt-6 divide-y rounded-lg border">
            {specs
              .filter((s): s is [string, string] => Boolean(s[1]))
              .map(([label, value]) => (
                <div key={label} className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium break-words">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      {/* Fitment */}
      <section aria-labelledby="fitment-title" className="mt-12">
        <h2 id="fitment-title" className="font-display text-2xl font-bold tracking-wide uppercase">Vehicle fitment</h2>
        {fitments.length ? (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Years</th>
                  <th scope="col" className="px-4 py-3">Make</th>
                  <th scope="col" className="px-4 py-3">Model</th>
                  <th scope="col" className="px-4 py-3">Trim</th>
                  <th scope="col" className="px-4 py-3">Engine</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fitments.map((f) => (
                  <tr key={[f.make, f.model, f.trim, f.engine].join("|")}>
                    <td className="px-4 py-3 font-semibold tabular-nums">{formatYearRange(f.years)}</td>
                    <td className="px-4 py-3">{f.make}</td>
                    <td className="px-4 py-3">{f.model ?? "–"}</td>
                    <td className="px-4 py-3">{f.trim ?? "All"}</td>
                    <td className="px-4 py-3">{f.engine ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Fitment details not listed. Contact us with your VIN and we&apos;ll confirm.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Fitment is based on the OEM part number. Always compare with your original part before installing.
        </p>
      </section>

      {/* Donor vehicle */}
      {product.vehicle ? (
        <section aria-labelledby="donor-title" className="mt-12 rounded-lg bg-inverse p-6 text-inverse-foreground">
          <h2 id="donor-title" className="flex items-center gap-2 font-display text-2xl font-bold tracking-wide uppercase">
            <CarFront className="size-5 text-inverse-accent" aria-hidden /> Pulled from
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {(
              [
                ["Vehicle", `${product.vehicle.year} ${product.vehicle.make} ${product.vehicle.model ?? ""}`.trim()],
                ["Stock #", product.vehicle.stockNumber],
                ["Mileage", product.vehicle.odometer !== null ? `${formatNumber(product.vehicle.odometer)} mi` : null],
                ["Engine", product.vehicle.engine],
                ["Transmission", product.vehicle.transmission],
              ] as [string, string | null][]
            )
              .filter((s): s is [string, string] => Boolean(s[1]))
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs tracking-wider text-inverse-muted uppercase">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
          </dl>
          <Link
            href={partsHref({}, { vehicle: product.vehicle.stockNumber })}
            className="mt-5 inline-flex text-sm font-bold tracking-wide text-inverse-accent uppercase hover:text-inverse-foreground"
          >
            More parts from this vehicle →
          </Link>
        </section>
      ) : null}

      {/* Similar parts (the main path forward when this one has sold) */}
      <section aria-labelledby="similar-title" className="mt-12 scroll-mt-24">
        <h2 id="similar-title" className="font-display text-2xl font-bold tracking-wide uppercase">
          {sold ? "Similar parts in stock" : "Similar parts"}
        </h2>
        {similarLabel ? <p className="mt-1 text-sm text-muted-foreground">{product.category?.name ?? "Parts"} for {similarLabel}</p> : null}
        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <SimilarParts productId={product.id} similarKey={similarKey} sku={product.sku} />
        </Suspense>
      </section>

      {first ? (
        <p className="mt-10 text-sm">
          <Link
            href={partsHref({}, { make: undefined, q: `${first.make} ${first.model ?? ""}`.trim() })}
            className="font-semibold text-primary hover:underline"
          >
            Shop more {first.make} {first.model ?? ""} parts →
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** Reads the cart cookie so the button shows "In cart" for parts already added. */
async function CartButton({ productId, title, maxQuantity }: { productId: string; title: string; maxQuantity: number }) {
  const cart = await readCart();
  return <AddToCartButton productId={productId} title={title} maxQuantity={maxQuantity} inCart={cart.some((l) => l.productId === productId)} />;
}

async function SimilarParts({
  productId,
  similarKey,
  sku,
}: {
  productId: string;
  similarKey: { category: string | null; make: string | null; model: string | null };
  sku: string;
}) {
  const products = await getSimilarProducts(productId, similarKey);
  return (
    <ProductGrid
      products={products}
      className="mt-5"
      empty={
        <div className="mt-5 flex flex-col items-start gap-3 rounded-lg border border-dashed p-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-muted-foreground">
            <SearchCheck className="size-4 text-primary" aria-hidden /> No similar parts in stock right now. We may still have one on a vehicle we&apos;re dismantling.
          </p>
          <Button asChild variant="outline">
            <Link href={`/contact?topic=part-request&sku=${encodeURIComponent(sku)}`}>Request this part</Link>
          </Button>
        </div>
      }
    />
  );
}

/** Query failed (not "not found"): keep the URL alive and offer a retry. */
function ProductUnavailable() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-wide uppercase">This part is temporarily unavailable</h1>
      <p className="mt-3 text-muted-foreground">We couldn&apos;t load it right now. Please refresh in a moment.</p>
      <Button asChild className="mt-6" variant="outline">
        <Link href="/parts">Browse parts</Link>
      </Button>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
