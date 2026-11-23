"use client";

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { addCartItem, getCart, removeCartItem, setCartItemQuantity } from "@/app/(site)/cart/actions";
import type { CartMutationResult, CartSnapshot } from "@/lib/cart/types";

export type CartNotice = { tone: "success" | "error" | "info"; text: string; title?: string };

type CartContextValue = {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Latest snapshot, or null until the drawer has loaded once. */
  cart: CartSnapshot | null;
  loading: boolean;
  /** Product whose add/update/remove is in flight. */
  pendingId: string | null;
  notice: CartNotice | null;
  dismissNotice: () => void;
  add: (productId: string, title?: string, quantity?: number) => Promise<boolean>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}

/**
 * Client cart state for the slide-over drawer. The cookie stays the source of truth:
 * every change goes through a Server Action that returns a fresh snapshot (and, because
 * it sets the cookie, re-renders the page so the header badge and /cart stay in sync).
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<CartNotice | null>(null);
  // Ignore responses that arrive after a newer request started.
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const snapshot = await getCart();
      if (request === requestRef.current) setCart(snapshot);
    } catch {
      if (request === requestRef.current) setNotice({ tone: "error", text: "We couldn't load your cart. Please try again." });
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  const openCart = useCallback(() => {
    setNotice(null);
    setOpen(true);
    void refresh();
  }, [refresh]);

  const closeCart = useCallback(() => setOpen(false), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const mutate = useCallback(async (productId: string, run: () => Promise<CartMutationResult>) => {
    const request = ++requestRef.current;
    setPendingId(productId);
    try {
      const result = await run();
      if (request === requestRef.current) {
        setCart(result.cart);
        setLoading(false);
      }
      return result;
    } catch {
      return null;
    } finally {
      setPendingId((current) => (current === productId ? null : current));
    }
  }, []);

  const add = useCallback(
    async (productId: string, title?: string, quantity = 1) => {
      const result = await mutate(productId, () => addCartItem(productId, quantity));
      if (!result) {
        setNotice({ tone: "error", text: "Something went wrong. Please try again." });
      } else if (result.ok) {
        setNotice({ tone: "success", title: result.message, text: title ?? "" });
      } else {
        setNotice({ tone: "error", text: result.message });
      }
      setOpen(true);
      return Boolean(result?.ok);
    },
    [mutate],
  );

  const setQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const result = await mutate(productId, () => setCartItemQuantity(productId, quantity));
      if (!result) setNotice({ tone: "error", text: "Couldn't update that quantity. Please try again." });
      else if (!result.ok) setNotice({ tone: "info", text: result.message });
      else setNotice(null);
    },
    [mutate],
  );

  const remove = useCallback(
    async (productId: string) => {
      const result = await mutate(productId, () => removeCartItem(productId));
      if (!result) setNotice({ tone: "error", text: "Couldn't remove that part. Please try again." });
      else setNotice(null);
    },
    [mutate],
  );

  const value = useMemo<CartContextValue>(
    () => ({ open, openCart, closeCart, cart, loading, pendingId, notice, dismissNotice, add, setQuantity, remove }),
    [open, openCart, closeCart, cart, loading, pendingId, notice, dismissNotice, add, setQuantity, remove],
  );

  return <CartContext value={value}>{children}</CartContext>;
}
