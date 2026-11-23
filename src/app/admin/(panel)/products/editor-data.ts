import "server-only";
import type { StaffSession } from "@/lib/auth/staff";
import { loadCatalogRefs } from "@/lib/admin/products";

/** Reference lists the product editor needs (categories, makes, models, donor vehicles). */
export async function loadEditorRefs(db: StaffSession["db"]) {
  const [refs, vehicles] = await Promise.all([
    loadCatalogRefs(db),
    db.from("donor_vehicles").select("id, stock_number, year, trim, makes(name), models(name)").order("acquired_at", { ascending: false, nullsFirst: false }).limit(500),
  ]);
  return {
    ...refs,
    vehicles: (vehicles.data ?? []).map((v) => {
      const make = (v.makes as unknown as { name: string } | null)?.name ?? "";
      const model = (v.models as unknown as { name: string } | null)?.name ?? "";
      return { id: v.id, label: `${v.stock_number} · ${v.year} ${make} ${model} ${v.trim ?? ""}`.trim() };
    }),
  };
}
