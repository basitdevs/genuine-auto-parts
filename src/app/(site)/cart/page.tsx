import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, PackageSearch, RotateCcw, ShieldCheck, Trash2, Truck } from "lucide-react";
import { CartRequestForm } from "@/components/cart/cart-request-form";
import { QuantitySelect } from "@/components/cart/quantity-select";
import { PartImage } from "@/components/catalog/part-image";
import { PageHero } from "@/components/layout/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { quoteShipping } from "@/content/shipping";
import { getBusiness, getFlags, getShippingConfig } from "@/lib/settings/server";
import { getCustomer } from "@/lib/auth/session";
import { MAX_QTY, readCart } from "@/lib/cart/cookie";
import { getCartProducts, type CartProduct } from "@/lib/catalog/queries";
import { conditionLabel, formatPrice } from "@/lib/format";
import { removeFromCart, removeUnavailable } from "./actions";

export const metadata: Metadata = { title: "Your Cart", robots: { index: false } };

type Line = { product: CartProduct; quantity: number; available: boolean };

async function CartView({ searchParams }: { searchParams: PageProps<"/cart">["searchParams"] }) {
  const [params, cart, session, business, shippingConfig, flags] = await Promise.all([searchParams, readCart(), getCustomer(), getBusiness(), getShippingConfig(), getFlags()]);

  if (cart.length === 0) {
    return params.sent === "1" ? <RequestSent email={session?.customer.email} /> : <EmptyCart />;
  }

  const products = await getCartProducts(cart.map((l) => l.productId));
  if (!products) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="font-display text-2xl font-bold uppercase">We couldn&apos;t load your cart</p>
        <p className="mt-2 text-muted-foreground">Our inventory didn&apos;t respond. Your cart is saved, so please refresh in a moment.</p>
      </div>
    );
  }

  const lines: Line[] = cart.flatMap((l) => {
    const product = products.get(l.productId);
    if (!product) return [];
    const available = product.status === "active" && product.quantity > 0;
    return [{ product, quantity: available ? Math.min(l.quantity, product.quantity) : l.quantity, available }];
  });
  const missing = cart.length - lines.length;
  const live = lines.filter((l) => l.available);
  const unavailable = lines.length - live.length + missing;
  const units = live.reduce((n, l) => n + l.quantity, 0);
  const subtotal = live.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const shipping = quoteShipping(live.map((l) => ({ weightLb: l.product.weightLb, isFreight: l.product.isFreight, quantity: l.quantity, price: l.product.price })), shippingConfig);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <section aria-labelledby="cart-items">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="cart-items" className="font-display text-2xl font-bold tracking-wide uppercase">
            {units} {units === 1 ? "part" : "parts"} in your cart
          </h2>
          {unavailable > 0 ? (
            <form action={removeUnavailable}>
              <Button type="submit" variant="outline" size="sm">
                <Trash2 aria-hidden /> Remove {unavailable} sold {unavailable === 1 ? "item" : "items"}
              </Button>
            </form>
          ) : null}
        </div>

        <ul className="divide-y rounded-xl border bg-card">
          {lines.map(({ product, quantity, available }) => (
            <li key={product.id} className={available ? "p-4 sm:p-5" : "bg-muted/40 p-4 sm:p-5"}>
              <div className="flex gap-4">
                <Link href={`/parts/${product.slug}`} className="w-24 shrink-0 sm:w-32">
                  <PartImage image={product.image} icon={product.categoryIcon} sizes="128px" className={available ? "rounded-md border" : "rounded-md border opacity-50 grayscale"} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <Link href={`/parts/${product.slug}`} className="line-clamp-2 font-semibold hover:text-primary">
                      {product.title}
                    </Link>
                    <p className="font-display text-xl font-bold tabular-nums">{formatPrice(product.price * (available ? quantity : 1))}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SKU {product.sku}
                    {product.oemPartNumber ? <> · OEM # {product.oemPartNumber}</> : null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{conditionLabel[product.condition]}</Badge>
                    {product.isFreight ? <Badge variant="outline">Freight</Badge> : null}
                    {!available ? <Badge variant="dark">Sold</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    {available ? (
                      product.quantity > 1 ? (
                        <QuantitySelect productId={product.id} quantity={quantity} max={Math.min(product.quantity, MAX_QTY)} label={product.title} />
                      ) : (
                        <span className="text-muted-foreground">Qty 1 · one of a kind</span>
                      )
                    ) : (
                      <Link href={`/parts/${product.slug}#similar-title`} className="font-semibold text-primary hover:underline">
                        This part sold. See similar parts →
                      </Link>
                    )}
                    <form action={removeFromCart}>
                      <input type="hidden" name="productId" value={product.id} />
                      <button type="submit" className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" aria-hidden /> Remove
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {missing > 0 ? <p className="mt-3 text-sm text-muted-foreground">{missing} item(s) are no longer listed and were left out.</p> : null}

        <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <li className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden /> {business.policies.warrantyDays}-day warranty
          </li>
          <li className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
            <RotateCcw className="size-4 shrink-0 text-primary" aria-hidden /> {business.policies.returnDays}-day returns
          </li>
          <li className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
            <Truck className="size-4 shrink-0 text-primary" aria-hidden /> Ships in {shippingConfig.handlingTime}
          </li>
        </ul>
      </section>

      <aside className="grid gap-6 lg:sticky lg:top-40">
        <section aria-labelledby="summary-title" className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 id="summary-title" className="font-display text-xl font-bold tracking-wide uppercase">Order summary</h2>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-semibold tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="text-right font-semibold">
                {shipping.kind === "quote" ? (shipping.amount === 0 ? "Free" : formatPrice(shipping.amount)) : shipping.kind === "freight" ? "Freight quote" : "Confirmed by email"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sales tax</dt>
              <dd className="font-semibold">Where applicable</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t pt-3">
              <dt className="font-semibold">{shipping.kind === "quote" ? "Estimated total" : "Parts total"}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">{formatPrice(subtotal + (shipping.kind === "quote" ? shipping.amount : 0))}</dd>
            </div>
          </dl>
          {shipping.kind === "freight" ? <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{shipping.message}</p> : null}
        </section>

        {live.length > 0 && !flags.checkoutEnabled ? (
          <section id="checkout" className="rounded-xl border bg-card p-6 text-sm">
            <h2 className="font-display text-xl font-bold tracking-wide uppercase">Ordering is paused</h2>
            <p className="mt-2 text-muted-foreground">
              We&apos;re not taking online order requests right now. <Link href="/contact" className="font-semibold text-primary hover:underline">Contact us</Link> and we&apos;ll help you directly.
            </p>
          </section>
        ) : null}
        {live.length > 0 && flags.checkoutEnabled ? (
          <section id="checkout" aria-labelledby="checkout-title" className="scroll-mt-52 rounded-xl border-2 border-foreground bg-card p-6 shadow-sm">
            <h2 id="checkout-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-wide uppercase">
              <CreditCard className="size-5 text-primary" aria-hidden /> Request checkout
            </h2>
            <p className="mt-2 mb-5 text-sm text-muted-foreground">
              Send your cart and we&apos;ll confirm availability, fitment and shipping, then email you a secure payment link, usually within one
              business day. Nothing is charged until you approve it.
            </p>
            <CartRequestForm name={session?.customer.name ?? ""} email={session?.customer.email ?? ""} phone={session?.customer.phone ?? ""} />
            {!session ? (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                <Link href="/account/login?next=/cart" className="font-semibold text-primary hover:underline">Sign in</Link> to fill in your details
                automatically.
              </p>
            ) : null}
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border bg-card px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <PackageSearch className="size-7" aria-hidden />
      </span>
      <p className="mt-4 font-display text-3xl font-bold tracking-wide uppercase">Your cart is empty</p>
      <p className="mt-2 text-muted-foreground">Find genuine OEM parts by year, make and model, part number or VIN.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild size="lg">
          <Link href="/parts">
            Shop parts <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/contact?topic=part-request">Request a part</Link>
        </Button>
      </div>
    </div>
  );
}

function RequestSent({ email }: { email?: string }) {
  return (
    <div role="status" className="mx-auto max-w-xl rounded-xl border border-success/30 bg-card px-6 py-12 text-center shadow-sm">
      <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
      <p className="mt-4 font-display text-3xl font-bold tracking-wide uppercase">Order request sent</p>
      <p className="mt-2 text-muted-foreground">
        Thanks! We&apos;ll check each part, confirm shipping and email {email ? <span className="font-semibold text-foreground">{email}</span> : "you"} a secure
        payment link, usually within one business day. Nothing has been charged.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/parts">Keep shopping</Link>
        </Button>
        {email ? (
          <Button asChild variant="outline">
            <Link href="/account">My account</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="grid gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export default function CartPage(props: PageProps<"/cart">) {
  return (
    <>
      <PageHero title="Your cart" crumbs={[{ label: "Cart" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Suspense fallback={<CartSkeleton />}>
          <CartView searchParams={props.searchParams} />
        </Suspense>
      </div>
    </>
  );
}
