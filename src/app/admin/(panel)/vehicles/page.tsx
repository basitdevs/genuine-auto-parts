import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterSelect, SearchInput } from "@/components/admin/client";
import { EmptyRow, ErrorNotice, PageHeader, Pager, StatusBadge, Table, TableSkeleton, Td, Th, VEHICLE_STATUS } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/lib/admin/access";
import { pageNumber, sanitizeSearch, str } from "@/lib/admin/db";

export const metadata: Metadata = { title: "Vehicles" };
const PAGE_SIZE = 25;

async function VehiclesView({ searchParams }: { searchParams: PageProps<"/admin/vehicles">["searchParams"] }) {
  const { db } = await requireArea("vehicles", "/admin/vehicles");
  const params = await searchParams;
  const rawStatus = str(params.status);
  const status = rawStatus && rawStatus in VEHICLE_STATUS ? rawStatus : undefined;
  const q = sanitizeSearch(str(params.q) ?? "");
  const page = pageNumber(params.page);

  let query = db
    .from("donor_vehicles")
    .select("id, stock_number, slug, year, trim, vin, odometer, status, acquired_at, makes(name), models(name), products(count), donor_vehicle_images(count)", { count: "exact" })
    .order("acquired_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status as "dismantling");
  if (q) query = query.or(`stock_number.ilike.%${q}%,vin.ilike.%${q}%,trim.ilike.%${q}%`);
  const { data, error, count } = await query;
  if (error) return <ErrorNotice message={error.message} />;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Stock #, VIN or trim…" />
        <FilterSelect param="status" label="Any status" options={Object.entries(VEHICLE_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
      </div>
      <Table minWidth={820}>
        <thead>
          <tr>
            <Th>Stock #</Th>
            <Th>Vehicle</Th>
            <Th>VIN</Th>
            <Th className="text-right">Mileage</Th>
            <Th className="text-right">Parts</Th>
            <Th className="text-right">Photos</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((v) => {
            const make = (v.makes as unknown as { name: string } | null)?.name ?? "";
            const model = (v.models as unknown as { name: string } | null)?.name ?? "";
            const parts = (v.products as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
            const photos = (v.donor_vehicle_images as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
            return (
              <tr key={v.id} className="hover:bg-muted/40">
                <Td><Link href={`/admin/vehicles/${v.id}`} className="font-mono text-xs font-bold hover:text-primary">{v.stock_number}</Link></Td>
                <Td><Link href={`/admin/vehicles/${v.id}`} className="font-medium hover:text-primary">{v.year} {make} {model} {v.trim ?? ""}</Link></Td>
                <Td className="font-mono text-xs text-muted-foreground">{v.vin ?? "—"}</Td>
                <Td className="text-right tabular-nums">{v.odometer ? v.odometer.toLocaleString() : "—"}</Td>
                <Td className="text-right tabular-nums">{parts ? <Link href={`/admin/products?vehicle=${v.id}`} className="hover:text-primary">{parts}</Link> : 0}</Td>
                <Td className="text-right tabular-nums">{photos}</Td>
                <Td><StatusBadge tone={VEHICLE_STATUS[v.status]?.tone}>{VEHICLE_STATUS[v.status]?.label ?? v.status}</StatusBadge></Td>
              </tr>
            );
          })}
          {(data ?? []).length === 0 ? <EmptyRow colSpan={7}>No vehicles yet. Add the cars you&apos;re dismantling so customers can browse their parts.</EmptyRow> : null}
        </tbody>
      </Table>
      <Pager basePath="/admin/vehicles" params={{ status, q: q || undefined }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </>
  );
}

export default function AdminVehiclesPage(props: PageProps<"/admin/vehicles">) {
  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Donor vehicles shown under “Currently dismantling”, with their photos and parts."
        actions={<Button asChild><Link href="/admin/vehicles/new"><Plus aria-hidden /> New vehicle</Link></Button>}
      />
      <Suspense fallback={<TableSkeleton />}>
        <VehiclesView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
