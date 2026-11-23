"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton, FieldError } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ImageManager, type EditorImage } from "@/components/admin/image-manager";
import { deleteProduct, deleteProductImage, duplicateProduct, registerProductImage, saveProduct, saveProductImages, type ProductInput } from "./actions";

type Ref = { id: number; name: string };
export type FitmentRow = { year: string; make_id: string; model_id: string; trim: string; engine: string; notes: string };
export type EditorProduct = {
  id?: string;
  title: string;
  slug: string;
  sku: string;
  status: "draft" | "active" | "sold" | "archived";
  condition: "used" | "new" | "remanufactured" | "for_parts";
  condition_notes: string;
  description: string;
  price: string;
  compare_at_price: string;
  quantity: string;
  warranty_days: string;
  is_featured: boolean;
  oem_part_number: string;
  interchange_numbers: string;
  brand: string;
  placement: string;
  category_id: string;
  donor_vehicle_id: string;
  weight_lb: string;
  length_in: string;
  width_in: string;
  height_in: string;
  is_freight: boolean;
  seo_title: string;
  seo_description: string;
  fitments: FitmentRow[];
};

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-5 py-3">
        <h2 className="font-display text-lg font-bold tracking-wide uppercase">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 p-5">{children}</div>
    </section>
  );
}

export function ProductEditor({
  initial,
  categories,
  makes,
  models,
  vehicles,
  images,
  canDelete,
  storeUrl,
}: {
  initial: EditorProduct;
  categories: (Ref & { parent_id: number | null })[];
  makes: Ref[];
  models: (Ref & { make_id: number })[];
  vehicles: { id: number; label: string }[];
  images: EditorImage[];
  canDelete: boolean;
  storeUrl: string | null;
}) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const set = <K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const input = (k: keyof EditorProduct, label: string, props: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string } = {}) => {
    const { hint, ...rest } = props;
    return (
      <label className="grid gap-1 text-xs font-semibold">
        {label}
        <input value={String(p[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} className={cn(fieldClass, "h-10 font-normal", errors[k] && "border-destructive")} aria-invalid={Boolean(errors[k]) || undefined} {...rest} />
        {hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
        <FieldError message={errors[k]} />
      </label>
    );
  };

  function addFitmentRange() {
    const make = p.fitments.at(-1)?.make_id ?? "";
    const model = p.fitments.at(-1)?.model_id ?? "";
    const from = Number(rangeFrom);
    const to = Number(rangeTo || rangeFrom);
    if (!from || !to || to < from || to - from > 40) {
      toast.error("Enter a year range like 2012 – 2018.");
      return;
    }
    const rows = Array.from({ length: to - from + 1 }, (_, i) => ({ year: String(from + i), make_id: make, model_id: model, trim: "", engine: "", notes: "" }));
    set("fitments", [...p.fitments, ...rows]);
    setRangeFrom("");
    setRangeTo("");
  }

  function submit() {
    startTransition(async () => {
      const payload: ProductInput = {
        ...p,
        interchange_numbers: p.interchange_numbers.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
        fitments: p.fitments.filter((f) => f.year && f.make_id),
      };
      const r = await saveProduct(payload);
      setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      if (!p.id && r.data?.id) router.push(`/admin/products/${r.data.id}`);
      else router.refresh();
    });
  }

  const topLevel = categories.filter((c) => c.parent_id === null);
  const seoTitle = p.seo_title || p.title;
  const seoDesc = p.seo_description || `${p.condition === "used" ? "Used OEM" : p.condition} ${p.title}${p.oem_part_number ? `, OEM # ${p.oem_part_number}` : ""}. Tested and shipped nationwide.`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-6 xl:grid-cols-[1fr_340px]"
    >
      <div className="grid content-start gap-6">
        <Section title="Basics">
          {input("title", "Title", { required: true, maxLength: 200 })}
          <div className="grid gap-4 sm:grid-cols-2">
            {input("sku", "SKU", { required: true, className: cn(fieldClass, "h-10 font-mono font-normal") })}
            {input("slug", "URL slug", { hint: "Leave blank to generate from the title and SKU." })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold">
              Condition
              <select value={p.condition} onChange={(e) => set("condition", e.target.value as EditorProduct["condition"])} className={cn(fieldClass, "h-10 font-normal")}>
                <option value="used">Used – OEM</option>
                <option value="new">New</option>
                <option value="remanufactured">Remanufactured</option>
                <option value="for_parts">For parts / repair</option>
              </select>
            </label>
            {input("condition_notes", "Condition notes", { placeholder: "e.g. small scratch on housing, tested OK" })}
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            Description
            <textarea value={p.description} onChange={(e) => set("description", e.target.value)} rows={6} className={cn(fieldClass, "h-auto py-2 font-normal")} />
          </label>
        </Section>

        <Section title="Pricing & stock">
          <div className="grid gap-4 sm:grid-cols-3">
            {input("price", "Price ($)", { inputMode: "decimal", required: true })}
            {input("compare_at_price", "Compare-at ($)", { inputMode: "decimal", hint: "Optional, shows as a strikethrough." })}
            {input("quantity", "Quantity", { inputMode: "numeric" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {input("warranty_days", "Warranty (days)", { inputMode: "numeric" })}
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <input type="checkbox" checked={p.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="size-4 accent-primary" /> Featured
            </label>
          </div>
        </Section>

        <Section title="Part numbers">
          <div className="grid gap-4 sm:grid-cols-2">
            {input("oem_part_number", "OEM part #", { className: cn(fieldClass, "h-10 font-mono font-normal") })}
            {input("brand", "Brand")}
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            Interchange numbers
            <textarea value={p.interchange_numbers} onChange={(e) => set("interchange_numbers", e.target.value)} rows={2} placeholder="One per line or comma-separated" className={cn(fieldClass, "h-auto py-2 font-mono font-normal")} />
          </label>
          {input("placement", "Placement on vehicle", { placeholder: "e.g. Front Left" })}
        </Section>

        <Section title={`Fitment (${p.fitments.length})`} description="Each row is one year / make / model combination the part fits. Used for Year → Make → Model search.">
          {p.fitments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                    <th className="pb-2 font-bold">Year</th>
                    <th className="pb-2 font-bold">Make</th>
                    <th className="pb-2 font-bold">Model</th>
                    <th className="pb-2 font-bold">Trim</th>
                    <th className="pb-2 font-bold">Engine</th>
                    <th className="pb-2"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {p.fitments.map((f, i) => {
                    const update = (patch: Partial<FitmentRow>) => set("fitments", p.fitments.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <tr key={i}>
                        <td className="py-1 pr-2"><input aria-label={`Year, row ${i + 1}`} value={f.year} onChange={(e) => update({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} className={cn(fieldClass, "h-9 w-20")} /></td>
                        <td className="py-1 pr-2">
                          <select aria-label={`Make, row ${i + 1}`} value={f.make_id} onChange={(e) => update({ make_id: e.target.value, model_id: "" })} className={cn(fieldClass, "h-9 w-40")}>
                            <option value="">Make…</option>
                            {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select aria-label={`Model, row ${i + 1}`} value={f.model_id} onChange={(e) => update({ model_id: e.target.value })} className={cn(fieldClass, "h-9 w-40")} disabled={!f.make_id}>
                            <option value="">Any model</option>
                            {models.filter((m) => String(m.make_id) === f.make_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </td>
                        <td className="py-1 pr-2"><input aria-label={`Trim, row ${i + 1}`} value={f.trim} onChange={(e) => update({ trim: e.target.value })} className={cn(fieldClass, "h-9 w-28")} /></td>
                        <td className="py-1 pr-2"><input aria-label={`Engine, row ${i + 1}`} value={f.engine} onChange={(e) => update({ engine: e.target.value })} className={cn(fieldClass, "h-9 w-32")} /></td>
                        <td className="py-1 text-right">
                          <button type="button" onClick={() => set("fitments", p.fitments.filter((_, j) => j !== i))} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`Remove row ${i + 1}`}>
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No fitment yet. Without it, the part won&apos;t appear in vehicle searches.</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => set("fitments", [...p.fitments, { year: "", make_id: p.fitments.at(-1)?.make_id ?? "", model_id: p.fitments.at(-1)?.model_id ?? "", trim: "", engine: "", notes: "" }])}>
              <Plus aria-hidden /> Add row
            </Button>
            <span className="text-xs text-muted-foreground">or add a year range:</span>
            <input aria-label="From year" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2012" className={cn(fieldClass, "h-8 w-20")} />
            <span className="text-muted-foreground">–</span>
            <input aria-label="To year" value={rangeTo} onChange={(e) => setRangeTo(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2018" className={cn(fieldClass, "h-8 w-20")} />
            <Button type="button" variant="outline" size="sm" onClick={addFitmentRange}>Add years</Button>
          </div>
        </Section>

        {p.id ? <ImageManager ownerId={p.id} initial={images} bucket="product-images" actions={{ register: registerProductImage, save: saveProductImages, remove: deleteProductImage }} /> : (
          <Section title="Photos"><p className="text-sm text-muted-foreground">Save the product first, then add photos.</p></Section>
        )}

        <Section title="SEO" description="Leave blank to use the title and an automatic description.">
          {input("seo_title", "Page title", { maxLength: 70, hint: `${(p.seo_title || p.title).length}/70` })}
          <label className="grid gap-1 text-xs font-semibold">
            Meta description
            <textarea value={p.seo_description} onChange={(e) => set("seo_description", e.target.value)} rows={2} maxLength={170} className={cn(fieldClass, "h-auto py-2 font-normal")} />
            <span className="font-normal text-muted-foreground">{p.seo_description.length}/170</span>
          </label>
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">Search preview</p>
            <p className="mt-1 truncate text-[17px] text-[#1a0dab]">{seoTitle}</p>
            <p className="truncate text-xs text-[#006621]">genuineautoparts…/parts/{p.slug || "…"}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{seoDesc}</p>
          </div>
        </Section>
      </div>

      {/* Side column */}
      <div className="grid content-start gap-6 xl:sticky xl:top-20">
        <Section title="Publish">
          <label className="grid gap-1 text-xs font-semibold">
            Status
            <select value={p.status} onChange={(e) => set("status", e.target.value as EditorProduct["status"])} className={cn(fieldClass, "h-10 font-normal")}>
              <option value="active">Active (visible, for sale)</option>
              <option value="draft">Draft (hidden)</option>
              <option value="sold">Sold (visible, not for sale)</option>
              <option value="archived">Archived (hidden)</option>
            </select>
          </label>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} {p.id ? "Save changes" : "Create product"}
          </Button>
          {p.id ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await duplicateProduct(p.id!);
                    if (r.ok && r.data) {
                      toast.success(r.message);
                      router.push(`/admin/products/${r.data.id}`);
                    } else toast.error(r.message);
                  })
                }
              >
                <Copy aria-hidden /> Duplicate
              </Button>
              {storeUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> View</a>
                </Button>
              ) : null}
              {canDelete ? (
                <ConfirmButton
                  variant="outline"
                  size="sm"
                  destructive
                  className="col-span-2"
                  title="Delete this product?"
                  description="It's archived and hidden from the store (soft delete). An admin can restore it later."
                  confirmLabel="Delete"
                  onConfirm={() =>
                    startTransition(async () => {
                      const r = await deleteProduct(p.id!);
                      if (r.ok) {
                        toast.success(r.message);
                        router.push("/admin/products");
                      } else toast.error(r.message);
                    })
                  }
                >
                  <Trash2 aria-hidden /> Delete
                </ConfirmButton>
              ) : null}
            </div>
          ) : (
            <Link href="/admin/products" className="text-center text-sm text-muted-foreground hover:text-foreground">Cancel</Link>
          )}
        </Section>

        <Section title="Organize">
          <label className="grid gap-1 text-xs font-semibold">
            Category
            <select value={p.category_id} onChange={(e) => set("category_id", e.target.value)} className={cn(fieldClass, "h-10 font-normal")}>
              <option value="">No category</option>
              {topLevel.map((top) => (
                <optgroup key={top.id} label={top.name}>
                  <option value={top.id}>{top.name} (general)</option>
                  {categories.filter((c) => c.parent_id === top.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Donor vehicle
            <select value={p.donor_vehicle_id} onChange={(e) => set("donor_vehicle_id", e.target.value)} className={cn(fieldClass, "h-10 font-normal")}>
              <option value="">None</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
        </Section>

        <Section title="Shipping">
          <div className="grid grid-cols-2 gap-3">
            {input("weight_lb", "Weight (lb)", { inputMode: "decimal" })}
            {input("length_in", "Length (in)", { inputMode: "decimal" })}
            {input("width_in", "Width (in)", { inputMode: "decimal" })}
            {input("height_in", "Height (in)", { inputMode: "decimal" })}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={p.is_freight} onChange={(e) => set("is_freight", e.target.checked)} className="size-4 accent-primary" /> Ships by freight (quoted manually)
          </label>
        </Section>
      </div>
    </form>
  );
}
