"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { mainNav } from "@/config/site";

/** Off-canvas menu for < lg screens. Focus moves in on open and back to the toggle on close. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const toggle = toggleRef.current;
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label="Open menu"
        className="inline-flex size-11 items-center justify-center rounded-md text-inverse-foreground hover:bg-inverse-foreground/10 lg:hidden"
      >
        <Menu className="size-6" aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="absolute inset-0 bg-inverse/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-menu"
            ref={panelRef}
            className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col border-l-2 border-primary bg-inverse text-inverse-foreground shadow-2xl motion-safe:animate-fade-up"
          >
            <div className="flex items-center justify-between border-b border-inverse-border px-5 py-4">
              <span className="font-display text-lg font-bold tracking-wider uppercase">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-10 items-center justify-center rounded-md hover:bg-inverse-foreground/10"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-2 py-3">
              <ul>
                {mainNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-md px-3 py-3 text-base font-semibold tracking-wide uppercase hover:bg-inverse-foreground/5"
                    >
                      {item.label}
                      <span aria-hidden className="h-0.5 w-4 bg-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
