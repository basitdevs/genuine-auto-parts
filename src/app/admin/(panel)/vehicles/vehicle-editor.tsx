"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton, FieldError } from "@/components/admin/client";
import { ImageManager, type EditorImage } from "@/components/admin/image-manager";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteVehicle, deleteVehicleImage, registerVehicleImage, saveVehicle, saveVehicleImages } from "./actions";

export type EditorVehicle = {
  id?: number;
  stock_number: string;
  slug: string;
  vin: string;
  year: string;
  make_id: string;
  model_id: string;
  trim: string;
  odometer: string;
  engine: string;
  transmission: string;
  drive_type: string;
  exterior_color: string;
  interior_color: string;
  status: "incoming" | "dismantling" | "parted_out" | "crushed";
  description: string;
  is_featured: boolean;
  acquired_at: string;
};

export function VehicleEditor({ initial, makes, models, images, canDelete }: {
  initial: EditorVehicle;
  makes: { id: number; name: string }[];
  models: { id: number; name: string; make_id: number }[];
  images: EditorImage[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof EditorVehicle>(k: K, val: EditorVehicle[K]) => setV((p) => ({ ...p, [k]: val }));
  const field = (k: keyof EditorVehicle, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="grid gap-1 text-xs font-semibold">
      {label}
      <input value={String(v[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} className={cn(fieldClass, "h-10 font-normal", errors[k] && "border-destructive")} {...props} />
      <FieldError message={errors[k]} />
    </label>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form
        id="vehicle-form"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await saveVehicle(v);
            setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
            if (!r.ok) return void toast.error(r.message);
            toast.success(r.message);
            if (!v.id && r.data) router.push(`/admin/vehicles/${r.data.id}`);
            else router.refresh();
          });
        }}
        className="grid content-start gap-6"
      >
        <section className="grid gap-4 rounded-lg border bg-card p-5">
          <h2 className="font-display text-lg font-bold tracking-wide uppercase">Vehicle</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("stock_number", "Stock #", { required: true, className: cn(fieldClass, "h-10 font-mono font-normal") })}
            {field("vin", "VIN", { maxLength: 17, className: cn(fieldClass, "h-10 font-mono font-normal uppercase") })}
            {field("acquired_at", "Acquired", { type: "date" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {field("year", "Year", { inputMode: "numeric", required: true })}
            <label className="grid gap-1 text-xs font-semibold">
              Make
              <select value={v.make_id} onChange={(e) => setV({ ...v, make_id: e.target.value, model_id: "" })} className={cn(fieldClass, "h-10 font-normal")}>
                <option value="">Make…</option>
                {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <FieldError message={errors.make_id} />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Model
              <select value={v.model_id} onChange={(e) => set("model_id", e.target.value)} disabled={!v.make_id} className={cn(fieldClass, "h-10 font-normal")}>
                <option value="">Model…</option>
                {models.filter((m) => String(m.make_id) === v.make_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            {field("trim", "Trim")}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("odometer", "Mileage", { inputMode: "numeric" })}
            {field("engine", "Engine", { placeholder: "e.g. 3.3L V6 Twin Turbo" })}
            {field("transmission", "Transmission")}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("drive_type", "Drive", { placeholder: "RWD / FWD / AWD / 4WD" })}
            {field("exterior_color", "Exterior color")}
            {field("interior_color", "Interior color")}
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            Description
            <textarea value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} className={cn(fieldClass, "h-auto py-2 font-normal")} />
          </label>
          {field("slug", "URL slug", { placeholder: "Generated from year, make, model and stock #" })}
        </section>
        {v.id ? (
          <ImageManager ownerId={String(v.id)} initial={images} bucket="vehicle-images" actions={{ register: registerVehicleImage, save: saveVehicleImages, remove: deleteVehicleImage }} />
        ) : (
          <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Save the vehicle first, then add photos.</p>
        )}
      </form>

      <div className="grid content-start gap-4 xl:sticky xl:top-20">
        <section className="grid gap-3 rounded-lg border bg-card p-5">
          <label className="grid gap-1 text-xs font-semibold">
            Status
            <select form="vehicle-form" value={v.status} onChange={(e) => set("status", e.target.value as EditorVehicle["status"])} className={cn(fieldClass, "h-10 font-normal")}>
              <option value="incoming">Incoming (hidden from the store)</option>
              <option value="dismantling">Dismantling (shown on the store)</option>
              <option value="parted_out">Parted out</option>
              <option value="crushed">Crushed</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={v.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="size-4 accent-primary" /> Featured on the home page
          </label>
          <Button type="submit" form="vehicle-form" size="lg" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} {v.id ? "Save vehicle" : "Create vehicle"}
          </Button>
          {v.id && canDelete ? (
            <ConfirmButton
              variant="outline"
              destructive
              title="Delete this vehicle?"
              description="Its photos are deleted. Parts pulled from it stay in the catalog, just unlinked from the vehicle."
              confirmLabel="Delete vehicle"
              onConfirm={() =>
                startTransition(async () => {
                  const r = await deleteVehicle(v.id!);
                  if (r.ok) {
                    toast.success(r.message);
                    router.push("/admin/vehicles");
                  } else toast.error(r.message);
                })
              }
            >
              <Trash2 aria-hidden /> Delete
            </ConfirmButton>
          ) : null}
        </section>
      </div>
    </div>
  );
}
