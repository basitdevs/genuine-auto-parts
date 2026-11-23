"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CarFront, Loader2, Search, X } from "lucide-react";
import { VehicleSearch, type Option } from "@/components/search/vehicle-search";
import { cn } from "@/lib/utils";

type Props = { years: Option[]; categories: Option[] };

/** Header keyword / part-number search, plus a "Vehicle" toggle that drops the Year/Make/Model finder below the header. */
export function HeaderSearch({ years, categories }: Props) {
  const id = useId();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("select, input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = q.trim();
    startTransition(() => router.push(value ? `/parts?q=${encodeURIComponent(value)}` : "/parts"));
  }

  return (
    <>
      <div className="flex w-full items-center gap-2">
        <form role="search" action="/parts" method="get" onSubmit={onSubmit} className="relative min-w-0 flex-1">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search parts
          </label>
          <input
            id={`${id}-q`}
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search part name, OEM #, or vehicle…"
            autoComplete="off"
            className="h-11 w-full rounded-md border border-inverse-border bg-inverse-2 pr-12 pl-4 text-sm text-inverse-foreground placeholder:text-inverse-muted transition-colors outline-none focus-visible:border-inverse-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute top-1 right-1 inline-flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground transition-colors hover:bg-primary-strong"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
          </button>
        </form>
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
            open
              ? "border-primary bg-primary text-primary-foreground"
              : "border-inverse-border text-inverse-foreground hover:border-inverse-foreground/50",
          )}
        >
          {open ? <X className="size-4" aria-hidden /> : <CarFront className="size-4" aria-hidden />}
          <span className="hidden sm:inline">Shop by vehicle</span>
          <span className="sr-only sm:hidden">Shop by vehicle</span>
        </button>
      </div>

      {open ? (
        <div
          id={`${id}-panel`}
          ref={panelRef}
          className="absolute inset-x-0 top-full z-40 border-t-2 border-primary bg-background shadow-2xl motion-safe:animate-fade-up"
        >
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg font-bold tracking-wide uppercase">Find parts by vehicle</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close vehicle search"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <VehicleSearch years={years} categories={categories} onSubmitted={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
