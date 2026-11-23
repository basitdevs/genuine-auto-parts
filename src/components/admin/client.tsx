"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

/** Replaces URL search params (resetting page) inside a transition; returns pending state. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  function set(changes: Record<string, string | null | undefined>, { keepPage = false } = {}) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!keepPage) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { params, set, pending };
}

/** Search box that updates ?q= after 300 ms of no typing. */
export function SearchInput({ placeholder, param = "q", className }: { placeholder: string; param?: string; className?: string }) {
  const { params, set, pending } = useUrlParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const current = params.get(param) ?? "";
  useEffect(() => {
    // Only navigate when the typed value really differs from the URL (no spurious
    // navigation on mount, including React's dev double-invoked effects).
    if (value.trim() === current) return;
    const t = setTimeout(() => set({ [param]: value.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `set` changes every render; debounce on value only
  }, [value, current]);
  return (
    <div className={cn("relative min-w-56 flex-1", className)}>
      <label className="sr-only" htmlFor={`search-${param}`}>{placeholder}</label>
      {pending ? (
        <Loader2 aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <input
        id={`search-${param}`}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background pr-8 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
      />
      {value ? (
        <button type="button" onClick={() => setValue("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** <select> bound to a URL param. */
export function FilterSelect({ param, label, options, className }: { param: string; label: string; options: { value: string; label: string }[]; className?: string }) {
  const { params, set } = useUrlParams();
  return (
    <label className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={params.get(param) ?? ""}
        onChange={(e) => set({ [param]: e.target.value || null })}
        className="h-9 max-w-52 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Tabs (e.g. order statuses) bound to a URL param. */
export function FilterTabs({ param, tabs }: { param: string; tabs: { value: string; label: string; count?: number }[] }) {
  const { params, set } = useUrlParams();
  const current = params.get(param) ?? "";
  return (
    <div role="tablist" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={current === t.value}
          type="button"
          onClick={() => set({ [param]: t.value || null })}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
            current === t.value ? "border-inverse bg-inverse text-inverse-foreground" : "bg-background hover:border-foreground/40",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className={cn("tabular-nums", current === t.value ? "text-inverse-muted" : "text-muted-foreground")}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Runs a Server Action with a pending state and a toast for the result. */
export function useAction<A extends unknown[]>(action: (...args: A) => Promise<ActionResult>, opts: { onSuccess?: (r: ActionResult) => void; silent?: boolean } = {}) {
  const [pending, startTransition] = useTransition();
  function run(...args: A) {
    startTransition(async () => {
      try {
        const result = await action(...args);
        if (result.ok) {
          if (!opts.silent) toast.success(result.message);
          opts.onSuccess?.(result);
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        // redirect() inside an action throws a special error that must propagate.
        if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
        toast.error("Something went wrong. Please try again.");
      }
    });
  }
  return { run, pending };
}

/** Button that asks for confirmation in a modal before running `onConfirm`. */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  pending = false,
  ...button
}: Omit<ButtonProps, "onClick"> & {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" {...button} disabled={pending || button.disabled} onClick={() => ref.current?.showModal()}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Button>
      <dialog ref={ref} className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-lg bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50" aria-labelledby="confirm-title">
        <div className="p-5">
          <h2 id="confirm-title" className="font-display text-xl font-bold tracking-wide uppercase">{title}</h2>
          {description ? <div className="mt-2 text-sm text-muted-foreground">{description}</div> : null}
        </div>
        <div className="flex justify-end gap-2 border-t bg-muted/40 px-5 py-3">
          <Button type="button" variant="outline" onClick={() => ref.current?.close()}>Cancel</Button>
          <Button
            type="button"
            variant={destructive ? "default" : "dark"}
            className={destructive ? "bg-destructive hover:bg-destructive/90" : undefined}
            onClick={() => {
              ref.current?.close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-medium text-destructive">{message}</p> : null;
}
