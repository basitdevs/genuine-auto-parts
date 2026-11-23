import { CarFront } from "lucide-react";
import { VehicleCard } from "@/components/catalog/vehicle-card";
import { Reveal } from "@/components/motion/reveal";
import { getDismantlingVehicles } from "@/lib/catalog/queries";
import { Section } from "./section";

export async function CurrentlyDismantling() {
  const vehicles = await getDismantlingVehicles(6);
  return (
    <Section
      id="dismantling"
      eyebrow="On the lift now"
      title="Currently dismantling"
      description="These donor vehicles are being parted out right now. Need something that isn't listed yet? Ask and we'll pull it."
      tone="dark"
      action={{ label: "All vehicles", href: "/vehicles" }}
    >
      {vehicles.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-inverse-border px-6 py-14 text-center">
          <CarFront className="mb-3 size-8 text-inverse-accent" aria-hidden />
          <p className="font-display text-xl font-bold tracking-wide uppercase">New donor vehicles arriving soon</p>
          <p className="mt-2 text-sm text-inverse-muted">Check back for the next vehicles on our lift.</p>
        </div>
      ) : (
        <Reveal>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => (
              <li key={vehicle.slug} className="flex [&>article]:w-full">
                <VehicleCard vehicle={vehicle} />
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </Section>
  );
}
