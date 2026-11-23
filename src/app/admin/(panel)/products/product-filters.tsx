"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterSelect, SearchInput, useUrlParams } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Ref = { id: number; name: string };

const SORT_OPTIONS = [
  { value: "created", label: "Newest" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "title", label: "Title A–Z" },
  { value: "quantity", label: "Stock: high → low" },
];

/** All filters live in the URL, so views are shareable and survive refresh/back. */
export function ProductFilters({ categories, makes, models, legacy }: { categories: (Ref & { parent_id: number | null })[]; makes: Ref[]; models: (Ref & { make_id: number })[]; legacy: boolean }) {
  const { params, set } = useUrlParams();
  const [open, setOpen] = useState(Boolean(params.get("make") || params.get("condition") || params.get("min") || params.get("max") || params.get("stock") || params.get("photos")));
  const make = params.get("make");
  const modelOptions = make ? models.filter((m) => String(m.make_id) === make) : [];
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const active = ["status", "category", "make", "model", "condition", "photos", "stock", "min", "max", "q"].filter((k) => params.get(k)).length;
  const topLevel = categories.filter((c) => c.parent_id === null);

  return (
    <div className="mb-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Title, SKU, OEM #, part # or eBay item #…" />
        <FilterSelect param="status" label="All statuses" options={[{ value: "active", label: "Active" }, { value: "sold", label: "Sold" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} />
        <FilterSelect param="category" label="All categories" options={topLevel.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterSelect param="sort" label="Recently updated" options={SORT_OPTIONS} />
        <Button type="button" variant={open ? "dark" : "outline"} size="sm" className="h-9" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <SlidersHorizontal aria-hidden /> More filters
        </Button>
        {active ? (
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => set({ status: null, category: null, make: null, model: null, condition: null, photos: null, stock: null, min: null, max: null, q: null })}>
            <X aria-hidden /> Clear ({active})
          </Button>
        ) : null}
      </div>
      <div className={cn("mt-3 flex-wrap items-center gap-2 border-t pt-3", open ? "flex" : "hidden")}>
        <FilterSelect param="make" label="Any make" options={makes.map((m) => ({ value: String(m.id), label: m.name }))} />
        {make ? <FilterSelect key={make} param="model" label="Any model" options={modelOptions.map((m) => ({ value: String(m.id), label: m.name }))} /> : null}
        <FilterSelect param="condition" label="Any condition" options={[{ value: "used", label: "Used" }, { value: "new", label: "New" }, { value: "remanufactured", label: "Remanufactured" }, { value: "for_parts", label: "For parts" }]} />
        {!legacy ? <FilterSelect param="photos" label="Photos: any" options={[{ value: "yes", label: "Has photos" }, { value: "none", label: "No photos" }]} /> : null}
        <FilterSelect param="stock" label="Stock: any" options={[{ value: "in", label: "In stock" }, { value: "out", label: "Out of stock" }]} />
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ min: min || null, max: max || null });
          }}
        >
          <label className="sr-only" htmlFor="pmin">Min price</label>
          <input id="pmin" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$ min" inputMode="decimal" className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm" />
          <span className="text-muted-foreground">–</span>
          <label className="sr-only" htmlFor="pmax">Max price</label>
          <input id="pmax" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$ max" inputMode="decimal" className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm" />
          <Button type="submit" size="sm" variant="outline" className="h-9">Apply</Button>
        </form>
      </div>
    </div>
  );
}
