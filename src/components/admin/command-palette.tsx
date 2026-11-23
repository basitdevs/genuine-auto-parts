"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Loader2, Package, Search, ShoppingBag, User } from "lucide-react";
import type { NavItem } from "@/lib/admin/areas";
import { cn } from "@/lib/utils";

type Hit = { kind: "page" | "product" | "order" | "customer"; id: string; title: string; subtitle?: string; href: string };

const KIND_ICON = { product: Package, order: ShoppingBag, customer: User } as const;

/**
 * Ctrl/Cmd+K palette: jump to any admin page, or search products (title, SKU, OEM #,
 * eBay item #), orders (number, email, name) and customers (name, email).
 * Server search is debounced (250 ms) and stale responses are dropped.
 */
export function CommandPalette({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: NavItem[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<{ q: string; hits: Hit[] }>({ q: "", hits: [] });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => inputRef.current?.select());
    }
    if (!open && d.open) d.close();
  }, [open]);

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/admin/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((json: { hits?: Hit[] }) => setRemote({ q: trimmed, hits: json.hits ?? [] }))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [trimmed]);

  const loading = trimmed.length >= 2 && remote.q !== trimmed;
  const hits = useMemo<Hit[]>(() => {
    const q = trimmed.toLowerCase();
    const pages: Hit[] = nav
      .filter((n) => !q || n.label.toLowerCase().includes(q) || (n.keywords ?? "").includes(q))
      .map((n) => ({ kind: "page", id: n.href, title: n.label, href: n.href }));
    const extra: Hit[] = [
      { kind: "page", id: "new-product", title: "New product", href: "/admin/products/new" },
      { kind: "page", id: "new-vehicle", title: "New vehicle", href: "/admin/vehicles/new" },
      { kind: "page", id: "import", title: "Import eBay CSV", href: "/admin/imports" },
    ].filter((p) => nav.some((n) => p.href.startsWith(n.href) && n.href !== "/admin") && (!q || p.title.toLowerCase().includes(q))) as Hit[];
    return [...pages, ...extra, ...(remote.q === trimmed && trimmed.length >= 2 ? remote.hits : [])];
  }, [nav, remote, trimmed]);

  const current = Math.min(active, Math.max(hits.length - 1, 0));

  function go(hit: Hit | undefined) {
    if (!hit) return;
    onClose();
    setQuery("");
    router.push(hit.href);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Command palette"
      className="m-auto mt-[12vh] w-[min(640px,calc(100vw-2rem))] rounded-lg bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center gap-3 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(hits[current]);
            }
          }}
          placeholder="Search pages, products, SKU, OEM #, eBay #, orders, customers…"
          className="h-12 flex-1 bg-transparent text-sm outline-none"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={hits[current] ? `hit-${current}` : undefined}
        />
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
        {hits.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">{loading ? "Searching…" : "No results"}</li>
        ) : (
          hits.map((hit, i) => {
            const Icon = hit.kind === "page" ? ArrowRight : KIND_ICON[hit.kind];
            return (
              <li
                key={`${hit.kind}-${hit.id}`}
                id={`hit-${i}`}
                role="option"
                aria-selected={i === current}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm", i === current && "bg-muted")}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{hit.title}</span>
                  {hit.subtitle ? <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span> : null}
                </span>
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{hit.kind}</span>
                {i === current ? <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden /> : null}
              </li>
            );
          })
        )}
      </ul>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">↑↓ to move · Enter to open · Esc to close</p>
    </dialog>
  );
}
