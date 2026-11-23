"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-provider";

/**
 * Header cart button. Opens the drawer; it's still a real link to /cart, so it works
 * before hydration, without JS, and with Ctrl/Cmd-click.
 * `count` comes from the cookie on the server and refreshes after every cart change.
 */
export function CartTrigger({ count }: { count: number }) {
  const { openCart } = useCart();

  return (
    <Link
      href="/cart"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        openCart();
      }}
      aria-haspopup="dialog"
      aria-label={count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"}
      className="relative inline-flex size-11 items-center justify-center rounded-md transition-colors hover:bg-inverse-foreground/10"
    >
      <ShoppingCart className="size-5" aria-hidden />
      {count > 0 ? (
        <span
          key={count}
          aria-hidden
          className="absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-bold text-primary-foreground ring-2 ring-inverse motion-safe:animate-badge-pop"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
