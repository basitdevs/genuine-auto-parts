import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader, Panel, PRODUCT_STATUS_META, StatusBadge, TableSkeleton, VEHICLE_STATUS } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { canAccess, requireArea } from "@/lib/admin/access";
import { loadCatalogRefs } from "@/lib/admin/products";
import { imageUrl, VEHICLE_BUCKET } from "@/lib/catalog/images";
import { formatPrice } from "@/lib/format";
import { VehicleEditor, type EditorVehicle } from "../vehicle-editor";

export const metadata: Metadata = { title: "Vehicle" };
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

async function VehicleView({ params }: { params: PageProps<"/admin/vehicles/[id]">["params"] }) {
  const { id } = await params;
  const session = await requireArea("vehicles", `/admin/vehicles/${id}`);
  if (!/^\d+$/.test(id)) notFound();
  const { db } = session;
  const [vRes, imgRes, partsRes, refs] = await Promise.all([
    db.from("donor_vehicles").select("*").eq("id", Number(id)).maybeSingle(),
    db.from("donor_vehicle_images").select("id, storage_path, external_url, alt, position").eq("vehicle_id", Number(id)).order("position"),
    db.from("products").select("id, title, sku, status, price", { count: "exact" }).eq("donor_vehicle_id", Number(id)).order("updated_at", { ascending: false }).limit(20),
    loadCatalogRefs(db),
  ]);
  const v = vRes.data;
  if (!v) notFound();
  const initial: EditorVehicle = {
    id: v.id, stock_number: v.stock_number, slug: v.slug, vin: s(v.vin), year: s(v.year), make_id: s(v.make_id), model_id: s(v.model_id), trim: s(v.trim),
    odometer: s(v.odometer), engine: s(v.engine), transmission: s(v.transmission), drive_type: s(v.drive_type), exterior_color: s(v.exterior_color),
    interior_color: s(v.interior_color), status: v.status, description: s(v.description), is_featured: v.is_featured, acquired_at: s(v.acquired_at),
  };
  const make = refs.makes.find((m) => m.id === v.make_id)?.name ?? "";
  const model = refs.models.find((m) => m.id === v.model_id)?.name ?? "";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/vehicles", label: "Vehicles" }}
        title={`${v.year} ${make} ${model}`}
        description={<span className="flex items-center gap-2"><span className="font-mono">{v.stock_number}</span><StatusBadge tone={VEHICLE_STATUS[v.status]?.tone}>{VEHICLE_STATUS[v.status]?.label}</StatusBadge></span>}
        actions={v.status !== "incoming" ? <Button asChild variant="outline" size="sm"><a href={`/vehicles/${v.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> View on site</a></Button> : null}
      />
      <VehicleEditor
        initial={initial}
        makes={refs.makes}
        models={refs.models}
        images={(imgRes.data ?? []).map((i) => ({ id: i.id, src: imageUrl(i, VEHICLE_BUCKET), alt: i.alt ?? "" }))}
        canDelete={canAccess(session.role, "settings")}
      />
      <Panel
        className="mt-6"
        title={`Parts from this vehicle (${partsRes.count ?? 0})`}
        actions={<Link href={`/admin/products?vehicle=${v.id}`} className="text-xs font-semibold hover:text-primary">Open in products →</Link>}
        bodyClassName="p-0"
      >
        {(partsRes.data ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No parts linked yet. Set “Donor vehicle” on a product to link it here.</p>
        ) : (
          <ul className="divide-y">
            {(partsRes.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">{p.title}</Link>
                <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                <StatusBadge tone={PRODUCT_STATUS_META[p.status]?.tone}>{p.status}</StatusBadge>
                <span className="w-20 text-right tabular-nums">{formatPrice(Number(p.price))}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default function VehiclePage(props: PageProps<"/admin/vehicles/[id]">) {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <VehicleView params={props.params} />
    </Suspense>
  );
}
