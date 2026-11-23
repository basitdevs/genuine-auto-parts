"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  PackageSearch,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { PartImage } from "@/components/catalog/part-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CartSnapshot, CartSnapshotLine } from "@/lib/cart/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart, type CartNotice } from "./cart-provider";
import { QuantityStepper } from "./quantity-stepper";

/**
 * Slide-over cart. A native modal <dialog> gives focus trapping, Esc-to-close and an
 * inert background for free; clicking the backdrop closes it too.
 */
export function CartDrawer({ policies }: { policies: { warrantyDays: number; returnDays: number } }) {
  const { open, closeCart, cart, loading, notice, dismissNotice } = useCart();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const units = cart?.units ?? 0;

  return (
    <dialog
      ref={ref}
      aria-labelledby="cart-drawer-title"
      onClose={closeCart}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCart();
      }}
      className="cart-drawer fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[26rem] bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="cart-drawer-title" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-wide uppercase">
            <ShoppingCart className="size-5 text-primary" aria-hidden />
            Your cart
            {units > 0 ? (
              <span className="rounded-sm bg-inverse px-2 py-0.5 font-sans text-xs font-bold tracking-normal text-inverse-foreground tabular-nums">
                {units}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close cart"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {notice ? <Notice notice={notice} onDismiss={dismissNotice} /> : null}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!cart && loading ? (
            <DrawerSkeleton />
          ) : cart?.error ? (
            <div className="px-6 py-14 text-center">
              <AlertCircle className="mx-auto size-10 text-destructive" aria-hidden />
              <p className="mt-3 font-semibold">{cart.error}</p>
            </div>
          ) : !cart || cart.lines.length === 0 ? (
            <EmptyDrawer onClose={closeCart} />
          ) : (
            <ul className="divide-y" aria-busy={loading}>
              {cart.lines.map((line) => (
                <DrawerLine key={line.productId} line={line} />
              ))}
            </ul>
          )}
        </div>

        {cart && cart.lines.length > 0 && !cart.error ? <DrawerFooter cart={cart} onClose={closeCart} policies={policies} /> : null}
      </div>
    </dialog>
  );
}

function Notice({ notice, onDismiss }: { notice: CartNotice; onDismiss: () => void }) {
  const Icon = notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? AlertCircle : Info;
  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 border-b px-5 py-3 text-sm",
        notice.tone === "success" && "bg-success/8 text-foreground",
        notice.tone === "error" && "bg-destructive/8 text-destructive",
        notice.tone === "info" && "bg-muted text-foreground",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", notice.tone === "success" && "text-success")} aria-hidden />
      <p className="min-w-0 flex-1">
        {notice.title ? <span className="block font-semibold">{notice.title}</span> : null}
        {notice.text ? <span className={cn("line-clamp-1", notice.title && "text-muted-foreground")}>{notice.text}</span> : null}
      </p>
      <button type="button" onClick={onDismiss} className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function DrawerLine({ line }: { line: CartSnapshotLine }) {
  const { pendingId, setQuantity, remove, closeCart } = useCart();
  const busy = pendingId === line.productId;
  const href = `/parts/${line.slug}`;

  return (
    <li className={cn("flex gap-4 px-5 py-4 transition-opacity", busy && "opacity-60")}>
      <Link href={href} onClick={closeCart} className="w-20 shrink-0" tabIndex={-1} aria-hidden>
        <PartImage
          image={line.image}
          icon={line.categoryIcon}
          sizes="80px"
          className={cn("rounded-md border", !line.available && "opacity-50 grayscale")}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link href={href} onClick={closeCart} className="line-clamp-2 text-sm leading-snug font-semibold hover:text-primary">
            {line.title}
          </Link>
          <p className="shrink-0 font-display text-lg leading-none font-bold tabular-nums">
            {formatPrice(line.price * (line.available ? line.quantity : 1))}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {line.conditionLabel}
          {line.isFreight ? " · Ships by freight" : ""}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          {!line.available ? (
            <span className="rounded-sm bg-inverse px-2 py-0.5 text-[11px] font-bold tracking-wider text-inverse-foreground uppercase">Sold</span>
          ) : line.maxQuantity > 1 ? (
            <QuantityStepper
              value={line.quantity}
              max={line.maxQuantity}
              onChange={(next) => setQuantity(line.productId, next)}
              busy={busy}
              label={`Quantity for ${line.title}`}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Qty 1 · one of a kind</span>
          )}
          <button
            type="button"
            onClick={() => remove(line.productId)}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
            aria-label={`Remove ${line.title}`}
          >
            {busy && line.maxQuantity <= 1 ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function DrawerFooter({ cart, onClose, policies }: { cart: CartSnapshot; onClose: () => void; policies: { warrantyDays: number; returnDays: number } }) {
  const shipping =
    cart.shipping.kind === "quote"
      ? cart.shipping.amount === 0
        ? "Free"
        : formatPrice(cart.shipping.amount)
      : cart.shipping.kind === "freight"
        ? "Freight quote"
        : "Calculated at checkout";
  const canCheckout = cart.units > 0;

  return (
    <div className="border-t bg-muted/50 px-5 pt-4 pb-5">
      {cart.unavailable > 0 ? (
        <p className="mb-3 rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
          {cart.unavailable} {cart.unavailable === 1 ? "part has" : "parts have"} sold and won&apos;t be included.
        </p>
      ) : null}
      <dl className="grid gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-semibold tabular-nums">{formatPrice(cart.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="font-medium">{shipping}</dd>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between border-t pt-2.5">
          <dt className="font-semibold">Estimated total</dt>
          <dd className="font-display text-2xl font-bold tabular-nums">
            {formatPrice(cart.subtotal + (cart.shipping.kind === "quote" ? cart.shipping.amount : 0))}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2">
        {canCheckout ? (
          <Button asChild size="lg" className="w-full">
            <Link href="/cart#checkout" onClick={onClose}>
              <Lock aria-hidden /> Checkout <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="w-full">
            <Link href="/cart" onClick={onClose}>
              View cart
            </Link>
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Keep shopping
          </Button>
        </div>
      </div>

      <ul className="mt-4 flex items-center justify-center gap-4 text-[11px] font-medium text-muted-foreground">
        <li className="inline-flex items-center gap-1">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden /> {policies.warrantyDays}-day warranty
        </li>
        <li className="inline-flex items-center gap-1">
          <RotateCcw className="size-3.5 text-primary" aria-hidden /> {policies.returnDays}-day returns
        </li>
      </ul>
    </div>
  );
}

function EmptyDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <PackageSearch className="size-7" aria-hidden />
      </span>
      <p className="mt-4 font-display text-2xl font-bold tracking-wide uppercase">Your cart is empty</p>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">Find genuine OEM parts for your vehicle by year, make and model.</p>
      <Button asChild className="mt-6">
        <Link href="/parts" onClick={onClose}>
          Shop parts <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="grid gap-5 px-5 py-5" aria-label="Loading cart">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-16 w-20 shrink-0" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
