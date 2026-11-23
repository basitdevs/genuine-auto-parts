"use client";

import { useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, ExternalLink, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bulkProducts, quickUpdateProduct } from "./actions";

export type ProductRowData = {
  id: string;
  sku: string;
  slug: string;
  title: string;
  price: number;
  quantity: number;
  status: "active" | "sold" | "draft" | "archived";
  condition: string;
  oem: string | null;
  ebayItemId: string | null;
  category: string | null;
  thumb: string | null;
  photoCount: number;
};

const STATUS_STYLE: Record<ProductRowData["status"], string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  sold: "border-inverse bg-inverse text-inverse-foreground",
  draft: "border-border bg-muted text-foreground",
  archived: "border-amber-200 bg-amber-50 text-amber-900",
};

export function ProductsTable({ rows, categories, canDelete }: { rows: ProductRowData[]; categories: { id: number; name: string }[]; canDelete: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [percent, setPercent] = useState("");
  const [category, setCategory] = useState("");
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(input: Parameters<typeof bulkProducts>[0]) {
    startTransition(async () => {
      const r = await bulkProducts(input);
      if (r.ok) {
        toast.success(r.message);
        setSelected(new Set());
        router.refresh();
      } else toast.error(r.message);
    });
  }

  return (
    <>
      {ids.length ? (
        <div className="sticky top-16 z-20 mb-2 flex flex-wrap items-center gap-2 rounded-lg border-2 border-inverse bg-inverse p-2 text-inverse-foreground shadow-lg">
          <span className="px-2 text-sm font-semibold">{ids.length} selected</span>
          {(["active", "sold", "draft", "archived"] as const).map((s) => (
            <Button key={s} type="button" size="sm" variant="outline-inverse" disabled={pending} onClick={() => bulk({ action: "status", ids, value: s })}>
              Mark {s}
            </Button>
          ))}
          <span className="flex items-center gap-1">
            <label className="sr-only" htmlFor="bulk-cat">Change category</label>
            <select id="bulk-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 rounded-md border border-inverse-border bg-inverse-2 px-2 text-xs">
              <option value="">Category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button type="button" size="sm" variant="outline-inverse" disabled={pending || !category} onClick={() => bulk({ action: "category", ids, value: Number(category) })}>Apply</Button>
          </span>
          <span className="flex items-center gap-1">
            <label className="sr-only" htmlFor="bulk-pct">Adjust price by percent</label>
            <input id="bulk-pct" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.-]/g, ""))} placeholder="±%" className="h-8 w-16 rounded-md border border-inverse-border bg-inverse-2 px-2 text-xs" />
            <Button type="button" size="sm" variant="outline-inverse" disabled={pending || !percent || Number.isNaN(Number(percent))} onClick={() => bulk({ action: "price", ids, value: Number(percent) })}>Adjust price</Button>
          </span>
          {canDelete ? (
            <ConfirmButton
              size="sm"
              variant="outline-inverse"
              destructive
              title={`Delete ${ids.length} product(s)?`}
              description="They're archived and hidden from the store and admin lists (soft delete). An admin can restore them."
              confirmLabel="Delete"
              onConfirm={() => bulk({ action: "delete", ids })}
            >
              Delete
            </ConfirmButton>
          ) : null}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded-md p-1.5 hover:bg-inverse-foreground/10" aria-label="Clear selection">
            <X className="size-4" aria-hidden />
          </button>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="bg-muted/60 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              <th scope="col" className="w-10 border-b px-3 py-2.5">
                <input type="checkbox" aria-label="Select all on this page" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4 accent-primary" />
              </th>
              <th scope="col" className="border-b px-3 py-2.5">Product</th>
              <th scope="col" className="border-b px-3 py-2.5">Category</th>
              <th scope="col" className="w-28 border-b px-3 py-2.5 text-right">Price</th>
              <th scope="col" className="w-20 border-b px-3 py-2.5 text-right">Qty</th>
              <th scope="col" className="w-32 border-b px-3 py-2.5">Status</th>
              <th scope="col" className="w-28 border-b px-3 py-2.5 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={`${row.id}-${row.price}-${row.quantity}-${row.status}`} row={row} checked={selected.has(row.id)} onToggle={() => toggle(row.id)} />
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground">No products match these filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ row, checked, onToggle }: { row: ProductRowData; checked: boolean; onToggle: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ price: String(row.price), quantity: String(row.quantity), status: row.status });
  const [shown, setShown] = useOptimistic(row);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setShown({ ...row, price: Number(draft.price), quantity: Number(draft.quantity), status: draft.status });
      setEditing(false);
      const r = await quickUpdateProduct({ id: row.id, price: draft.price, quantity: draft.quantity, status: draft.status });
      if (r.ok) toast.success(`${row.sku}: ${r.message}`);
      else {
        toast.error(r.message);
        setEditing(true);
      }
    });
  }

  return (
    <tr className={cn("border-b last:border-0 hover:bg-muted/30", checked && "bg-accent/40")}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select ${row.title}`} className="size-4 accent-primary" />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
            {row.thumb ? <Image src={row.thumb} alt="" fill sizes="44px" className="object-cover" /> : <Camera className="size-4 text-muted-foreground" aria-hidden />}
          </span>
          <div className="min-w-0">
            <Link href={`/admin/products/${row.id}`} className="line-clamp-1 font-medium hover:text-primary">{row.title}</Link>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{row.sku}</span>
              {row.oem ? <> · OEM {row.oem}</> : null}
              {row.ebayItemId ? <> · eBay {row.ebayItemId}</> : null}
              {` · ${row.photoCount} photo${row.photoCount === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </td>
      <td className="max-w-40 truncate px-3 py-2 text-xs text-muted-foreground">{row.category ?? "—"}</td>
      {editing ? (
        <>
          <td className="px-3 py-2 text-right">
            <label className="sr-only" htmlFor={`p-${row.id}`}>Price</label>
            <input id={`p-${row.id}`} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputMode="decimal" className="h-8 w-24 rounded-md border px-2 text-right text-sm" autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
          </td>
          <td className="px-3 py-2 text-right">
            <label className="sr-only" htmlFor={`q-${row.id}`}>Quantity</label>
            <input id={`q-${row.id}`} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="h-8 w-16 rounded-md border px-2 text-right text-sm" onKeyDown={(e) => e.key === "Enter" && save()} />
          </td>
          <td className="px-3 py-2">
            <label className="sr-only" htmlFor={`s-${row.id}`}>Status</label>
            <select id={`s-${row.id}`} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProductRowData["status"] })} className="h-8 rounded-md border px-2 text-sm">
              {(["active", "sold", "draft", "archived"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </td>
          <td className="px-3 py-2 text-right">
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" onClick={save} aria-label="Save"><Check aria-hidden /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel"><X aria-hidden /></Button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatPrice(shown.price)}</td>
          <td className="px-3 py-2 text-right tabular-nums">{shown.quantity}</td>
          <td className="px-3 py-2">
            <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase", STATUS_STYLE[shown.status])}>
              {shown.status}
              {pending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
            </span>
          </td>
          <td className="px-3 py-2 text-right">
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Quick edit ${row.title}`}><Pencil aria-hidden /></Button>
              {shown.status === "active" || shown.status === "sold" ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={`/parts/${row.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${row.title} on the store`}><ExternalLink aria-hidden /></a>
                </Button>
              ) : null}
            </div>
          </td>
        </>
      )}
    </tr>
  );
}
