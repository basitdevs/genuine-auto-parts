import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CarFront } from "lucide-react";
import { EmptyState } from "@/components/catalog/product-grid";
import { VehicleCard } from "@/components/catalog/vehicle-card";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllVehicles } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Currently Dismantling",
  description: "Donor vehicles we're parting out right now. Shop genuine OEM parts pulled from each vehicle, traceable by stock number.",
  alternates: { canonical: "/vehicles" },
};

async function VehicleList() {
  const vehicles = await getAllVehicles();
  if (vehicles === null) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" aria-hidden />}
        title="Vehicles are temporarily unavailable"
        description="Please refresh in a moment."
      />
    );
  }
  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<CarFront className="size-6" aria-hidden />}
        title="New donor vehicles arriving soon"
        description="Looking for something specific? Tell us your vehicle and the part you need."
        action={
          <Button asChild>
            <Link href="/contact?topic=part-request">Request a part</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((v) => (
        <li key={v.slug} className="flex [&>article]:w-full">
          <VehicleCard vehicle={v} />
        </li>
      ))}
    </ul>
  );
}

export default function VehiclesPage() {
  return (
    <>
      <PageHero
        title="Currently dismantling"
        description="Every part we sell is traceable to the vehicle it came from. Pick a vehicle to see what we've pulled so far, or ask us for a part we haven't listed yet."
        crumbs={[{ label: "Vehicles" }]}
      />
      <div className="bg-inverse-2 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] bg-inverse-3" />)}</div>}>
            <VehicleList />
          </Suspense>
        </div>
      </div>
    </>
  );
}
