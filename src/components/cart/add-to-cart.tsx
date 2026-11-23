"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, ShoppingCart } from "lucide-react";
import { addToCartForm } from "@/app/(site)/cart/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { QuantityStepper } from "./quantity-stepper";

/**
 * Both buttons are forms posting a Server Action, so they work without JS (add, then
 * land on /cart). With JS the submit is intercepted: the part is added in place and the
 * cart drawer slides open.
 */
function useAddToCart(productId: string, initialInCart: boolean) {
  const { add, cart, pendingId, openCart } = useCart();
  const line = cart?.lines.find((l) => l.productId === productId && l.available);
  const inCart = cart ? Boolean(line) : initialInCart;
  return { inCart, inCartQty: line?.quantity ?? 0, pending: pendingId === productId, add, openCart };
}

/**
 * Product page buy button. When more than one unit is in stock, a quantity stepper sits
 * above it (the form uses `display: contents` so both slot into the buy-box grid).
 */
export function AddToCartButton({
  productId,
  title,
  maxQuantity = 1,
  inCart: initialInCart,
}: {
  productId: string;
  title?: string;
  maxQuantity?: number;
  inCart: boolean;
}) {
  const { inCart, inCartQty, pending, add, openCart } = useAddToCart(productId, initialInCart);
  const [quantity, setQuantity] = useState(1);
  const remaining = Math.max(0, maxQuantity - inCartQty);
  const multi = maxQuantity > 1;

  // Single-unit part already in the cart, or every unit is: offer to view the cart.
  if (inCart && (!multi || remaining === 0)) {
    return (
      <Button asChild size="lg" variant="dark">
        <Link
          href="/cart"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            openCart();
          }}
        >
          <Check aria-hidden /> In cart · View
        </Link>
      </Button>
    );
  }

  const qty = Math.min(quantity, Math.max(1, remaining));

  return (
    <form
      action={addToCartForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) void add(productId, title, qty);
      }}
      className="contents"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={qty} />
      {multi ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2">
          <span className="text-sm font-semibold">Quantity</span>
          <QuantityStepper value={qty} max={Math.max(1, remaining)} onChange={setQuantity} label="Quantity" size="lg" />
          <span className="text-sm text-muted-foreground">
            {inCartQty > 0 ? `${inCartQty} in your cart · ${remaining} more available` : `${maxQuantity} available`}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          <span className="font-semibold text-foreground">One-of-a-kind part</span> · 1 available
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ShoppingCart aria-hidden />}
        {pending ? "Adding…" : qty > 1 ? `Add ${qty} to cart` : "Add to cart"}
      </Button>
    </form>
  );
}

/** Product card: compact button that sits above the card's stretched link. */
export function QuickAddButton({
  productId,
  title,
  soldOut,
  href,
}: {
  productId: string;
  title: string;
  soldOut: boolean;
  href: string;
}) {
  const { inCart, pending, add, openCart } = useAddToCart(productId, false);
  const base =
    "relative z-10 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold tracking-wide uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  if (soldOut) {
    return (
      <Link href={href} aria-label={`View ${title}`} className={cn(base, "bg-muted text-muted-foreground hover:bg-secondary")}>
        View
      </Link>
    );
  }

  if (inCart) {
    return (
      <button type="button" onClick={openCart} aria-label={`${title} is in your cart. Open cart`} className={cn(base, "bg-success text-white hover:bg-success/90")}>
        <Check className="size-3.5" aria-hidden /> In cart
      </button>
    );
  }

  return (
    <form
      action={addToCartForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) void add(productId, title);
      }}
      className="relative z-10"
    >
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Add ${title} to cart`}
        className={cn(base, "bg-inverse text-inverse-foreground hover:bg-primary disabled:opacity-80")}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ShoppingCart className="size-3.5" aria-hidden />}
        {pending ? "Adding" : "Add"}
      </button>
    </form>
  );
}
