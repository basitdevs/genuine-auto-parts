import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, TableSkeleton } from "@/components/admin/ui";
import { canAccess, requireArea } from "@/lib/admin/access";
import { loadCatalogRefs } from "@/lib/admin/products";
import { VehicleEditor } from "../vehicle-editor";

export const metadata: Metadata = { title: "New vehicle" };

async function NewVehicle() {
  const session = await requireArea("vehicles", "/admin/vehicles/new");
  const refs = await loadCatalogRefs(session.db);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <VehicleEditor
      initial={{
        stock_number: "", slug: "", vin: "", year: "", make_id: "", model_id: "", trim: "", odometer: "", engine: "", transmission: "",
        drive_type: "", exterior_color: "", interior_color: "", status: "incoming", description: "", is_featured: false, acquired_at: today,
      }}
      makes={refs.makes}
      models={refs.models}
      images={[]}
      canDelete={canAccess(session.role, "settings")}
    />
  );
}

export default function NewVehiclePage() {
  return (
    <>
      <PageHeader back={{ href: "/admin/vehicles", label: "Vehicles" }} title="New vehicle" description="Starts as Incoming (hidden). Switch to Dismantling to show it on the store." />
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <NewVehicle />
      </Suspense>
    </>
  );
}
