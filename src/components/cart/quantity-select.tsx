"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Minus, Plus } from "lucide-react";
import { updateCartQuantity } from "@/app/(site)/cart/actions";

/**
 * Cart page − qty + control. Each button is a real submit carrying the new quantity, so it
 * works without JS; with JS the Server Action updates the cookie and the page re-renders.
 */
export function QuantitySelect({ productId, quantity, max, label }: { productId: string; quantity: number; max: number; label: string }) {
  return (
    <form action={updateCartQuantity} className="flex items-center gap-3">
      <input type="hidden" name="productId" value={productId} />
      <Stepper quantity={quantity} max={max} label={label} />
      <span className="text-xs text-muted-foreground">{max} available</span>
    </form>
  );
}

function Stepper({ quantity, max, label }: { quantity: number; max: number; label: string }) {
  const { pending, data } = useFormStatus();
  const target = pending ? Number(data?.get("quantity")) : null;
  const btn =
    "inline-flex size-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";
  return (
    <div role="group" aria-label={`Quantity for ${label}`} className="inline-flex h-9 items-center rounded-md border bg-background">
      <button type="submit" name="quantity" value={quantity - 1} disabled={pending || quantity <= 1} className={`${btn} rounded-l-md`} aria-label="Decrease quantity">
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span aria-live="polite" className="w-9 text-center text-sm font-semibold tabular-nums">
        {pending ? target && Number.isFinite(target) ? target : <Loader2 className="mx-auto size-3.5 animate-spin" aria-hidden /> : quantity}
      </span>
      <button type="submit" name="quantity" value={quantity + 1} disabled={pending || quantity >= max} className={`${btn} rounded-r-md`} aria-label="Increase quantity">
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
